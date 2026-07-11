"use client";

import React, { useMemo, useCallback, useState, useEffect } from "react";
import {
  FileText,
  Copy,
  Download,
  Edit,
  Save,
  X,
  Loader2,
  Image as ImageIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { toast } from "sonner";
import { MarkdownContent } from "@/app/components/MarkdownContent";

const LANGUAGE_MAP: Record<string, string> = {
  js: "javascript",
  jsx: "javascript",
  ts: "typescript",
  tsx: "typescript",
  py: "python",
  rb: "ruby",
  go: "go",
  rs: "rust",
  java: "java",
  cpp: "cpp",
  c: "c",
  cs: "csharp",
  php: "php",
  swift: "swift",
  kt: "kotlin",
  scala: "scala",
  sh: "bash",
  bash: "bash",
  zsh: "bash",
  json: "json",
  xml: "xml",
  html: "html",
  css: "css",
  scss: "scss",
  sass: "sass",
  less: "less",
  sql: "sql",
  yaml: "yaml",
  yml: "yaml",
  toml: "toml",
  ini: "ini",
  dockerfile: "dockerfile",
  makefile: "makefile",
  csv: "csv",
  txt: "text",
  md: "markdown",
  markdown: "markdown",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp"];

export interface FilePreviewData {
  id: string;
  filename: string;
  content?: string;
  downloadUrl?: string;
  mimeType?: string;
  size?: number;
  isLoading?: boolean;
}

interface FilePreviewDialogProps {
  file: FilePreviewData | null;
  open: boolean;
  onClose: () => void;
  onSave?: (fileId: string, content: string) => Promise<void>;
  editDisabled?: boolean;
}

export const FilePreviewDialog = React.memo<FilePreviewDialogProps>(
  ({ file, open, onClose, onSave, editDisabled = true }) => {
    const [isEditingMode, setIsEditingMode] = useState(false);
    const [editedContent, setEditedContent] = useState("");
    const [isSaving, setIsSaving] = useState(false);

    // Reset state when file changes
    useEffect(() => {
      if (file) {
        setEditedContent(file.content || "");
        setIsEditingMode(false);
      }
    }, [file]);

    const fileExtension = useMemo(() => {
      if (!file?.filename) return "";
      return file.filename.split(".").pop()?.toLowerCase() || "";
    }, [file?.filename]);

    const isImage = useMemo(() => {
      return IMAGE_EXTENSIONS.includes(fileExtension);
    }, [fileExtension]);

    const isMarkdown = useMemo(() => {
      return fileExtension === "md" || fileExtension === "markdown";
    }, [fileExtension]);

    const language = useMemo(() => {
      return LANGUAGE_MAP[fileExtension] || "text";
    }, [fileExtension]);

    const handleCopy = useCallback(() => {
      const content = isEditingMode ? editedContent : file?.content;
      if (content) {
        navigator.clipboard.writeText(content);
        toast.success("Copied to clipboard");
      }
    }, [file?.content, editedContent, isEditingMode]);

    const handleDownload = useCallback(() => {
      if (!file) return;

      // If we have a download URL, use it
      if (file.downloadUrl) {
        const a = document.createElement("a");
        a.href = file.downloadUrl;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }

      // Otherwise, create blob from content
      if (file.content) {
        const blob = new Blob([file.content], {
          type: file.mimeType || "text/plain",
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }
    }, [file]);

    const handleEdit = useCallback(() => {
      if (file?.content) {
        setEditedContent(file.content);
        setIsEditingMode(true);
      }
    }, [file?.content]);

    const handleCancel = useCallback(() => {
      setEditedContent(file?.content || "");
      setIsEditingMode(false);
    }, [file?.content]);

    const handleSave = useCallback(async () => {
      if (!file || !onSave) return;

      setIsSaving(true);
      try {
        await onSave(file.id, editedContent);
        setIsEditingMode(false);
        toast.success("File saved");
      } catch (error) {
        toast.error(`Failed to save file: ${error}`);
      } finally {
        setIsSaving(false);
      }
    }, [file, editedContent, onSave]);

    if (!file) return null;

    return (
      <Dialog
        open={open}
        onOpenChange={(open) => !open && onClose()}
      >
        <DialogContent className="flex h-[80vh] max-h-[80vh] min-w-[60vw] flex-col p-6">
          <DialogTitle className="sr-only">{file.filename}</DialogTitle>

          {/* Header */}
          <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
            <div className="flex min-w-0 items-center gap-2">
              {isImage ? (
                <ImageIcon className="text-primary/50 h-5 w-5 shrink-0" />
              ) : (
                <FileText className="text-primary/50 h-5 w-5 shrink-0" />
              )}
              <span className="overflow-hidden text-ellipsis whitespace-nowrap text-base font-medium text-primary">
                {file.filename}
              </span>
              {file.size !== undefined && (
                <span className="text-xs text-muted-foreground">
                  ({formatFileSize(file.size)})
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {!isEditingMode && !isImage && (
                <>
                  {!editDisabled && onSave && (
                    <Button
                      onClick={handleEdit}
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2"
                      disabled={file.isLoading}
                    >
                      <Edit
                        size={16}
                        className="mr-1"
                      />
                      Edit
                    </Button>
                  )}
                  <Button
                    onClick={handleCopy}
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
                    disabled={file.isLoading || !file.content}
                  >
                    <Copy
                      size={16}
                      className="mr-1"
                    />
                    Copy
                  </Button>
                </>
              )}
              <Button
                onClick={handleDownload}
                variant="ghost"
                size="sm"
                className="h-8 px-2"
                disabled={file.isLoading}
              >
                <Download
                  size={16}
                  className="mr-1"
                />
                Download
              </Button>
            </div>
          </div>

          {/* Content */}
          <div className="min-h-0 flex-1 overflow-hidden">
            {file.isLoading ? (
              <div className="flex h-full items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : isEditingMode ? (
              <Textarea
                value={editedContent}
                onChange={(e) => setEditedContent(e.target.value)}
                placeholder="Enter file content..."
                className="h-full min-h-[400px] resize-none font-mono text-sm"
              />
            ) : isImage ? (
              <div className="flex h-full items-center justify-center rounded-md bg-muted/30">
                <img
                  src={
                    file.downloadUrl ||
                    `data:${file.mimeType};base64,${file.content}`
                  }
                  alt={file.filename}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <ScrollArea className="bg-surface h-full rounded-md">
                <div className="p-4">
                  {file.content ? (
                    isMarkdown ? (
                      <div className="rounded-md p-6">
                        <MarkdownContent content={file.content} />
                      </div>
                    ) : (
                      <SyntaxHighlighter
                        language={language}
                        style={oneDark}
                        customStyle={{
                          margin: 0,
                          borderRadius: "0.5rem",
                          fontSize: "0.875rem",
                        }}
                        showLineNumbers
                        wrapLines={true}
                        lineProps={{
                          style: {
                            whiteSpace: "pre-wrap",
                          },
                        }}
                      >
                        {file.content}
                      </SyntaxHighlighter>
                    )
                  ) : (
                    <div className="flex items-center justify-center p-12">
                      <p className="text-sm text-muted-foreground">
                        File content not available
                      </p>
                    </div>
                  )}
                </div>
              </ScrollArea>
            )}
          </div>

          {/* Edit Mode Footer */}
          {isEditingMode && (
            <div className="mt-4 flex justify-end gap-2 border-t border-border pt-4">
              <Button
                onClick={handleCancel}
                variant="outline"
                size="sm"
              >
                <X
                  size={16}
                  className="mr-1"
                />
                Cancel
              </Button>
              <Button
                onClick={handleSave}
                size="sm"
                disabled={isSaving || !editedContent.trim()}
              >
                {isSaving ? (
                  <Loader2
                    size={16}
                    className="mr-1 animate-spin"
                  />
                ) : (
                  <Save
                    size={16}
                    className="mr-1"
                  />
                )}
                Save
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    );
  }
);

FilePreviewDialog.displayName = "FilePreviewDialog";

function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}
