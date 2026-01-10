"use client";

import React from "react";
import { CheckCircle2, Circle, Loader2, XCircle, ChevronDown, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export type TaskStatus = "pending" | "in_progress" | "completed" | "failed";

interface TaskCardProps {
    title: string;
    status: TaskStatus;
    isExpanded?: boolean;
    onToggleExpand?: () => void;
    children: React.ReactNode;
    className?: string;
}

const STATUS_CONFIG: Record<TaskStatus, { icon: any; color: string }> = {
    pending: { icon: Circle, color: "text-zinc-400" },
    in_progress: { icon: Loader2, color: "text-blue-500 animate-spin" },
    completed: { icon: CheckCircle2, color: "text-emerald-500" },
    failed: { icon: XCircle, color: "text-red-500" },
};

export function TaskCard({
    title,
    status,
    isExpanded = true,
    onToggleExpand,
    children,
    className,
}: TaskCardProps) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    // Notion-like minimalist design:
    // - No visually heavy borders or colored sides
    // - Subtlety is key

    return (
        <div className={cn(
            "group my-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/50 transition-all",
            // Slight shadow only on hover
            "hover:shadow-[0_2px_8px_rgba(0,0,0,0.04)] dark:hover:shadow-none",
            className
        )}>
            {/* Header - Styled like a Clickable List Item */}
            <div
                className={cn(
                    "px-4 py-3 flex items-center gap-3 cursor-pointer select-none transition-colors rounded-t-lg",
                    // Active state shading
                    isExpanded ? "bg-zinc-50/50 dark:bg-zinc-900/50" : "hover:bg-zinc-50 dark:hover:bg-zinc-900/30",
                    !isExpanded && "rounded-b-lg"
                )}
                onClick={onToggleExpand}
            >
                {/* Status Icon - Subtle wrapper */}
                <div className={cn(
                    "flex items-center justify-center w-6 h-6 rounded-md transition-colors",
                    status === 'in_progress' ? "bg-blue-50 dark:bg-blue-950/30" : "bg-transparent"
                )}>
                    <Icon className={cn(
                        "h-4 w-4",
                        config.color
                    )} />
                </div>

                {/* Title */}
                <span className={cn(
                    "font-medium text-[15px] text-zinc-800 dark:text-zinc-200 flex-1 tracking-tight",
                    status === "completed" && "text-zinc-500 dark:text-zinc-500"
                )}>
                    {title}
                </span>

                {/* Duration / Metadata (Placeholder for now) */}

                {/* Collapse Chevron - Only visible on hover or if expanded */}
                <span className={cn(
                    "text-zinc-300 dark:text-zinc-600 transition-colors group-hover:text-zinc-400",
                    isExpanded && "text-zinc-400"
                )}>
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
            </div>

            {/* Content Container - Clean reveal */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        {/* Nested Content Padding - Indented to align with title text (approx 48px left) */}
                        <div className="px-4 pb-4 pt-1 pl-[3.25rem]">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
