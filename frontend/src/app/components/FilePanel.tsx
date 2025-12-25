"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  ChevronDown,
  ChevronRight,
  Download,
  Trash2,
  Copy,
  Check,
  FileText,
  Image as ImageIcon,
  Code,
  FolderOpen,
  X,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getConfig } from "@/lib/config";
import { Message } from "@langchain/langgraph-sdk";
import { useAuth } from "@/providers/AuthProvider";

// ============================================================================
// Types
// ============================================================================

// File types matching backend database schema
type FileType = "uploaded" | "generated" | "chart" | "code";

interface UploadedFile {
  filename: string;
  original_filename: string;
  storage_path: string;
  sandbox_path: string;
  size: number;
  created_at?: string;
}

interface GeneratedFile {
  filename: string;
  size: number;
  sandbox_path: string;
}

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

interface ImageInfo {
  url: string;
  alt: string;
  messageId?: string;
}

interface CodeSnippet {
  id: string;
  code: string;
  timestamp?: string;
  messageId?: string;
}

interface FilePanelProps {
  messages: Message[];
  threadId?: string; // Optional thread ID for thread-specific file queries
  onClose?: () => void;
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

function extractImagesFromMessages(messages: Message[]): ImageInfo[] {
  const images: ImageInfo[] = [];
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;

  messages.forEach((message) => {
    if (message.type === "ai" || message.type === "tool") {
      const content =
        typeof message.content === "string"
          ? message.content
          : Array.isArray(message.content)
            ? message.content
                .filter((c: any) => c.type === "text")
                .map((c: any) => c.text)
                .join("\n")
            : "";

      let match;
      while ((match = imageRegex.exec(content)) !== null) {
        const [, alt, url] = match;
        // Only include image URLs (not data URIs that are too long)
        if (url && !url.startsWith("data:") || (url.startsWith("data:") && url.length < 1000000)) {
          images.push({
            url,
            alt: alt || `Image`,
            messageId: message.id,
          });
        }
      }
    }
  });

  return images;
}

function extractCodeFromMessages(messages: Message[]): CodeSnippet[] {
  const codeSnippets: CodeSnippet[] = [];

  messages.forEach((message, index) => {
    if (message.type === "ai") {
      // Check tool_calls for execute_python
      const rawToolCalls = message.tool_calls || message.additional_kwargs?.tool_calls;
      const toolCalls: any[] = Array.isArray(rawToolCalls) ? rawToolCalls : [];

      toolCalls.forEach((tc: any, tcIndex: number) => {
        const name = tc.function?.name || tc.name || "";
        if (name === "execute_python") {
          const args = tc.function?.arguments || tc.args || tc.input || {};
          let code = "";

          if (typeof args === "string") {
            try {
              const parsed = JSON.parse(args);
              code = parsed.code || "";
            } catch {
              code = args;
            }
          } else if (typeof args === "object" && args.code) {
            code = args.code;
          }

          if (code) {
            codeSnippets.push({
              id: `${message.id}-${tcIndex}`,
              code,
              messageId: message.id,
            });
          }
        }
      });

      // Also check content array for tool_use blocks
      if (Array.isArray(message.content)) {
        message.content.forEach((block: any, blockIndex: number) => {
          if (block.type === "tool_use" && block.name === "execute_python") {
            const code = block.input?.code || "";
            if (code) {
              codeSnippets.push({
                id: `${message.id}-content-${blockIndex}`,
                code,
                messageId: message.id,
              });
            }
          }
        });
      }
    }
  });

  return codeSnippets;
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

function ImageItem({
  image,
  onDownload,
}: {
  image: ImageInfo;
  onDownload: () => void;
}) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await onDownload();
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="group relative rounded-md overflow-hidden border border-border hover:border-primary/50 transition-colors">
      <img
        src={image.url}
        alt={image.alt}
        className="w-full h-20 object-cover"
        loading="lazy"
      />
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
        <button
          onClick={handleDownload}
          disabled={isDownloading}
          className="p-1.5 rounded-full bg-white/90 hover:bg-white"
          title="Download"
        >
          {isDownloading ? (
            <Loader2 size={14} className="animate-spin text-gray-700" />
          ) : (
            <Download size={14} className="text-gray-700" />
          )}
        </button>
        <a
          href={image.url}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 rounded-full bg-white/90 hover:bg-white"
          title="Open in new tab"
        >
          <ExternalLink size={14} className="text-gray-700" />
        </a>
      </div>
    </div>
  );
}

function CodeItem({
  snippet,
  index,
}: {
  snippet: CodeSnippet;
  index: number;
}) {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(snippet.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([snippet.code], { type: "text/x-python" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `code_${index + 1}.py`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const previewCode = snippet.code.split("\n").slice(0, 3).join("\n");
  const hasMore = snippet.code.split("\n").length > 3;

  return (
    <div className="rounded-md border border-border overflow-hidden">
      <div className="flex items-center justify-between bg-muted/50 px-2 py-1">
        <span className="text-[10px] font-medium text-muted-foreground">
          Code #{index + 1}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1 rounded hover:bg-muted"
            title="Copy"
          >
            {copied ? (
              <Check size={12} className="text-green-500" />
            ) : (
              <Copy size={12} className="text-muted-foreground" />
            )}
          </button>
          <button
            onClick={handleDownload}
            className="p-1 rounded hover:bg-muted"
            title="Download as .py"
          >
            <Download size={12} className="text-muted-foreground" />
          </button>
        </div>
      </div>
      <div className="relative">
        <pre
          className={cn(
            "p-2 text-[10px] leading-relaxed overflow-x-auto bg-zinc-950 text-zinc-100",
            !expanded && hasMore && "max-h-16"
          )}
        >
          <code>{expanded ? snippet.code : previewCode}</code>
        </pre>
        {hasMore && !expanded && (
          <button
            onClick={() => setExpanded(true)}
            className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-zinc-950 to-transparent py-2 text-[10px] text-zinc-400 hover:text-zinc-200 text-center"
          >
            Show more...
          </button>
        )}
        {expanded && hasMore && (
          <button
            onClick={() => setExpanded(false)}
            className="w-full bg-zinc-900 py-1 text-[10px] text-zinc-400 hover:text-zinc-200 text-center border-t border-zinc-800"
          >
            Show less
          </button>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function FilePanel({ messages, threadId, onClose }: FilePanelProps) {
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

  // State - Legacy file storage (for backward compatibility)
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([]);

  // State - Database-driven files (new approach)
  const [dbUploadedFiles, setDbUploadedFiles] = useState<DatabaseFile[]>([]);
  const [dbGeneratedFiles, setDbGeneratedFiles] = useState<DatabaseFile[]>([]);
  const [dbChartFiles, setDbChartFiles] = useState<DatabaseFile[]>([]);
  const [useDbFiles, setUseDbFiles] = useState(false); // Whether DB API is available

  const [isLoadingUploaded, setIsLoadingUploaded] = useState(false);
  const [isLoadingGenerated, setIsLoadingGenerated] = useState(false);
  const [isLoadingCharts, setIsLoadingCharts] = useState(false);

  // Section open states
  const [uploadedOpen, setUploadedOpen] = useState(true);
  const [generatedOpen, setGeneratedOpen] = useState(true);
  const [imagesOpen, setImagesOpen] = useState(true);
  const [codeOpen, setCodeOpen] = useState(true);

  // Extract images and code from messages (fallback for when DB is not available)
  const messagesImages = useMemo(() => extractImagesFromMessages(messages), [messages]);
  const codeSnippets = useMemo(() => extractCodeFromMessages(messages), [messages]);

  // Use DB chart files if available, otherwise fallback to message extraction
  const images = useMemo(() => {
    if (useDbFiles && dbChartFiles.length > 0) {
      // Convert DB chart files to ImageInfo format
      return dbChartFiles.map((f) => ({
        url: f.download_url || "",
        alt: f.original_filename || f.filename,
        messageId: undefined,
      }));
    }
    return messagesImages;
  }, [useDbFiles, dbChartFiles, messagesImages]);

  // Fetch files by type from database API
  const fetchFilesByType = useCallback(async (fileType: FileType) => {
    if (!apiUrl) return [];
    try {
      const url = threadId
        ? `${apiUrl}/api/threads/${threadId}/files?file_type=${fileType}`
        : `${apiUrl}/api/files/by-type?file_type=${fileType}`;

      const response = await fetch(url, {
        headers: getAuthHeaders(),
      });
      if (response.ok) {
        const data = await response.json();
        return data.files || [];
      }
    } catch (error) {
      console.error(`Failed to fetch ${fileType} files from DB:`, error);
    }
    return [];
  }, [apiUrl, threadId, getAuthHeaders]);

  // Fetch uploaded files (try DB first, fallback to legacy)
  const fetchUploadedFiles = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoadingUploaded(true);
    try {
      // Try new DB API first
      const dbFiles = await fetchFilesByType("uploaded");
      if (dbFiles.length > 0) {
        setDbUploadedFiles(dbFiles);
        setUseDbFiles(true);
      } else {
        // Fallback to legacy API
        const response = await fetch(`${apiUrl}/files/list`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setUploadedFiles(data.files || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch uploaded files:", error);
      // Try legacy API as fallback
      try {
        const response = await fetch(`${apiUrl}/files/list`, {
          headers: getAuthHeaders(),
        });
        if (response.ok) {
          const data = await response.json();
          setUploadedFiles(data.files || []);
        }
      } catch (legacyError) {
        console.error("Legacy API also failed:", legacyError);
      }
    } finally {
      setIsLoadingUploaded(false);
    }
  }, [apiUrl, getAuthHeaders, fetchFilesByType]);

  // Fetch generated files (try DB first, fallback to legacy)
  const fetchGeneratedFiles = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoadingGenerated(true);
    try {
      // Try new DB API first
      const dbFiles = await fetchFilesByType("generated");
      if (dbFiles.length > 0) {
        setDbGeneratedFiles(dbFiles);
        setUseDbFiles(true);
      } else {
        // Fallback to legacy sandbox API
        const response = await fetch(`${apiUrl}/sandbox/files`);
        if (response.ok) {
          const data = await response.json();
          setGeneratedFiles(data.files || []);
        }
      }
    } catch (error) {
      console.error("Failed to fetch generated files:", error);
      // Try legacy API as fallback
      try {
        const response = await fetch(`${apiUrl}/sandbox/files`);
        if (response.ok) {
          const data = await response.json();
          setGeneratedFiles(data.files || []);
        }
      } catch (legacyError) {
        console.error("Legacy API also failed:", legacyError);
      }
    } finally {
      setIsLoadingGenerated(false);
    }
  }, [apiUrl, fetchFilesByType]);

  // Fetch chart files from DB
  const fetchChartFiles = useCallback(async () => {
    if (!apiUrl) return;
    setIsLoadingCharts(true);
    try {
      const dbFiles = await fetchFilesByType("chart");
      if (dbFiles.length > 0) {
        setDbChartFiles(dbFiles);
        setUseDbFiles(true);
      }
    } catch (error) {
      console.error("Failed to fetch chart files:", error);
    } finally {
      setIsLoadingCharts(false);
    }
  }, [apiUrl, fetchFilesByType]);

  // Initial fetch
  useEffect(() => {
    fetchUploadedFiles();
    fetchGeneratedFiles();
    fetchChartFiles();
  }, [fetchUploadedFiles, fetchGeneratedFiles, fetchChartFiles]);

  // Refresh when messages change (might have new generated files)
  useEffect(() => {
    if (messages.length > 0) {
      fetchGeneratedFiles();
      fetchChartFiles();
    }
  }, [messages.length, fetchGeneratedFiles, fetchChartFiles]);

  // Compute effective file lists (DB or legacy)
  const effectiveUploadedFiles = useMemo(() => {
    if (useDbFiles && dbUploadedFiles.length > 0) {
      return dbUploadedFiles.map((f) => ({
        filename: f.filename,
        original_filename: f.original_filename || f.filename,
        storage_path: f.storage_path || "",
        sandbox_path: `/home/user/data/${f.filename}`,
        size: f.size || 0,
        created_at: f.created_at,
        download_url: f.download_url,
      }));
    }
    return uploadedFiles;
  }, [useDbFiles, dbUploadedFiles, uploadedFiles]);

  const effectiveGeneratedFiles = useMemo(() => {
    if (useDbFiles && dbGeneratedFiles.length > 0) {
      return dbGeneratedFiles.map((f) => ({
        filename: f.filename,
        size: f.size || 0,
        sandbox_path: `/home/user/data/${f.filename}`,
        download_url: f.download_url,
      }));
    }
    return generatedFiles;
  }, [useDbFiles, dbGeneratedFiles, generatedFiles]);

  // Download handlers
  const handleDownloadUploaded = useCallback(
    async (file: UploadedFile) => {
      try {
        const response = await fetch(
          `${apiUrl}/files/download-url/${encodeURIComponent(file.filename)}`,
          { headers: getAuthHeaders() }
        );
        if (response.ok) {
          const data = await response.json();
          window.open(data.url, "_blank");
        }
      } catch (error) {
        console.error("Failed to download file:", error);
      }
    },
    [apiUrl, getAuthHeaders]
  );

  const handleDownloadGenerated = useCallback(
    (file: GeneratedFile) => {
      const url = `${apiUrl}/sandbox/files/${encodeURIComponent(file.filename)}`;
      window.open(url, "_blank");
    },
    [apiUrl]
  );

  const handleDeleteUploaded = useCallback(
    async (file: UploadedFile) => {
      try {
        const response = await fetch(
          `${apiUrl}/files/${encodeURIComponent(file.filename)}`,
          {
            method: "DELETE",
            headers: getAuthHeaders(),
          }
        );
        if (response.ok) {
          setUploadedFiles((prev) =>
            prev.filter((f) => f.filename !== file.filename)
          );
        }
      } catch (error) {
        console.error("Failed to delete file:", error);
      }
    },
    [apiUrl, getAuthHeaders]
  );

  const handleDownloadImage = useCallback(async (image: ImageInfo) => {
    try {
      const response = await fetch(image.url);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = image.alt || "figure.png";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Failed to download image:", error);
      window.open(image.url, "_blank");
    }
  }, []);

  // Refresh all file lists
  const handleRefresh = useCallback(() => {
    fetchUploadedFiles();
    fetchGeneratedFiles();
    fetchChartFiles();
  }, [fetchUploadedFiles, fetchGeneratedFiles, fetchChartFiles]);

  const totalItems =
    effectiveUploadedFiles.length + effectiveGeneratedFiles.length + images.length + codeSnippets.length;

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
              count={effectiveUploadedFiles.length}
              isOpen={uploadedOpen}
              onToggle={() => setUploadedOpen(!uploadedOpen)}
              icon={FileText}
            />
            {uploadedOpen && (
              <div className="px-1 py-1">
                {isLoadingUploaded ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : effectiveUploadedFiles.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No files uploaded yet
                  </p>
                ) : (
                  effectiveUploadedFiles.map((file) => (
                    <FileItem
                      key={file.filename}
                      filename={file.original_filename || file.filename}
                      size={file.size}
                      onDownload={() => handleDownloadUploaded(file as UploadedFile)}
                      onDelete={() => handleDeleteUploaded(file as UploadedFile)}
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
              count={effectiveGeneratedFiles.length}
              isOpen={generatedOpen}
              onToggle={() => setGeneratedOpen(!generatedOpen)}
              icon={FileText}
            />
            {generatedOpen && (
              <div className="px-1 py-1">
                {isLoadingGenerated ? (
                  <div className="flex items-center justify-center py-4">
                    <Loader2 size={16} className="animate-spin text-muted-foreground" />
                  </div>
                ) : effectiveGeneratedFiles.length === 0 ? (
                  <p className="px-3 py-2 text-xs text-muted-foreground">
                    No files generated yet
                  </p>
                ) : (
                  effectiveGeneratedFiles.map((file) => (
                    <FileItem
                      key={file.filename}
                      filename={file.filename}
                      size={file.size}
                      onDownload={() => handleDownloadGenerated(file as GeneratedFile)}
                    />
                  ))
                )}
              </div>
            )}
          </div>

          {/* Images Section */}
          <div className="mb-1">
            <SectionHeader
              title="Charts & Images"
              count={images.length}
              isOpen={imagesOpen}
              onToggle={() => setImagesOpen(!imagesOpen)}
              icon={ImageIcon}
            />
            {imagesOpen && (
              <div className="px-3 py-2">
                {images.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No charts generated yet
                  </p>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    {images.map((image, index) => (
                      <ImageItem
                        key={`${image.url}-${index}`}
                        image={image}
                        onDownload={() => handleDownloadImage(image)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Code History Section */}
          <div className="mb-1">
            <SectionHeader
              title="Code History"
              count={codeSnippets.length}
              isOpen={codeOpen}
              onToggle={() => setCodeOpen(!codeOpen)}
              icon={Code}
            />
            {codeOpen && (
              <div className="px-3 py-2 space-y-2">
                {codeSnippets.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    No code executed yet
                  </p>
                ) : (
                  codeSnippets.map((snippet, index) => (
                    <CodeItem
                      key={snippet.id}
                      snippet={snippet}
                      index={index}
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
          disabled={isLoadingUploaded || isLoadingGenerated || isLoadingCharts}
        >
          {isLoadingUploaded || isLoadingGenerated || isLoadingCharts ? (
            <Loader2 size={12} className="mr-2 animate-spin" />
          ) : null}
          Refresh
        </Button>
      </div>
    </div>
  );
}

FilePanel.displayName = "FilePanel";
