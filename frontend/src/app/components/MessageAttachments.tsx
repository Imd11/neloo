"use client";

import { FileSpreadsheet, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedAttachment } from "@/lib/uploadedFilesAnnotation";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";
import { useQueryState } from "nuqs";
import { toast } from "sonner";
import { useCallback, useRef, useState } from "react";
import { useLanguage } from "@/providers/LanguageProvider";

interface MessageAttachmentsProps {
  attachments: ParsedAttachment[];
  className?: string;
}

/**
 * Message Attachments Component
 *
 * Displays file attachments as chips/cards in sent messages.
 * Reuses the same visual style as the input area file chips.
 * No delete button - these are read-only display of sent attachments.
 */
export function MessageAttachments({
  attachments,
  className,
}: MessageAttachmentsProps) {
  const hasAttachments = attachments?.length > 0;
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { session } = useAuth();
  const { t } = useLanguage();
  const [threadId] = useQueryState("threadId");
  const [downloading, setDownloading] = useState<string | null>(null);
  const threadFilesCache = useRef<{
    threadId: string;
    files: DatabaseFile[];
  } | null>(null);

  const getAuthHeaders = useCallback((): Record<string, string> => {
    return session?.access_token
      ? { Authorization: `Bearer ${session.access_token}` }
      : {};
  }, [session?.access_token]);

  const fetchThreadFiles = useCallback(async (): Promise<
    DatabaseFile[] | null
  > => {
    if (!apiUrl || !threadId) return null;
    if (!session?.access_token) return null;

    const cached = threadFilesCache.current;
    if (cached && cached.threadId === threadId) {
      return cached.files;
    }

    const resp = await fetch(
      `${apiUrl}/api/threads/${encodeURIComponent(threadId)}/files`,
      {
        headers: getAuthHeaders(),
      }
    );
    if (!resp.ok) return null;
    const data = await resp.json();
    const files = Array.isArray(data?.files)
      ? (data.files as DatabaseFile[])
      : [];
    threadFilesCache.current = { threadId, files };
    return files;
  }, [apiUrl, getAuthHeaders, session?.access_token, threadId]);

  const downloadFile = useCallback(
    async (attachment: ParsedAttachment) => {
      if (!session?.access_token) {
        toast.error(t("files.login_required"));
        return;
      }
      if (!apiUrl || !threadId) {
        toast.error(t("files.thread_not_ready"));
        return;
      }

      setDownloading(attachment.filename);
      try {
        const threadFiles = await fetchThreadFiles();
        if (!threadFiles || threadFiles.length === 0) {
          toast.message(t("files.file_associating"), {
            description: t("files.try_again"),
          });
          return;
        }

        const normalize = (s: string) => s.trim().toLowerCase();
        const target = normalize(attachment.filename);
        const match =
          threadFiles.find(
            (f) => normalize(f.original_filename || f.filename) === target
          ) || threadFiles.find((f) => normalize(f.filename) === target);

        if (!match?.id) {
          toast.message(t("files.file_associating"), {
            description: t("files.try_again"),
          });
          return;
        }

        const url = match.download_url
          ? match.download_url.startsWith("http")
            ? match.download_url
            : `${apiUrl}${match.download_url}`
          : `${apiUrl}/api/files/${encodeURIComponent(match.id)}/download`;

        const resp = await fetch(url, { headers: getAuthHeaders() });
        if (!resp.ok) {
          toast.error(t("files.download_failed"));
          return;
        }
        const blob = await resp.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = blobUrl;
        a.download = match.original_filename || match.filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(blobUrl);
      } catch (e) {
        toast.error(t("files.download_failed"), {
          description: e instanceof Error ? e.message : String(e),
        });
      } finally {
        setDownloading(null);
      }
    },
    [
      apiUrl,
      fetchThreadFiles,
      getAuthHeaders,
      session?.access_token,
      threadId,
      t,
    ]
  );

  if (!hasAttachments) {
    return null;
  }

  return (
    <div className={cn("mb-2 flex flex-wrap gap-2", className)}>
      {attachments.map((attachment, index) => (
        <AttachmentChip
          key={`${attachment.filename}-${index}`}
          attachment={attachment}
          isDownloading={downloading === attachment.filename}
          onDownload={downloadFile}
        />
      ))}
    </div>
  );
}

interface AttachmentChipProps {
  attachment: ParsedAttachment;
  isDownloading?: boolean;
  onDownload?: (attachment: ParsedAttachment) => void;
}

function AttachmentChip({
  attachment,
  isDownloading,
  onDownload,
}: AttachmentChipProps) {
  const { filename, type } = attachment;

  // Truncate filename if too long
  const maxNameLength = 25;
  const displayName =
    filename.length > maxNameLength
      ? `${filename.slice(0, maxNameLength - 3)}...`
      : filename;

  return (
    <button
      type="button"
      className={cn(
        "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs",
        "border border-green-500/50 bg-green-500/10",
        "cursor-pointer hover:bg-green-500/15"
      )}
      title={filename}
      onClick={() => onDownload?.(attachment)}
      disabled={isDownloading}
    >
      {/* File Icon */}
      {isDownloading ? (
        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-green-500" />
      ) : (
        <FileSpreadsheet className="h-3.5 w-3.5 flex-shrink-0 text-green-500" />
      )}

      {/* Filename */}
      <span className="max-w-[180px] truncate text-foreground">
        {displayName}
      </span>

      {/* Type (if available) */}
      {type && <span className="text-muted-foreground">({type})</span>}
    </button>
  );
}

export default MessageAttachments;

interface DatabaseFile {
  id: string;
  filename: string;
  original_filename?: string;
  download_url?: string;
}
