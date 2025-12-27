"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  FileText,
  Loader2,
  Download,
  Trash2,
  FolderOpen,
  Upload,
  X,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";

interface UploadedFile {
  id: string;
  filename: string;
  original_filename: string;
  file_type: "uploaded" | "generated" | "chart" | "code";
  storage_path?: string;
  download_url?: string;
  size: number;
  created_at?: string;
}

interface LibraryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "view" | "select"; // view for viewing files, select for selecting files to use
  onFilesSelected?: (files: UploadedFile[]) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

function formatDate(dateString?: string): string {
  if (!dateString) return "";
  try {
    return format(new Date(dateString), "yyyy-MM-dd HH:mm");
  } catch {
    return "";
  }
}

export function LibraryDialog({
  open,
  onOpenChange,
  mode = "view",
  onFilesSelected,
}: LibraryDialogProps) {
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { session } = useAuth();

  const [searchQuery, setSearchQuery] = useState("");
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [isDownloading, setIsDownloading] = useState<string | null>(null);

  // Fetch files
  const fetchFiles = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        headers["X-User-Id"] = "default";
      }

      // Library is DB-driven: show only uploaded/generated/chart (exclude code)
      const response = await fetch(
        `${apiUrl}/api/files?types=uploaded,generated,chart`,
        { headers }
      );
      if (response.ok) {
        const data = await response.json();
        setFiles(data.files || []);
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, session]);

  // Fetch files when dialog opens
  useEffect(() => {
    if (open) {
      fetchFiles();
      setSelectedFiles(new Set());
      setSearchQuery("");
    }
  }, [open, fetchFiles]);

  // Filter files based on search
  const filteredFiles = files.filter((file) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      file.original_filename.toLowerCase().includes(query) ||
      file.filename.toLowerCase().includes(query)
    );
  });

  // Handle file download
  const handleDownload = async (file: UploadedFile) => {
    if (!apiUrl) return;
    try {
      setIsDownloading(file.id);
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        headers["X-User-Id"] = "default";
      }

      const downloadUrl = file.download_url
        ? file.download_url.startsWith("http")
          ? file.download_url
          : `${apiUrl}${file.download_url}`
        : `${apiUrl}/api/files/${encodeURIComponent(file.id)}/download`;

      const response = await fetch(downloadUrl, { headers });
      if (!response.ok) return;
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.original_filename || file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download file:", error);
    } finally {
      setIsDownloading(null);
    }
  };

  // Handle file delete
  const handleDelete = async (file: UploadedFile) => {
    if (!apiUrl) return;
    setIsDeleting(file.id);
    try {
      const headers: Record<string, string> = {};
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      } else {
        headers["X-User-Id"] = "default";
      }

      // Confirm global delete with usage count
      let usageCount = 0;
      try {
        const usageResp = await fetch(
          `${apiUrl}/api/files/${encodeURIComponent(file.id)}/usage-count`,
          { headers }
        );
        if (usageResp.ok) {
          const data = await usageResp.json();
          usageCount = Number(data?.count || 0);
        }
      } catch {
        // ignore usage count failure; still allow delete
      }

      const ok = window.confirm(
        usageCount > 0
          ? `此文件被 ${usageCount} 个对话使用，确认全局删除？`
          : "确认全局删除该文件？"
      );
      if (!ok) return;

      const response = await fetch(`${apiUrl}/api/files/${encodeURIComponent(file.id)}`, {
        method: "DELETE",
        headers,
      });
      if (!response.ok) return;

      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      setSelectedFiles((prev) => {
        const next = new Set(prev);
        next.delete(file.id);
        return next;
      });
    } catch (error) {
      console.error("Failed to delete file:", error);
    } finally {
      setIsDeleting(null);
    }
  };

  // Toggle file selection
  const toggleSelection = (file: UploadedFile) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(file.id)) {
        next.delete(file.id);
      } else {
        next.add(file.id);
      }
      return next;
    });
  };

  // Handle confirm selection
  const handleConfirmSelection = () => {
    const selected = files.filter((f) => selectedFiles.has(f.id));
    onFilesSelected?.(selected);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-5 w-5" />
            {mode === "select" ? "从库中选择文件" : "文件库"}
          </DialogTitle>
        </DialogHeader>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索文件..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* File list */}
        <ScrollArea className="flex-1 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配的文件" : "暂无文件"}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                上传文件后，它们将显示在这里
              </p>
            </div>
          ) : (
            <div className="space-y-1 p-1">
              {filteredFiles.map((file) => (
                <div
                  key={file.id}
                  className={cn(
                    "group flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors",
                    mode === "select" && "cursor-pointer",
                    selectedFiles.has(file.id)
                      ? "bg-primary/10 border border-primary"
                      : "hover:bg-accent border border-transparent"
                  )}
                  onClick={() => mode === "select" && toggleSelection(file)}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {mode === "select" && (
                      <div
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded border",
                          selectedFiles.has(file.id)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                        )}
                      >
                        {selectedFiles.has(file.id) && (
                          <Check className="h-3 w-3" />
                        )}
                      </div>
                    )}
                    <FileText className="h-5 w-5 flex-shrink-0 text-muted-foreground" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">
                        {file.original_filename}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatFileSize(file.size)}
                        {file.created_at && ` · ${formatDate(file.created_at)}`}
                      </p>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleDownload(file)}
                      className="p-1.5 rounded hover:bg-muted"
                      title="下载"
                      disabled={isDownloading === file.id}
                    >
                      {isDownloading === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(file)}
                      disabled={isDeleting === file.id}
                      className="p-1.5 rounded hover:bg-destructive/10"
                      title="删除"
                    >
                      {isDeleting === file.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4 text-destructive" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="flex items-center justify-between border-t pt-4">
          <div className="text-sm text-muted-foreground">
            {files.length} 个文件
            {mode === "select" && selectedFiles.size > 0 && (
              <span className="ml-2">· 已选择 {selectedFiles.size} 个</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {mode === "select" ? "取消" : "关闭"}
            </Button>
            {mode === "select" && (
              <Button
                onClick={handleConfirmSelection}
                disabled={selectedFiles.size === 0}
              >
                使用选中的文件
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
