"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brain, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/app/components/MarkdownContent";

function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

// Helper to strip basic markdown for preview
function getPreviewText(content: string): string {
    return content
        .replace(/[#*`_[\]]/g, '') // remove markdown chars
        .replace(/\n/g, ' ')        // replace newlines with spaces
        .trim()
        .substring(0, 100);
}

interface ThinkingBlockProps {
    content: string;
    isRedacted?: boolean;
    signature?: string;
    isStreaming?: boolean;
    startTime?: number;
    duration?: number;
    defaultExpanded?: boolean;
    className?: string;
    hasDoctype?: boolean;
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
    // Default to collapsed unless explicitly told to expand (or streaming?)
    // User requested default collapsed showing preview
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);
    const [elapsed, setElapsed] = useState(0);
    const startRef = useRef(startTime || Date.now());

    // Timer logic
    useEffect(() => {
        if (isStreaming) {
            const interval = setInterval(() => {
                setElapsed(Date.now() - startRef.current);
            }, 1000);
            return () => clearInterval(interval);
        } else if (duration) {
            // If not streaming and duration provided, use it
            setElapsed(duration);
        }
    }, [isStreaming, duration]);


    // Update expanded state if defaultExpanded changes (e.g. streaming starts)
    useEffect(() => {
        if (defaultExpanded !== undefined) {
            // If streaming starts, maybe we want to expand? User said default collapsed.
            // "Default collapsed state... but see content"
            // So even if streaming, we might keep collapsed?
            // "Agent output first think... put at top."
            // Let's respect defaultExpanded.
            setIsExpanded(defaultExpanded);
        }
    }, [defaultExpanded]);

    // If redacted
    if (isRedacted) {
        return (
            <div className={cn("relative flex gap-4 font-sans", className)}>
                {/* Thread Line (Static Gray) */}
                <div className="absolute left-[11px] top-8 bottom-0 w-0.5 bg-zinc-200 dark:bg-zinc-800" />

                {/* Icon */}
                <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 dark:bg-zinc-800 ring-2 ring-background">
                    <Lock className="h-3.5 w-3.5 text-zinc-400" />
                </div>

                {/* Content */}
                <div className="flex-1 py-0.5">
                    <div className="flex items-center gap-2 text-sm text-zinc-500">
                        <span className="font-medium">Thinking Process Hidden</span>
                        {signature && <span className="font-mono text-xs opacity-70">({signature})</span>}
                    </div>
                </div>
            </div>
        );
    }

    const timeDisplay = isStreaming
        ? formatTime(elapsed)
        : (elapsed > 0 ? formatTime(elapsed) : null);

    const previewText = getPreviewText(content);

    return (
        <div className={cn("relative flex gap-3 font-sans group py-1", className)}>
            {/* Thread Line - With gradient animation support */}
            <div className="absolute left-[11px] top-0 bottom-0 w-[1px] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                {isStreaming && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-transparent via-violet-400 to-transparent opacity-50"
                        animate={{ translateY: ["-100%", "100%"] }}
                        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                    />
                )}
            </div>

            {/* Icon Area */}
            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center bg-white dark:bg-zinc-950">
                <motion.div
                    className={cn(
                        "flex h-4 w-4 items-center justify-center rounded-full transition-colors",
                        // Subtle pulsing background only when active
                        isStreaming ? "bg-violet-50 text-violet-500" : "bg-transparent text-zinc-400"
                    )}
                    animate={isStreaming ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Brain className="h-3.5 w-3.5" />
                </motion.div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                {/* Headers */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 py-1 text-[13px] hover:bg-zinc-50 dark:hover:bg-zinc-900/50 rounded-md px-2 -ml-2 transition-colors w-full text-left group/btn"
                >
                    <span className={cn(
                        "font-medium transition-colors shrink-0",
                        isStreaming ? "text-violet-600 dark:text-violet-400" : "text-zinc-600 dark:text-zinc-400"
                    )}>
                        {isStreaming ? "Thinking..." : "Thought Process"}
                    </span>

                    {timeDisplay && (
                        <span className="text-[11px] text-zinc-400 font-mono tracking-tight shrink-0">
                            {timeDisplay}
                        </span>
                    )}

                    {/* Preview Content (Visible when collapsed) */}
                    {!isExpanded && previewText && (
                        <span className="text-zinc-400 dark:text-zinc-500 truncate ml-2 font-normal opacity-80">
                            {previewText}
                        </span>
                    )}

                    <span className="ml-auto text-zinc-300 dark:text-zinc-600 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                        {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </span>
                </button>

                {/* Collapsible Content */}
                <AnimatePresence initial={false}>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                        >
                            <div className="pt-1 pb-2 pr-2 ml-1">
                                <div className="prose prose-sm dark:prose-invert max-w-none 
                                       text-zinc-600 dark:text-zinc-400 
                                       text-[13px] leading-relaxed
                                       bg-zinc-50/50 dark:bg-zinc-900/30 
                                       rounded-lg p-3 border border-zinc-100 dark:border-zinc-800/50 font-serif">
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
