"use client";

import React, { useState } from "react";
import { ChevronDown, ChevronRight, Brain } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/app/components/MarkdownContent";

interface ThinkingBlockProps {
  /** The thinking content to display */
  content: string;
  /** Whether this is a redacted thinking block (signature only) */
  isRedacted?: boolean;
  /** Optional signature for redacted blocks */
  signature?: string;
  /** Whether to start expanded (default: true) */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * ThinkingBlock component displays AI thinking/reasoning content
 * in a collapsible block with distinctive styling.
 *
 * Supports:
 * - Regular thinking content (expandable)
 * - Redacted thinking (shows placeholder)
 * - Markdown rendering inside thinking blocks
 */
export function ThinkingBlock({
  content,
  isRedacted = false,
  signature,
  defaultExpanded = true,
  className,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  // For redacted thinking, show a placeholder message
  if (isRedacted) {
    return (
      <div
        className={cn(
          "my-2 rounded-lg border",
          "bg-gray-50 border-gray-200",
          "dark:bg-gray-800/50 dark:border-gray-700",
          className
        )}
      >
        <div className="flex items-center gap-2 px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
          <Brain className="h-4 w-4" />
          <span>思考过程已隐藏</span>
          {signature && (
            <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate max-w-[200px]">
              ({signature.slice(0, 16)}...)
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "my-2 rounded-lg border",
        "bg-gradient-to-r from-blue-50/80 to-indigo-50/80",
        "border-blue-200/60",
        "dark:from-blue-950/30 dark:to-indigo-950/30",
        "dark:border-blue-800/40",
        className
      )}
    >
      {/* Header - clickable to toggle */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2",
          "text-sm font-medium text-blue-700 dark:text-blue-300",
          "hover:bg-blue-100/50 dark:hover:bg-blue-900/30",
          "transition-colors duration-150",
          "rounded-t-lg",
          !isExpanded && "rounded-b-lg"
        )}
      >
        {isExpanded ? (
          <ChevronDown className="h-4 w-4 flex-shrink-0" />
        ) : (
          <ChevronRight className="h-4 w-4 flex-shrink-0" />
        )}
        <Brain className="h-4 w-4 flex-shrink-0" />
        <span>思考过程</span>
        {!isExpanded && (
          <span className="text-xs text-blue-500/70 dark:text-blue-400/70 truncate ml-2">
            {content.slice(0, 50)}...
          </span>
        )}
      </button>

      {/* Content - collapsible */}
      {isExpanded && (
        <div
          className={cn(
            "px-4 pb-3 pt-1",
            "text-sm text-gray-700 dark:text-gray-300",
            "border-t border-blue-200/40 dark:border-blue-800/30"
          )}
        >
          <MarkdownContent content={content} />
        </div>
      )}
    </div>
  );
}
