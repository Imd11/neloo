"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  FileText,
  FolderOpen,
  X,
  Loader2,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { getConfig } from "@/lib/config";
import { Message } from "@langchain/langgraph-sdk";
import { useAuth } from "@/providers/AuthProvider";

// ============================================================================
// Types
// ============================================================================

// File types matching backend database schema
type FileType = "uploaded" | "generated" | "chart" | "code";

// Database-driven file info (from /api/files/by-type endpoint)
interface DatabaseFile {
  id: string;
  filename: string;
  original_filename?: string;
  file_type: FileType;
  storage_path?: string;
  download_url?: string;
  size?: number;
  mime_type?: string;
  created_at: string;
}

interface FilePanelProps {
  messages: Message[];
  threadId?: string; // Optional thread ID for thread-specific file queries
  onClose?: () => void;
  compact?: boolean;
  isStreamComplete?: boolean; // True when stream finishes (agent done)
}

// ============================================================================
// Helper Functions
// ============================================================================

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

// ============================================================================
// Section Components
// ============================================================================

function SectionHeader({
  title,
  count,
  isOpen,
  onToggle,
  icon: Icon,
}: {
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: () => void;
  icon: React.ElementType;
}) {
  return (
    <button
      onClick={onToggle}
      className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-muted/50 transition-colors"
    >
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-muted-foreground" />
        <span className="text-xs font-medium">{title}</span>
        {count > 0 && (
          <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary/10 px-1.5 text-[10px] font-medium text-primary">
            {count}
          </span>
        )}
      </div>
      {isOpen ? (
        <ChevronDown size={14} className="text-muted-foreground" />
      ) : (
        <ChevronRight size={14} className="text-muted-foreground" />
      )}
    </button>
  );
}

function FileItem({
  filename,
  size,
  onDownload,
  onDelete,
  isLoading,
}: {
  filename: string;
  size?: number;
  onDownload: () => void;
  onDelete?: () => void;
  isLoading?: boolean;
}) {
  return (
    <div className="group flex items-center justify-between gap-2 rounded-md px-3 py-1.5 hover:bg-muted/50 transition-colors">
      <div className="flex items-center gap-2 min-w-0 flex-1">
        <FileText size={14} className="text-muted-foreground flex-shrink-0" />
        <span className="text-xs truncate">{filename}</span>
        {size !== undefined && (
          <span className="text-[10px] text-muted-foreground flex-shrink-0">
            {formatFileSize(size)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={onDownload}
          disabled={isLoading}
          className="p-1 rounded hover:bg-muted"
          title="Download"
        >
          {isLoading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            <Download size={12} className="text-muted-foreground" />
          )}
        </button>
        {onDelete && (
          <button
            onClick={onDelete}
            className="p-1 rounded hover:bg-destructive/10"
            title="Delete"
          >
            <Trash2 size={12} className="text-destructive" />
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FilePanel({ messages, threadId, onClose, isStreamComplete }: FilePanelProps) {
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { session } = useAuth();

  // Helper to get auth headers
  const getAuthHeaders = useCallback((): Record<string, string> => {
    if (session?.access_token) {
      return { Authorization: `Bearer ${session.access_token}` };
    }
    return { "X-User-Id": "default" };
  }, [session]);

  // DB-authoritative files for THIS thread only (thread_files JOIN files)
  const [dbFiles, setDbFiles] = useState<DatabaseFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Section open states
  const [uploadedOpen, setUploadedOpen] = useState(true);
  const [generatedOpen, setGeneratedOpen] = useState(true);
  const [chartsOpen, setChartsOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(true);

  const fetchThreadFiles = useCallback(async () => {
    if (!apiUrl || !threadId) {
      setDbFiles([]);
      return;
    }
    setIsLoading(true);
    try {
      const response = await fetch(`${apiUrl}/api/threads/${threadId}/files`, {
        headers: getAuthHeaders(),
      });
      if (!response.ok) {
        setDbFiles([]);
        return;
      }
      const data = await response.json();
      setDbFiles(data.files || []);
    } catch (error) {
      console.error("Failed to fetch thread files:", error);
      setDbFiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [apiUrl, threadId, getAuthHeaders]);

  // Initial fetch
  useEffect(() => {
    fetchThreadFiles();
  }, [fetchThreadFiles]);

  // Refresh when messages change (might have new generated files)
  // Use a short delay for a second refresh to catch DB writes that happen after message is sent
  useEffect(() => {
    if (messages.length > 0) {
      fetchThreadFiles();
      // Second refresh after 1 second to catch any delayed DB writes (e.g., from commitFiles)
      const delayedRefresh = setTimeout(() => {
        fetchThreadFiles();
      }, 1000);
      return () => clearTimeout(delayedRefresh);
    }
  }, [messages.length, fetchThreadFiles]);

  // Refresh when stream completes (agent finished generating files)
  useEffect(() => {
    if (isStreamComplete) {
      fetchThreadFiles();
    }
  }, [isStreamComplete, fetchThreadFiles]);

  const grouped = useMemo(() => {
    const uploaded: DatabaseFile[] = [];
    const generated: DatabaseFile[] = [];
    const chart: DatabaseFile[] = [];
    const code: DatabaseFile[] = [];
    for (const f of dbFiles) {
      if (f.file_type === "uploaded") uploaded.push(f);
      else if (f.file_type === "generated") generated.push(f);
      else if (f.file_type === "chart") chart.push(f);
      else if (f.file_type === "code") code.push(f);
    }
    return { uploaded, generated, chart, code };
  }, [dbFiles]);

  const downloadDbFile = useCallback(
    async (file: { id?: string; download_url?: string; filename: string; original_filename?: string }) => {
      if (!apiUrl) return;
      const url = file.download_url
        ? file.download_url.startsWith("http")
          ? file.download_url
          : `${apiUrl}${file.download_url}`
        : file.id
          ? `${apiUrl}/api/files/${encodeURIComponent(file.id)}/download`
          : "";
      if (!url) return;
      const response = await fetch(url, { headers: getAuthHeaders() });
      if (!response.ok) return;
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = file.original_filename || file.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    },
    [apiUrl, getAuthHeaders]
  );

  const unlinkFromThread = useCallback(
    async (fileId: string) => {
      if (!apiUrl || !threadId) return;
      const response = await fetch(
        `${apiUrl}/api/threads/${encodeURIComponent(threadId)}/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE", headers: getAuthHeaders() }
      );
      if (response.ok) {
        setDbFiles((prev) => prev.filter((f) => f.id !== fileId));
      }
    },
    [apiUrl, threadId, getAuthHeaders]
  );

  // Refresh all file lists
  const handleRefresh = useCallback(() => {
    fetchThreadFiles();
  }, [fetchThreadFiles]);

  const totalItems = dbFiles.length;

  return (
    <div className="flex h-full flex-col border-l border-border bg-background">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          <FolderOpen size={16} className="text-muted-foreground" />
          <span className="text-sm font-medium">Files & Code</span>
          {totalItems > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-medium text-primary-foreground">
              {totalItems}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-muted"
            title="Close panel"
          >
            <X size={16} className="text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Content */}
      <ScrollArea className="flex-1">
        <div className="py-2">
          {/* Uploaded Files Section */}
          <div className="mb-1">
            <SectionHeader
              title="Uploaded Files"
              count={grouped.uploaded.length}
              isOpen={uploadedOpen}
              onToggle={() => setUploadedOpen(!uploadedOpen)}
              icon={FileText}
            />
            {uploadedOpen && (
              <div className="px-1 py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : !threadId ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No thread selected
                  </p>
                ) : grouped.uploaded.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No files uploaded yet
                  </p>
                ) : (
                  grouped.uploaded.map((file) => (
                    <FileItem
                      key={file.id}
                      filename={file.original_filename || file.filename}
                      size={file.size}
                      onDownload={() => downloadDbFile(file)}
                      onDelete={
                        threadId
                          ? () => unlinkFromThread(file.id)
                          : undefined
                      }
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Generated Files Section */}
          <div className="mb-1">
            <SectionHeader
              title="Generated Files"
              count={grouped.generated.length}
              isOpen={generatedOpen}
              onToggle={() => setGeneratedOpen(!generatedOpen)}
              icon={FileText}
            />
            {generatedOpen && (
              <div className="px-1 py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : !threadId ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No thread selected
                  </p>
                ) : grouped.generated.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No files generated yet
                  </p>
                ) : (
                  grouped.generated.map((file) => (
                    <FileItem
                      key={file.id}
                      filename={file.filename}
                      size={file.size}
                      onDownload={() => downloadDbFile(file)}
                      onDelete={threadId ? () => unlinkFromThread(file.id) : undefined}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Charts Section */}
          <div className="mb-1">
            <SectionHeader
              title="Charts"
              count={grouped.chart.length}
              isOpen={chartsOpen}
              onToggle={() => setChartsOpen(!chartsOpen)}
              icon={FileText}
            />
            {chartsOpen && (
              <div className="px-1 py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : !threadId ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No thread selected
                  </p>
                ) : grouped.chart.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No charts generated yet
                  </p>
                ) : (
                  grouped.chart.map((file) => (
                    <FileItem
                      key={file.id}
                      filename={file.original_filename || file.filename}
                      size={file.size}
                      onDownload={() => downloadDbFile(file)}
                      onDelete={threadId ? () => unlinkFromThread(file.id) : undefined}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Code History Section */}
          <div className="mb-1">
            <SectionHeader
              title="Code"
              count={grouped.code.length}
              isOpen={codeOpen}
              onToggle={() => setCodeOpen(!codeOpen)}
              icon={FileText}
            />
            {codeOpen && (
              <div className="px-1 py-1">
                {isLoading ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : !threadId ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No thread selected
                  </p>
                ) : grouped.code.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No code saved yet
                  </p>
                ) : (
                  grouped.code.map((file) => (
                    <FileItem
                      key={file.id}
                      filename={file.original_filename || file.filename}
                      size={file.size}
                      onDownload={() => downloadDbFile(file)}
                      onDelete={threadId ? () => unlinkFromThread(file.id) : undefined}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </ScrollArea>

      {/* Refresh Button */}
      <div className="border-t border-border p-2">
        <Button
          variant="outline"
          size="sm"
          className="w-full text-xs"
          onClick={handleRefresh}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 size={12} className="mr-2 animate-spin" />
          ) : null}
          Refresh
        </Button>
      </div>
    </div>
  );
}

FilePanel.displayName = "FilePanel";
