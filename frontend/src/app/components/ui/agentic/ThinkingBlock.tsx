"use client";

import React, { useState, useEffect, useRef } from "react";
import { Lightbulb, Loader2, ChevronDown, ChevronRight, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { MarkdownContent } from "@/app/components/MarkdownContent";

// Helper to strip basic markdown for preview
function getPreviewText(content: string): string {
    return content
        .replace(/[#*`_[\]]/g, '')
        .replace(/\n/g, ' ')
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
    const [isExpanded, setIsExpanded] = useState(defaultExpanded ?? false);

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
    }, [defaultExpanded]);

    // Redacted thinking - simple inline indicator
    if (isRedacted) {
        return (
            <div className={cn("font-sans py-0.5", className)}>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[13px]
                               bg-zinc-200/70 dark:bg-zinc-900/50
                               border border-zinc-200/80 dark:border-zinc-800/50">
                    <Lock className="h-3.5 w-3.5 text-zinc-500" />
                    <span className="text-zinc-500 dark:text-zinc-400 font-normal">思考过程已隐藏</span>
                    {signature && (
                        <span className="font-mono text-[11px] text-zinc-400 opacity-70">
                            ({signature.slice(0, 12)}...)
                        </span>
                    )}
                </div>
            </div>
        );
    }

    const previewText = getPreviewText(content);

    return (
        <div className={cn("font-sans py-0.5", className)}>
            {/* Capsule Button - identical structure to ToolStep */}
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-[13px]
                           bg-zinc-200/70 dark:bg-zinc-900/50
                           border border-zinc-200/80 dark:border-zinc-800/50
                           hover:bg-zinc-300/60 dark:hover:bg-zinc-800/50
                           transition-colors group/capsule"
            >
                {/* Icon */}
                {isStreaming ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
                ) : (
                    <Lightbulb className="h-3.5 w-3.5 text-zinc-500" />
                )}

                {/* Text Content */}
                <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[400px] flex items-center gap-1.5">
                    <span className="text-zinc-500 dark:text-zinc-300 font-normal">正在思考</span>
                    {!isExpanded && previewText && (
                        <span className="text-zinc-800 dark:text-zinc-200">{previewText}</span>
                    )}
                </span>

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
                            <div className="pl-2 pr-2 pt-1 pb-2">
                                <div className="prose prose-sm dark:prose-invert max-w-none
                                       text-zinc-600 dark:text-zinc-400
                                       text-[13px] leading-relaxed
                                       font-serif">
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
