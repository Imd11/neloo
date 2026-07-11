"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { MessageAttachments } from "@/app/components/MessageAttachments";
import type { ParsedAttachment } from "@/lib/uploadedFilesAnnotation";

interface UserMessageBubbleProps {
  /** The text content to display */
  content: string;
  /** Optional message id for scroll anchoring */
  messageId?: string;
  /** Optional file attachments to display above the bubble */
  attachments?: ParsedAttachment[];
  /** Optional action buttons (copy, edit, etc.) to display beside the bubble */
  actions?: React.ReactNode;
  /** Whether the bubble is currently hovered (for action button visibility) */
  isHovered?: boolean;
  /** Mouse enter handler for hover state management */
  onMouseEnter?: () => void;
  /** Mouse leave handler for hover state management */
  onMouseLeave?: () => void;
  /** Additional className for the outer container */
  className?: string;
}

/**
 * UserMessageBubble - Shared component for rendering user messages
 *
 * This component ensures consistent styling for user messages across:
 * - ChatMessage.tsx (Legacy bubble mode)
 * - HierarchicalTaskView.tsx (Manus-style task view)
 *
 * Key styling features:
 * - Right-aligned (flex-row-reverse)
 * - Max width 70%
 * - Rounded bubble with border
 * - Background color from CSS variable
 */
export const UserMessageBubble = React.memo<UserMessageBubbleProps>(
  ({
    content,
    messageId,
    attachments,
    actions,
    isHovered,
    onMouseEnter,
    onMouseLeave,
    className,
  }) => {
    const hasContent = content && content.trim() !== "";
    const hasAttachments = attachments && attachments.length > 0;

    if (!hasContent && !hasAttachments) {
      return null;
    }

    return (
      <div
        className={cn(
          "group flex w-full max-w-full overflow-x-hidden",
          "flex-row-reverse", // Right-align user messages
          className
        )}
        data-message-id={messageId}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <div className="min-w-0 max-w-[70%]">
          {/* Attachment chips outside the bubble */}
          {hasAttachments && (
            <div className="mt-4 flex justify-end">
              <MessageAttachments attachments={attachments!} />
            </div>
          )}

          {/* Message bubble with optional actions */}
          {hasContent && (
            <div className="relative">
              <div className="flex flex-row-reverse items-end gap-2">
                <div
                  className="mt-2 overflow-hidden break-words rounded-xl rounded-br-none border border-border px-3 py-2 text-sm font-normal leading-[150%] text-foreground"
                  style={{ backgroundColor: "hsl(var(--input-bg))" }}
                >
                  <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                    {content}
                  </p>
                </div>
                {/* Action buttons slot */}
                {actions}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }
);

UserMessageBubble.displayName = "UserMessageBubble";

export default UserMessageBubble;
