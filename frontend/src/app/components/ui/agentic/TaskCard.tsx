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
    isLast?: boolean;
}

const STATUS_CONFIG: Record<TaskStatus, { icon: any; color: string }> = {
    pending: { icon: Circle, color: "text-zinc-300 dark:text-zinc-700" },
    in_progress: { icon: Loader2, color: "text-blue-500 animate-spin" },
    completed: { icon: CheckCircle2, color: "text-zinc-400" }, // Minimalist completed icon
    failed: { icon: XCircle, color: "text-red-500" },
};

export function TaskCard({
    title,
    status,
    isExpanded = true,
    onToggleExpand,
    children,
    className,
    isLast = false
}: TaskCardProps) {
    const config = STATUS_CONFIG[status];
    const Icon = config.icon;

    return (
        <div className={cn("relative font-sans group", className)}>
            {/* Thread Line connecting Task Header to Children OR Next Task */}
            {/* Spans the entire height, children hide it if they have their own opaque backgrounds (they don't usually) */}
            {/* Actually, since we render children below, we just need a line from Header center down */}

            {/* Container Line */}
            <div className={cn(
                "absolute left-[11px] top-0 w-[1px] bg-zinc-100 dark:bg-zinc-800",
                // If this is the last task/group, and it's collapsed, the line should stop at the icon.
                // If expanded, the children draw lines.
                // But simply: The line goes from Top to Bottom of this container.
                isLast ? "bottom-auto h-6" : "bottom-0"
            )} />

            {/* Header - Only render if task has a title (explicit tasks) */}
            {title && (
                <div
                    className={cn(
                        "relative flex items-center gap-3 py-1 cursor-pointer select-none transition-colors",
                        // Hover effect only on text area
                        "group/header"
                    )}
                    onClick={onToggleExpand}
                >
                    {/* Icon Area */}
                    <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center bg-white dark:bg-zinc-950">
                        <Icon className={cn("h-4 w-4", config.color)} />
                    </div>

                    {/* Title Area */}
                    <div className="flex items-center gap-2 flex-1 min-w-0 p-1 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors">
                        <span className={cn(
                            "font-medium text-[14px] text-zinc-900 dark:text-zinc-100 flex-1 tracking-tight truncate",
                            status === "completed" && "text-zinc-500 line-through decoration-zinc-300"
                        )}>
                            {title}
                        </span>

                        <span className={cn(
                            "text-zinc-300 dark:text-zinc-600 transition-colors group-hover/header:text-zinc-400",
                            isExpanded && "text-zinc-400"
                        )}>
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                    </div>
                </div>
            )}

            {/* Content Container */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeInOut" }}
                        className="overflow-hidden"
                    >
                        {/* Indent children to show hierarchy/progression relative to the task line */}
                        <div className="flex flex-col pl-6">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
