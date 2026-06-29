"use client";

import React, { useState, useEffect, useRef } from "react";
import { ChevronDown, ChevronRight, Sparkles, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { useLanguage } from "@/providers/LanguageProvider";

interface ThinkingBlockProps {
  /** The thinking content to display */
  content: string;
  /** Whether this is a redacted thinking block (signature only) */
  isRedacted?: boolean;
  /** Optional signature for redacted blocks */
  signature?: string;
  /** Whether the AI is still thinking (streaming) */
  isStreaming?: boolean;
  /** Start time for calculating elapsed time */
  startTime?: number;
  /** Whether to start expanded (default: false for completed, true for streaming) */
  defaultExpanded?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Format elapsed time in a human-readable format
 */
function formatThinkingTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Animated dots component for streaming state
 */
function AnimatedDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="animate-bounce-dot-1 h-1 w-1 rounded-full bg-current" />
      <span className="animate-bounce-dot-2 h-1 w-1 rounded-full bg-current" />
      <span className="animate-bounce-dot-3 h-1 w-1 rounded-full bg-current" />
    </span>
  );
}

/**
 * ThinkingBlock component displays AI thinking/reasoning content
 * with a premium design inspired by Claude, Kimi, and AnyGen.
 *
 * Features:
 * - Left thread line for visual continuity
 * - Animated streaming state with elapsed time
 * - Smooth expand/collapse with summary preview
 * - Markdown rendering for content
 */
export function ThinkingBlock({
  content,
  isRedacted = false,
  signature,
  isStreaming = false,
  startTime,
  defaultExpanded,
  className,
}: ThinkingBlockProps) {
  // Default: expanded when streaming, collapsed when complete
  const [isExpanded, setIsExpanded] = useState(
    defaultExpanded ?? isStreaming
  );
  const { t } = useLanguage();
  const [elapsedTime, setElapsedTime] = useState(0);
  const startTimeRef = useRef(startTime || Date.now());

  // Update elapsed time while streaming
  useEffect(() => {
    if (!isStreaming) return;

    const updateTime = () => {
      setElapsedTime(Date.now() - startTimeRef.current);
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, [isStreaming]);

  // Auto-collapse when streaming ends
  useEffect(() => {
    if (!isStreaming && defaultExpanded === undefined) {
      setIsExpanded(false);
    }
  }, [isStreaming, defaultExpanded]);

  // Calculate final time or current elapsed time
  const displayTime = isStreaming
    ? formatThinkingTime(elapsedTime)
    : elapsedTime > 0
    ? formatThinkingTime(elapsedTime)
    : null;

  // Get summary text for collapsed state
  const getSummary = () => {
    if (!content) return "";
    // Take first 60 chars, trim to last complete word
    const truncated = content.slice(0, 60);
    const lastSpace = truncated.lastIndexOf(" ");
    return lastSpace > 20 ? truncated.slice(0, lastSpace) + "..." : truncated + "...";
  };

  // For redacted thinking, show a placeholder message
  if (isRedacted) {
    return (
      <div className={cn("flex items-start gap-3", className)}>
        {/* Left thread line */}
        <div className="flex flex-col items-center">
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
            <Lock className="h-3 w-3 text-gray-400" />
          </div>
          <div className="w-0.5 flex-1 bg-gradient-to-b from-gray-200 to-transparent dark:from-gray-700" />
        </div>

        {/* Content */}
        <div className="flex-1 pb-4">
          <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
            <span>{t("thinking.redacted")}</span>
            {signature && (
              <span className="font-mono text-xs text-gray-400 dark:text-gray-500">
                ({signature.slice(0, 12)}...)
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn("flex items-start gap-3", className)}>
      {/* Left thread line with animated icon */}
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-6 w-6 items-center justify-center rounded-full transition-all duration-300",
            isStreaming
              ? "bg-violet-100 dark:bg-violet-900/50"
              : "bg-gray-100 dark:bg-gray-800"
          )}
        >
          <Sparkles
            className={cn(
              "h-3.5 w-3.5 transition-colors duration-300",
              isStreaming
                ? "text-violet-500 animate-pulse"
                : "text-gray-400 dark:text-gray-500"
            )}
          />
        </div>
        {/* Thread line - extends down */}
        <div
          className={cn(
            "w-0.5 flex-1 min-h-[16px] transition-colors duration-300",
            isStreaming
              ? "bg-gradient-to-b from-violet-300 to-transparent dark:from-violet-700"
              : "bg-gradient-to-b from-gray-200 to-transparent dark:from-gray-700"
          )}
        />
      </div>

      {/* Main content area */}
      <div className="flex-1 pb-4 min-w-0">
        {/* Header - clickable to toggle */}
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "group flex w-full items-center gap-2 text-left",
            "transition-colors duration-150"
          )}
        >
          {/* Status text */}
          <span
            className={cn(
              "text-sm font-medium transition-colors duration-300",
              isStreaming
                ? "text-violet-600 dark:text-violet-400"
                : "text-gray-600 dark:text-gray-400"
            )}
          >
            {isStreaming ? (
              <span className="flex items-center gap-1.5">
                {t("thinking.thinking")}
                <AnimatedDots />
              </span>
            ) : (
              t("thinking.completed")
            )}
          </span>

          {/* Time display */}
          {displayTime && (
            <span className="text-xs text-gray-400 dark:text-gray-500">
              · {displayTime}
            </span>
          )}

          {/* Expand/collapse indicator */}
          <span className="ml-auto flex items-center text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300 transition-colors">
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </span>
        </button>

        {/* Summary preview when collapsed */}
        {!isExpanded && content && (
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400 line-clamp-1">
            {getSummary()}
          </p>
        )}

        {/* Expanded content */}
        {isExpanded && content && (
          <div
            className={cn(
              "mt-3 rounded-lg p-4",
              "bg-gray-50/80 dark:bg-gray-800/50",
              "border border-gray-200/60 dark:border-gray-700/60",
              "text-sm text-gray-700 dark:text-gray-300"
            )}
          >
            <MarkdownContent content={content} />
          </div>
        )}
      </div>
    </div>
  );
}
