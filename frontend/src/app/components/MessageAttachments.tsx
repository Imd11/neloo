"use client";

import { FileSpreadsheet } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ParsedAttachment } from "@/lib/uploadedFilesAnnotation";

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
  if (!attachments || attachments.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-2 mb-2", className)}>
      {attachments.map((attachment, index) => (
        <AttachmentChip key={`${attachment.filename}-${index}`} attachment={attachment} />
      ))}
    </div>
  );
}

interface AttachmentChipProps {
  attachment: ParsedAttachment;
}

function AttachmentChip({ attachment }: AttachmentChipProps) {
  const { filename, type } = attachment;

  // Truncate filename if too long
  const maxNameLength = 25;
  const displayName =
    filename.length > maxNameLength
      ? `${filename.slice(0, maxNameLength - 3)}...`
      : filename;

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs",
        "bg-green-500/10 border border-green-500/50"
      )}
      title={filename}
    >
      {/* File Icon */}
      <FileSpreadsheet className="h-3.5 w-3.5 text-green-500 flex-shrink-0" />

      {/* Filename */}
      <span className="text-foreground truncate max-w-[180px]">
        {displayName}
      </span>

      {/* Type (if available) */}
      {type && (
        <span className="text-muted-foreground">
          ({type})
        </span>
      )}
    </div>
  );
}

export default MessageAttachments;
