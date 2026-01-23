"use client";

import React, { useState } from "react";
import {
    Terminal,
    FileText,
    Bot,
    Workflow,
    Loader2,
    XCircle,
    ChevronDown,
    ChevronRight,
    FolderOpen,
    Search
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
// Tool Definition Mapping - Minimalist Redesign
// Removed colorful backgrounds, switched to subtle text accents or monochrome
const TOOL_CONFIG: Record<string, { icon: any; color: string; label: string }> = {
    search_web: {
        icon: Search,
        color: "text-zinc-500 group-hover:text-blue-500 transition-colors",
        label: "Web Search"
    },
    execute_python: {
        icon: Terminal,
        color: "text-zinc-500 group-hover:text-emerald-500 transition-colors",
        label: "Execute Python"
    },
    read_file: {
        icon: FileText,
        color: "text-zinc-400 group-hover:text-zinc-600 transition-colors",
        label: "Read File"
    },
    write_file: {
        icon: FolderOpen,
        color: "text-zinc-400 group-hover:text-zinc-600 transition-colors",
        label: "Write File"
    },
    task: {
        icon: Bot,
        color: "text-zinc-500 group-hover:text-violet-500 transition-colors",
        label: "Sub-Agent Task"
    },
    // Default fallback
    default: {
        icon: Workflow,
        color: "text-zinc-400 group-hover:text-zinc-600",
        label: "Tool Execution"
    }
};

function getToolConfig(name: string) {
    return TOOL_CONFIG[name] || TOOL_CONFIG.default;
}

function safeParseConfig(input: string, toolName: string) {
    try {
        const parsed = JSON.parse(input);

        // Python: Extract first comment or show "Python Script"
        if (toolName === 'execute_python' && parsed.code) {
            const firstLine = parsed.code.split('\n')[0].trim();
            if (firstLine.startsWith('#')) {
                return firstLine.substring(1).trim();
            }
            return "Python Script";
        }

        // Search: Show query
        if (toolName === 'search_web' && parsed.query) {
            return parsed.query;
        }

        // Files: Show file path
        if ((toolName === 'read_file' || toolName === 'write_file') && parsed.file_path) {
            return parsed.file_path.split("/").pop();
        }

        // Generic fallback
        if (parsed.query) return parsed.query;
        if (parsed.code) return "Python Script";
        if (parsed.file_path) return parsed.file_path.split("/").pop();

        return "Arguments";
    } catch {
        return input.length > 50 ? input.slice(0, 50) + "..." : input;
    }
}

// Helper to parse search results from typical agent output formats
interface SearchResult {
    title: string;
    url: string;
    content: string;
    source: string;
}

function parseSearchResults(output: string): SearchResult[] {
    const results: SearchResult[] = [];

    // Attempt to parse numbered list format seen in screenshots: 
    // 1. **Title** \n URL: https://... \n Snippet...
    const items = output.split(/^\d+\.\s+/m).filter(Boolean);

    for (const item of items) {
        try {
            // Extract Title (bolded)
            const titleMatch = item.match(/\*\*(.*?)\*\*/);
            const title = titleMatch ? titleMatch[1] : "Search Result";

            // Extract URL
            const urlMatch = item.match(/URL:\s*(https?:\/\/[^\s]+)/);
            const url = urlMatch ? urlMatch[1] : "";

            // Extract Content (everything else)
            // Remove title line and URL line to get content
            let content = item
                .replace(/\*\*(.*?)\*\*/, "")
                .replace(/URL:\s*https?:\/\/[^\s]+/, "")
                .trim();

            // Simple cleanup
            content = content.replace(/^\s*[-:]\s*/, "").substring(0, 150) + "...";

            if (url) {
                try {
                    const domain = new URL(url).hostname;
                    results.push({ title, url, content, source: domain });
                } catch {
                    // invalid url, skip
                }
            }
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
        } catch (_e) {
            continue;
        }
    }

    return results;
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
    const displayInput = safeParseConfig(input, toolName);

    // For search, try to parse results if output exists
    const searchResults = (toolName === 'search_web' && output) ? parseSearchResults(output) : null;

    return (
        <div className={cn("relative flex gap-3 font-sans group py-1", className)}>
            {/* Thread Line - Ultra subtle */}
            <div className={cn(
                "absolute left-[11px] top-0 w-[1px] bg-zinc-100 dark:bg-zinc-800",
                isLast ? "h-6" : "bottom-0"
            )} />

            {/* Icon Area - Minimalist, no background rings */}
            <div className="relative z-10 flex h-6 w-6 shrink-0 items-center justify-center bg-white dark:bg-zinc-950">
                {status === "running" ? (
                    <Loader2 className={cn("h-3.5 w-3.5 animate-spin text-zinc-400")} />
                ) : (
                    <Icon className={cn("h-3.5 w-3.5 transition-colors", config.color)} />
                )}
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <button
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="flex items-center gap-3 text-[13px] w-full text-left rounded-md px-2 -ml-2 py-1 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 transition-colors group/btn"
                >
                    <span className="font-medium text-zinc-700 dark:text-zinc-300 truncate max-w-[600px] flex items-center gap-2">
                        {toolName === "search_web" ? (
                            <>
                                <span className="text-zinc-400 font-normal">正在搜索</span>
                                <span className="text-zinc-800 dark:text-zinc-200">{displayInput}</span>
                            </>
                        ) : (
                            displayInput
                        )}
                    </span>

                    {/* Status Indicator & Chevron */}
                    <div className="ml-auto flex items-center gap-2 opacity-0 group-hover/btn:opacity-100 transition-opacity">
                        {status === "error" && <XCircle size={14} className="text-red-500" />}
                        <span className="text-zinc-300 dark:text-zinc-600">
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
                            <div className="pl-2 pr-2 pt-1 pb-2">
                                {/* Search Results Visualization */}
                                {toolName === 'search_web' && searchResults && searchResults.length > 0 ? (
                                    <div className="space-y-2 mt-1">
                                        {searchResults.map((result, idx) => (
                                            <a
                                                key={idx}
                                                href={result.url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="flex flex-col gap-1 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/50 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)]"
                                            >
                                                <div className="flex items-center gap-2">
                                                    <img
                                                        src={`https://www.google.com/s2/favicons?domain=${result.source}&sz=128`}
                                                        alt="favicon"
                                                        className="w-3.5 h-3.5 rounded-full opacity-60"
                                                    />
                                                    <span className="text-[11px] text-zinc-400">{result.source}</span>
                                                </div>
                                                <div className="font-medium text-sm text-zinc-800 dark:text-zinc-200 line-clamp-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors">
                                                    {result.title}
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    /* Default Input/Output View - Clean Code Style */
                                    <div className="mt-1 space-y-2">
                                        {/* Input */}
                                        <div className="group/code relative">
                                            <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-0.5 ml-1">Input</div>
                                            <div className="bg-zinc-50 dark:bg-zinc-900 rounded-md p-3 border border-zinc-100 dark:border-zinc-800 overflow-x-auto">
                                                <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                                    {input}
                                                </pre>
                                            </div>
                                        </div>

                                        {/* Output */}
                                        {output && (
                                            <div className="group/code relative">
                                                <div className="text-[10px] uppercase tracking-wider text-zinc-400 mb-0.5 ml-1">Output</div>
                                                <div className="bg-zinc-50 dark:bg-zinc-900 rounded-md p-3 border border-zinc-100 dark:border-zinc-800 overflow-x-auto max-h-[300px] overflow-y-auto">
                                                    <pre className="text-xs font-mono text-zinc-600 dark:text-zinc-400 leading-relaxed">
                                                        {output}
                                                    </pre>
                                                </div>
                                            </div>
                                        )}
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
