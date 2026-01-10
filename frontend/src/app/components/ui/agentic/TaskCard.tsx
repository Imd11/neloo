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

    // Determine border color based on status
    const borderColor = {
        pending: "border-l-zinc-300 dark:border-l-zinc-700",
        in_progress: "border-l-blue-500",
        completed: "border-l-emerald-500",
        failed: "border-l-red-500"
    }[status];

    return (
        <div className={cn(
            "bg-white dark:bg-zinc-950 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm overflow-hidden my-4",
            "border-l-4",
            borderColor,
            className
        )}>
            {/* Header */}
            <div
                className={cn(
                    "px-4 py-3 flex items-center gap-3 bg-zinc-50/50 dark:bg-zinc-900/50 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors",
                    !isExpanded && "border-b-0"
                )}
                onClick={onToggleExpand}
            >
                <Icon className={cn("h-5 w-5 shrink-0", config.color)} />

                <span className={cn(
                    "font-medium text-sm text-zinc-900 dark:text-zinc-100 flex-1",
                    status === "completed" && "line-through text-zinc-500 dark:text-zinc-500"
                )}>
                    {title}
                </span>

                <span className="text-zinc-400">
                    {isExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </span>
            </div>

            {/* Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: "auto" }}
                        exit={{ height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="p-4 pt-2 border-t border-zinc-100 dark:border-zinc-800/50 min-h-[50px]">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
