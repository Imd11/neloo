"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Lightbulb,
  Loader2,
  ChevronDown,
  ChevronRight,
  Lock,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { useLanguage } from "@/providers/LanguageProvider";

interface ThinkingBlockProps {
  content: string;
  isRedacted?: boolean;
  signature?: string;
  isStreaming?: boolean;
  startTime?: number;
  /** Thinking duration in milliseconds. */
  duration?: number;
  defaultExpanded?: boolean;
  className?: string;
  hasDoctype?: boolean;
}

function formatDuration(ms: number): string {
  const safeMs = Math.max(0, Math.floor(ms));
  const totalSeconds = Math.max(1, Math.floor(safeMs / 1000));

  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`;
}

export function ThinkingBlock({
  content,
  isRedacted = false,
  signature,
  isStreaming = false,
  startTime,
  duration,
  defaultExpanded,
  className,
}: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
  const { t } = useLanguage();
  const [elapsedMs, setElapsedMs] = useState(0);
  const startRef = useRef<number | null>(null);
  const frozenRef = useRef<number | null>(null);

  // Timer logic
  useEffect(() => {
    if (isStreaming) {
      // Capture start time once
      if (!startRef.current) {
        startRef.current = startTime || Date.now();
      }
      frozenRef.current = null;
      const tick = () => {
        const ms = Date.now() - (startRef.current || Date.now());
        setElapsedMs(Math.max(0, ms));
      };
      tick();
      const id = setInterval(tick, 1000);
      return () => clearInterval(id);
    } else {
      // Streaming just ended — freeze the value
      if (duration != null) {
        frozenRef.current = Math.max(0, Math.round(duration));
      } else if (startRef.current && !frozenRef.current) {
        frozenRef.current = Math.max(0, Date.now() - startRef.current);
      }
      if (frozenRef.current != null) {
        setElapsedMs(frozenRef.current);
      }
    }
  }, [isStreaming, startTime, duration]);

  // Auto-expand when streaming, collapse when done
  useEffect(() => {
    if (isStreaming) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isStreaming]);

  // Respect explicit defaultExpanded
  useEffect(() => {
    if (defaultExpanded && !isStreaming) {
      setIsExpanded(true);
    }
  }, [defaultExpanded, isStreaming]);

  const shouldShowTimer = elapsedMs >= 1000 || (!isStreaming && elapsedMs > 0);
  const statusLabel = isStreaming
    ? t("thinking.thinking")
    : shouldShowTimer
    ? t("thinking.duration")
    : t("thinking.content");

  // Redacted thinking - simple inline indicator
  if (isRedacted) {
    return (
      <div className={cn("py-0.5 font-sans", className)}>
        <div
          className="inline-flex items-center gap-2 rounded-full border border-zinc-200/80 bg-zinc-200/70
                               px-3 py-1
                               text-[13px] dark:border-zinc-800/50 dark:bg-zinc-900/50"
        >
          <Lock className="h-3.5 w-3.5 text-zinc-500" />
          <span className="font-normal text-zinc-500 dark:text-zinc-400">
            {t("thinking.redacted")}
          </span>
          {signature && (
            <span className="font-mono text-[11px] text-zinc-400 opacity-70">
              ({signature.slice(0, 12)}...)
            </span>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn("py-0.5 font-sans", className)}>
      {/* Capsule Button - identical structure to ToolStep */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group/capsule inline-flex items-center gap-2 rounded-full border border-zinc-200/80
                           bg-zinc-200/70 px-3
                           py-1 text-[13px] transition-colors
                           hover:bg-zinc-300/60 dark:border-zinc-800/50
                           dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50"
      >
        {/* Icon */}
        {isStreaming ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        ) : (
          <Lightbulb className="h-3.5 w-3.5 text-zinc-500" />
        )}

        {/* Text Content */}
        <span className="text-[13px] font-normal text-zinc-500 dark:text-zinc-300">
          {statusLabel}
        </span>

        {/* Timer */}
        {shouldShowTimer && (
          <span className="text-[12px] font-normal tabular-nums text-zinc-400 dark:text-zinc-500">
            {formatDuration(elapsedMs)}
          </span>
        )}

        {/* Chevron */}
        <span className="text-zinc-400 dark:text-zinc-500">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </span>
      </button>

      {/* Expanded Content */}
      <div className="ml-1">
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-2 pl-2 pr-2 pt-1">
                <div
                  className="prose prose-sm dark:prose-invert max-w-none
                                       font-serif text-[13px]
                                       leading-relaxed text-zinc-600
                                       dark:text-zinc-400"
                >
                  <MarkdownContent content={content} />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
