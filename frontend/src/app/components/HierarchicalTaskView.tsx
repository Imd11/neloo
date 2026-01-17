"use client";

import React, { useState, useMemo, useCallback } from "react";
import { ChevronUp, Copy, Check, RefreshCw, Share, Search, Code, FileText, Image } from "lucide-react";
import {
    groupMessagesByTodo,
    TodoGroup,
    TimelineItem,
    HierarchicalTimeline
} from "@/lib/messageGrouping";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { ThinkingBlock } from "@/app/components/ui/agentic/ThinkingBlock";
import { Message } from "@langchain/langgraph-sdk";
import { cn } from "@/lib/utils";
import type { TodoItem, ToolCall } from "@/app/types/types";
import { extractStringFromMessageContent } from "@/app/utils/utils";

interface HierarchicalTaskViewProps {
    messages: Message[];
    todos: TodoItem[];
    isLoading?: boolean;
    stream?: any;
    graphId?: string;
    // Action buttons
    onRegenerate?: () => void;
    onShare?: () => void;
    // Suggested questions
    suggestedQuestions?: string[];
    onSuggestionClick?: (question: string) => void;
}

// Tool icon based on name
const getToolIcon = (toolName: string) => {
    if (toolName.includes("search") || toolName.includes("web")) {
        return <Search size={14} className="shrink-0" />;
    }
    if (toolName.includes("python") || toolName.includes("execute") || toolName.includes("code")) {
        return <Code size={14} className="shrink-0" />;
    }
    if (toolName.includes("file") || toolName.includes("write") || toolName.includes("read")) {
        return <FileText size={14} className="shrink-0" />;
    }
    if (toolName.includes("image")) {
        return <Image size={14} className="shrink-0" />;
    }
    return <Code size={14} className="shrink-0" />;
};

// Render a single timeline item (text, thinking, or tool call)
function TimelineItemRenderer({
    item,
    isLoading,
    stream,
    graphId,
    isCompleted
}: {
    item: TimelineItem;
    isLoading?: boolean;
    stream?: any;
    graphId?: string;
    isCompleted?: boolean;
}) {
    switch (item.type) {
        case "timeline_thinking":
            return (
                <ThinkingBlock
                    content={item.content}
                    isStreaming={false}
                    defaultExpanded={false}
                />
            );

        case "timeline_text":
            return (
                <div className={cn(
                    "text-sm leading-relaxed",
                    isCompleted ? "text-muted-foreground" : "text-foreground"
                )}>
                    <MarkdownContent content={item.content} />
                </div>
            );

        case "timeline_tool_call":
            // Inline tool call - Manus style
            const isRunning = item.status === "running";
            const toolArgs = parseArgs(item.args);
            const displayArg = getDisplayArg(item.toolName, toolArgs);

            return (
                <div className={cn(
                    "flex items-center gap-2 text-sm",
                    isCompleted ? "text-muted-foreground" : "text-foreground"
                )}>
                    {getToolIcon(item.toolName)}
                    <span className="text-muted-foreground">
                        {isRunning ? "正在" : ""}
                        {getToolLabel(item.toolName)}
                    </span>
                    {displayArg && (
                        <code className="px-1.5 py-0.5 bg-muted rounded text-xs font-mono truncate max-w-[300px]">
                            {displayArg}
                        </code>
                    )}
                    {isRunning && (
                        <span className="text-muted-foreground animate-pulse">...</span>
                    )}
                </div>
            );

        case "message":
            // User message
            if (item.message.type === "human") {
                const content = extractContent(item.message);
                return (
                    <div className="rounded-xl rounded-br-none border border-border px-3 py-2 text-sm bg-[var(--color-user-message-bg)]">
                        <p className="whitespace-pre-wrap">{content}</p>
                    </div>
                );
            }
            return null;

        default:
            return null;
    }
}

// Get human-readable tool label
function getToolLabel(toolName: string): string {
    if (toolName.includes("search") || toolName.includes("web")) return "搜索";
    if (toolName.includes("python") || toolName.includes("execute")) return "执行代码";
    if (toolName.includes("write") && toolName.includes("file")) return "创建文件";
    if (toolName.includes("read")) return "读取文件";
    return "执行";
}

// Extract display argument from tool args
function getDisplayArg(toolName: string, args: Record<string, unknown>): string | null {
    if (args.query) return String(args.query);
    if (args.search_query) return String(args.search_query);
    if (args.filename) return String(args.filename);
    if (args.path) return String(args.path);
    if (args.code) return "[Python 代码]";
    return null;
}

// Parse args string to object
function parseArgs(args: string): Record<string, unknown> {
    try {
        return JSON.parse(args);
    } catch {
        return { raw: args };
    }
}

// Extract content from message
function extractContent(message: Message): string {
    const content = message.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) {
        return content
            .filter((c): c is { type: "text"; text: string } =>
                typeof c === "object" && c !== null && c.type === "text"
            )
            .map(c => c.text)
            .join("\n");
    }
    return "";
}

// Task Group Card Component - Refined minimalist design
function TaskGroupCard({
    group,
    index,
    isLoading,
    stream,
    graphId,
    isLast
}: {
    group: TodoGroup;
    index: number;
    isLoading?: boolean;
    stream?: any;
    graphId?: string;
    isLast?: boolean;
}) {
    const [expanded, setExpanded] = useState(group.status !== "completed");
    const isCompleted = group.status === "completed";
    const isInProgress = group.status === "in_progress";

    return (
        <div className="relative">
            {/* Vertical thread line - continuous */}
            <div
                className={cn(
                    "absolute left-[5px] w-px bg-border",
                    isLast ? "top-0 h-[11px]" : "top-0 bottom-0"
                )}
            />

            {/* Node */}
            <div className="absolute left-0 top-[3px]">
                {isCompleted ? (
                    // Completed: check mark
                    <div className="w-3 h-3 flex items-center justify-center text-muted-foreground">
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                            <path
                                d="M2 6L5 9L10 3"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>
                ) : isInProgress ? (
                    // In progress: filled dot with pulse
                    <div className="w-3 h-3 flex items-center justify-center">
                        <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
                    </div>
                ) : (
                    // Pending: empty circle
                    <div className="w-3 h-3 rounded-full border border-border" />
                )}
            </div>

            {/* Content */}
            <div className="pl-6">
                {/* Task Header */}
                <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center gap-1 w-full text-left py-0.5 group"
                >
                    <span className={cn(
                        "text-sm flex-1",
                        isCompleted ? "text-muted-foreground" : "text-foreground"
                    )}>
                        {group.title}
                    </span>
                    <ChevronUp
                        size={14}
                        className={cn(
                            "text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity",
                            !expanded && "rotate-180"
                        )}
                    />
                </button>

                {/* Task Content */}
                {expanded && group.items.length > 0 && (
                    <div className="mt-1 mb-3 space-y-1.5">
                        {group.items.map((item, idx) => (
                            <TimelineItemRenderer
                                key={item.id || idx}
                                item={item}
                                isLoading={isLoading}
                                stream={stream}
                                graphId={graphId}
                                isCompleted={isCompleted}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

// Main Hierarchical Task View Component
export function HierarchicalTaskView({
    messages,
    todos,
    isLoading,
    stream,
    graphId,
    onRegenerate,
    onShare,
    suggestedQuestions,
    onSuggestionClick
}: HierarchicalTaskViewProps) {
    const [copied, setCopied] = useState(false);

    const hierarchicalData = useMemo(() => {
        return groupMessagesByTodo(messages, todos);
    }, [messages, todos]);

    // Get all AI message content for copying
    const allAiContent = useMemo(() => {
        const aiMessages = messages.filter(m => m.type === "ai");
        return aiMessages.map(m => extractStringFromMessageContent(m)).join("\n\n");
    }, [messages]);

    const handleCopy = useCallback(async () => {
        if (!allAiContent) return;
        try {
            await navigator.clipboard.writeText(allAiContent);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (e) {
            console.error("Failed to copy:", e);
        }
    }, [allAiContent]);

    const showActions = !isLoading && messages.length > 0;

    return (
        <div className="space-y-4">
            {/* Top-level content (before any todos) */}
            {hierarchicalData.topLevel.length > 0 && (
                <div className="space-y-2">
                    {hierarchicalData.topLevel.map((item, idx) => (
                        <TimelineItemRenderer
                            key={item.id || `top-${idx}`}
                            item={item}
                            isLoading={isLoading}
                            stream={stream}
                            graphId={graphId}
                        />
                    ))}
                </div>
            )}

            {/* Todo Groups - Progressive Disclosure with vertical thread */}
            {hierarchicalData.todoGroups.length > 0 && (() => {
                const visibleGroups = hierarchicalData.todoGroups.filter(
                    group => group.status === "completed" || group.status === "in_progress"
                );
                return visibleGroups.length > 0 ? (
                    <div className="space-y-0">
                        {visibleGroups.map((group, index) => (
                            <TaskGroupCard
                                key={group.todoId}
                                group={group}
                                index={index + 1}
                                isLoading={isLoading}
                                stream={stream}
                                graphId={graphId}
                                isLast={index === visibleGroups.length - 1}
                            />
                        ))}
                    </div>
                ) : null;
            })()}

            {/* Action Buttons */}
            {showActions && (
                <div className="mt-2 flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title="复制"
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    {onRegenerate && (
                        <button
                            onClick={onRegenerate}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="重新生成"
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                    {onShare && (
                        <button
                            onClick={onShare}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title="分享"
                        >
                            <Share size={14} />
                        </button>
                    )}
                </div>
            )}

            {/* Suggested Questions */}
            {!isLoading && suggestedQuestions && suggestedQuestions.length > 0 && onSuggestionClick && (
                <div className="mt-4">
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>💡</span>
                        <span>你可能想继续问：</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        {suggestedQuestions.map((question, index) => (
                            <button
                                key={index}
                                onClick={() => onSuggestionClick(question)}
                                className="group inline-flex w-fit items-center gap-1 rounded-md px-2 py-1.5 text-left text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            >
                                <span>{question}</span>
                                <span className="text-muted-foreground/50 group-hover:text-foreground">→</span>
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

export default HierarchicalTaskView;

