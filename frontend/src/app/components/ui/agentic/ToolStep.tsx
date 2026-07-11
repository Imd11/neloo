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
  Search,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/providers/LanguageProvider";

export interface ToolStepProps {
  toolName: string;
  input: string; // JSON string or simple text
  output?: string;
  status: "running" | "complete" | "error";
  isLast?: boolean; // To decide if thread line continues
  className?: string;
}

// Tool Definition Mapping - Capsule Design with Monochrome Icons
// Icons are always gray, hover effect is on the capsule container
const TOOL_CONFIG: Record<string, { icon: any; label: string }> = {
  search_web: {
    icon: Search,
    label: "Web Search",
  },
  execute_python: {
    icon: Terminal,
    label: "Execute Python",
  },
  read_file: {
    icon: FileText,
    label: "Read File",
  },
  write_file: {
    icon: FolderOpen,
    label: "Write File",
  },
  task: {
    icon: Bot,
    label: "Sub-Agent Task",
  },
  // Default fallback
  default: {
    icon: Workflow,
    label: "Tool Execution",
  },
};

function getToolConfig(name: string) {
  return TOOL_CONFIG[name] || TOOL_CONFIG.default;
}

function safeParseConfig(input: string, toolName: string) {
  try {
    const parsed = JSON.parse(input);

    // Python: Extract first comment or show "Python Script"
    if (toolName === "execute_python" && parsed.code) {
      const firstLine = parsed.code.split("\n")[0].trim();
      if (firstLine.startsWith("#")) {
        return firstLine.substring(1).trim();
      }
      return "Python Script";
    }

    // Search: Show query
    if (toolName === "search_web" && parsed.query) {
      return parsed.query;
    }

    // Files: Show file path
    if (
      (toolName === "read_file" || toolName === "write_file") &&
      parsed.file_path
    ) {
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
  className,
}: ToolStepProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { t } = useLanguage();
  const config = getToolConfig(toolName);
  const Icon = config.icon;
  const displayInput = safeParseConfig(input, toolName);

  // For search, try to parse results if output exists
  const searchResults =
    toolName === "search_web" && output ? parseSearchResults(output) : null;

  return (
    <div className={cn("py-0.5 font-sans", className)}>
      {/* Capsule Container */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="group/capsule inline-flex items-center gap-2 rounded-full border border-zinc-200/80
                           bg-zinc-200/70 px-3
                           py-1 text-[13px] transition-colors
                           hover:bg-zinc-300/60 dark:border-zinc-800/50
                           dark:bg-zinc-900/50 dark:hover:bg-zinc-800/50"
      >
        {/* Icon - Always gray */}
        {status === "running" ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-zinc-500" />
        ) : (
          <Icon className="h-3.5 w-3.5 text-zinc-500" />
        )}

        {/* Text Content */}
        <span className="flex max-w-[400px] items-center gap-1.5 truncate font-medium text-zinc-700 dark:text-zinc-300">
          {toolName === "search_web" ? (
            <>
              <span className="font-normal text-zinc-500 dark:text-zinc-300">
                {t("thinking.searching")}
              </span>
              <span className="text-zinc-800 dark:text-zinc-200">
                {displayInput}
              </span>
            </>
          ) : (
            displayInput
          )}
        </span>

        {/* Status Indicator & Chevron */}
        <div className="ml-1 flex items-center gap-1.5">
          {status === "error" && (
            <XCircle
              size={14}
              className="text-red-500"
            />
          )}
          <span className="text-zinc-400 dark:text-zinc-500">
            {isExpanded ? (
              <ChevronDown size={14} />
            ) : (
              <ChevronRight size={14} />
            )}
          </span>
        </div>
      </button>

      {/* Expanded Content */}
      <div className="ml-1">
        {/* Details (Expanded) */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pb-2 pl-2 pr-2 pt-1">
                {/* Search Results Visualization */}
                {toolName === "search_web" &&
                searchResults &&
                searchResults.length > 0 ? (
                  <div className="mt-1 space-y-2">
                    {searchResults.map((result, idx) => (
                      <a
                        key={idx}
                        href={result.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex flex-col gap-1 rounded-lg border border-zinc-200 bg-white p-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.02)] transition-all hover:bg-zinc-50 hover:shadow-[0_2px_4px_rgba(0,0,0,0.04)] dark:border-zinc-800 dark:bg-zinc-900/50 dark:hover:bg-zinc-900"
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={`https://www.google.com/s2/favicons?domain=${result.source}&sz=128`}
                            alt="favicon"
                            className="h-3.5 w-3.5 rounded-full opacity-60"
                          />
                          <span className="text-[11px] text-zinc-400">
                            {result.source}
                          </span>
                        </div>
                        <div className="line-clamp-1 text-sm font-medium text-zinc-800 transition-colors hover:text-blue-600 dark:text-zinc-200 dark:hover:text-blue-400">
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
                      <div className="mb-0.5 ml-1 text-[10px] uppercase tracking-wider text-zinc-400">
                        Input
                      </div>
                      <div className="overflow-x-auto rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                        <pre className="font-mono text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
                          {input}
                        </pre>
                      </div>
                    </div>

                    {/* Output */}
                    {output && (
                      <div className="group/code relative">
                        <div className="mb-0.5 ml-1 text-[10px] uppercase tracking-wider text-zinc-400">
                          Output
                        </div>
                        <div className="max-h-[300px] overflow-x-auto overflow-y-auto rounded-md border border-zinc-100 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-900">
                          <pre className="font-mono text-xs leading-relaxed text-zinc-600 dark:text-zinc-400">
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
