"use client";

import React, { useState } from "react";
import {
    Globe,
    Terminal,
    FileText,
    Bot,
    Workflow,
    Loader2,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronRight,
    FolderOpen
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

export interface ToolStepProps {
    toolName: string;
    input: string; // JSON string or simple text
    output?: string;
    status: "running" | "complete" | "error";
    isLast?: boolean; // To decide if thread line continues
    className?: string;
}

// Tool Definition Mapping
const TOOL_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    search_web: {
        icon: Globe,
        color: "text-blue-500 bg-blue-100 dark:bg-blue-900/30",
        label: "Browsing Web"
    },
    execute_python: {
        icon: Terminal,
        color: "text-emerald-500 bg-emerald-100 dark:bg-emerald-900/30",
        label: "Running Code"
    },
    read_file: {
        icon: FileText,
        color: "text-slate-500 bg-slate-100 dark:bg-slate-900/30",
        label: "Reading File"
    },
    write_file: {
        icon: FolderOpen,
        color: "text-slate-500 bg-slate-100 dark:bg-slate-900/30",
        label: "Writing File"
    },
    task: {
        icon: Bot,
        color: "text-indigo-500 bg-indigo-100 dark:bg-indigo-900/30",
        label: "Sub-Agent Task"
    },
    // Default fallback
    default: {
        icon: Workflow,
        color: "text-zinc-500 bg-zinc-100 dark:bg-zinc-800",
        label: "Tool Execution"
    }
};

function getToolConfig(name: string) {
    return TOOL_CONFIG[name] || TOOL_CONFIG.default;
}

function safeParseConfig(input: string) {
    try {
        const parsed = JSON.parse(input);
        // Extract key info for display (e.g. query for search, code snippet for python)
        if (parsed.query) return `"${parsed.query}"`;
        if (parsed.code) return "Python Script";
        if (parsed.file_path) return parsed.file_path.split("/").pop();
        return "Arguments";
    } catch {
        return input.length > 50 ? input.slice(0, 50) + "..." : input;
    }
}

export function ToolStep({
    toolName,
    input,
    output,
    status,
    isLast = false,
    className
}: ToolStepProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const config = getToolConfig(toolName);
    const Icon = config.icon;
    const displayInput = safeParseConfig(input);

    return (
        <div className={cn("relative flex gap-4 font-sans group", className)}>
            {/* Thread Line */}
            <div className={cn(
                "absolute left-[11px] top-0 w-0.5 bg-zinc-200 dark:bg-zinc-800",
                // If it's the last item, stop the line at the icon center (top-8)
                isLast ? "h-8" : "bottom-0"
            )} />

            {/* Icon Area */}
            <div className="relative z-10 flex h-6 w-6 shrink-0 mt-2 items-center justify-center">
                <div className={cn(
                    "flex h-6 w-6 items-center justify-center rounded-full ring-2 ring-background transition-colors",
                    config.color
                )}>
                    {status === "running" ? (
                        <Loader2 className={cn("h-3.5 w-3.5 animate-spin", config.color.split(" ")[0])} />
                    ) : (
                        <Icon className={cn("h-3.5 w-3.5", config.color.split(" ")[0])} />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 py-2">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-2 text-sm w-full text-left group-hover:bg-zinc-50 dark:group-hover:bg-zinc-900/50 rounded px-2 -ml-2 py-1 transition-colors"
                >
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                        {config.label}
                    </span>

                    <span className="text-zinc-400 dark:text-zinc-500 truncate max-w-[200px]">
                        {displayInput}
                    </span>

                    {/* Status Indicator */}
                    <div className="ml-auto flex items-center gap-2">
                        {status === "complete" && <CheckCircle2 size={14} className="text-emerald-500" />}
                        {status === "error" && <XCircle size={14} className="text-red-500" />}

                        <span className="text-zinc-400">
                            {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                        </span>
                    </div>
                </button>

                {/* Details (Expanded) */}
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="pl-0 pr-2 pt-2 pb-2 text-xs font-mono space-y-2">
                                {/* Input */}
                                <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-2 border border-zinc-100 dark:border-zinc-800">
                                    <div className="text-zinc-400 mb-1">Input</div>
                                    <pre className="whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
                                        {input}
                                    </pre>
                                </div>

                                {/* Output */}
                                {output && (
                                    <div className="bg-zinc-50 dark:bg-zinc-900 rounded p-2 border border-zinc-100 dark:border-zinc-800">
                                        <div className="text-zinc-400 mb-1">Output</div>
                                        <pre className="whitespace-pre-wrap break-all text-zinc-600 dark:text-zinc-400">
                                            {output.slice(0, 1000) + (output.length > 1000 ? "..." : "")}
                                        </pre>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}
