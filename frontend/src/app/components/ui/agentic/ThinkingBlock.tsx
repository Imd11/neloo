"use client";

import React, { useState, useEffect, useRef } from "react";
import { Brain, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/app/components/MarkdownContent";

interface ThinkingBlockProps {
    content: string;
    isRedacted?: boolean;
    signature?: string;
    isStreaming?: boolean;
    startTime?: number;
    defaultExpanded?: boolean;
    className?: string;
}

function formatTime(ms: number) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
}

export function ThinkingBlock({
    content,
    isRedacted = false,
    signature,
    isStreaming = false,
    startTime,
    defaultExpanded,
    className,
}: ThinkingBlockProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? isStreaming);
    const [elapsed, setElapsed] = useState(0);
    const startRef = useRef(startTime || Date.now());

    // Timer logic
    useEffect(() => {
        if (!isStreaming) return;
        const interval = setInterval(() => {
            setElapsed(Date.now() - startRef.current);
        }, 1000);
        return () => clearInterval(interval);
    }, [isStreaming]);

    // Auto-collapse when done, unless user interacted
    useEffect(() => {
        if (!isStreaming && defaultExpanded === undefined) {
            setIsExpanded(false);
        }
    }, [isStreaming, defaultExpanded]);

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

    return (
        <div className={cn("relative flex gap-4 font-sans group", className)}>
            {/* Thread Line */}
            {/* Active: Animated Gradient / Idle: Solid Gray */}
            <div className="absolute left-[11px] top-8 bottom-0 w-0.5 overflow-hidden bg-zinc-200 dark:bg-zinc-800">
                {isStreaming && (
                    <motion.div
                        className="absolute inset-0 bg-gradient-to-b from-violet-500 via-blue-500 to-cyan-500"
                        animate={{ translateY: ["-100%", "100%"] }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                    />
                )}
            </div>

            {/* Icon Area */}
            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center">
                <motion.div
                    className={cn(
                        "flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background transition-colors",
                        isStreaming ? "bg-violet-100 dark:bg-violet-900/30" : "bg-zinc-100 dark:bg-zinc-800"
                    )}
                    animate={isStreaming ? { opacity: [0.8, 1, 0.8], scale: [0.95, 1.05, 0.95] } : {}}
                    transition={{ duration: 2, repeat: Infinity }}
                >
                    <Brain className={cn(
                        "h-3.5 w-3.5",
                        isStreaming ? "text-violet-600 dark:text-violet-400" : "text-zinc-500 dark:text-zinc-400"
                    )} />
                </motion.div>
            </div>

            {/* Content Area */}
            <div className="flex-1 min-w-0">
                {/* Headers */}
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 py-0.5 text-sm hover:opacity-80 transition-opacity w-full text-left"
                >
                    <span className={cn(
                        "font-medium",
                        isStreaming ? "text-violet-600 dark:text-violet-400" : "text-zinc-600 dark:text-zinc-400"
                    )}>
                        {isStreaming ? "Thinking..." : "Thought Process"}
                    </span>

                    {timeDisplay && (
                        <span className="text-xs text-zinc-400 font-mono">({timeDisplay})</span>
                    )}

                    <span className="ml-auto text-zinc-400">
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
                            <div className="pt-2 pb-4 pr-4">
                                <div className="prose prose-sm dark:prose-invert max-w-none 
                                       text-zinc-600 dark:text-zinc-400 
                                       text-[13px] leading-relaxed
                                       bg-zinc-50/50 dark:bg-zinc-900/30 
                                       rounded-lg p-3 border border-zinc-100 dark:border-zinc-800/50">
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
