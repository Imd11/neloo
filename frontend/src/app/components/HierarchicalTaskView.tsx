"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Copy, Check, RefreshCw, Share } from "lucide-react";
import {
    buildManusTimeline,
    ManusTimeline,
    ManusNode,
    TimelineItem,
} from "@/lib/messageGrouping";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { ThinkingBlock } from "@/app/components/ui/agentic/ThinkingBlock";
import { ToolStep } from "@/app/components/ui/agentic/ToolStep";
import { Message } from "@langchain/langgraph-sdk";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/app/types/types";
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

/**
 * Render a single timeline item (text, thinking, or tool call)
 * Uses ToolStep component for tool calls to preserve existing rendering logic
 */
function TimelineItemRenderer({
    item,
    isLoading,
    stream,
    graphId,
    indent = false,
}: {
    item: TimelineItem;
    isLoading?: boolean;
    stream?: any;
    graphId?: string;
    indent?: boolean;
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
                <div className="text-sm leading-relaxed">
                    <MarkdownContent content={item.content} />
                </div>
            );

        case "timeline_tool_call":
            // Reuse ToolStep component for tool calls
            return (
                <ToolStep
                    toolName={item.toolName}
                    input={item.args}
                    output={item.result}
                    status={item.status === "complete" ? "complete" : "running"}
                    isLast={true}
                    className="!py-0"
                />
            );

        case "message":
            // User message
            if (item.message.type === "human") {
                const content = extractStringFromMessageContent(item.message);
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

/**
 * Render a single Todo node with pure text character lines
 */
function ManusNodeCard({
    node,
    isLast,
    isLoading,
    stream,
    graphId,
}: {
    node: ManusNode;
    isLast: boolean;
    isLoading?: boolean;
    stream?: any;
    graphId?: string;
}) {
    const [expanded, setExpanded] = useState(node.status === 'running');

    return (
        <div className="relative">
            {/* Main node line */}
            <button
                onClick={() => setExpanded(!expanded)}
                className="flex items-start gap-2 w-full text-left py-0.5 group"
            >
                {/* Status indicator - pure text */}
                <span className={cn(
                    "w-4 shrink-0 text-sm font-normal",
                    node.status === 'done' ? "text-muted-foreground" : "text-foreground"
                )}>
                    {node.status === 'done' ? '✓' : '○'}
                </span>

                {/* Title */}
                <span className={cn(
                    "text-sm flex-1",
                    node.status === 'done' ? "text-muted-foreground" : "text-foreground font-medium"
                )}>
                    {node.title}
                </span>
            </button>

            {/* Children with text character lines */}
            {expanded && node.children.length > 0 && (
                <div className="mt-1 mb-2">
                    {node.children.map((child, idx) => (
                        <div key={child.id || idx} className="flex items-start">
                            {/* Vertical line character */}
                            <span className="w-4 shrink-0 text-muted-foreground/50 text-sm select-none">
                                │
                            </span>
                            {/* Child content with indent */}
                            <div className="ml-1 flex-1 min-w-0">
                                <TimelineItemRenderer
                                    item={child}
                                    isLoading={isLoading}
                                    stream={stream}
                                    graphId={graphId}
                                    indent={true}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Connector line to next node */}
            {!isLast && (
                <div className="flex items-start h-2">
                    <span className="w-4 shrink-0 text-muted-foreground/50 text-sm select-none">
                        │
                    </span>
                </div>
            )}
        </div>
    );
}

/**
 * Main Hierarchical Task View Component - Manus Style
 * 
 * Renders todo nodes as the main axis with children indented below.
 * Uses pure text characters for connection lines (│, ✓, ○).
 */
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

    // Build Manus-style timeline
    const timeline = useMemo(() => {
        return buildManusTimeline(messages, todos);
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
        <div className="space-y-3">
            {/* Prelude: Content before any todo (AI intro) */}
            {timeline.prelude.length > 0 && (
                <div className="space-y-2">
                    {timeline.prelude.map((item, idx) => (
                        <TimelineItemRenderer
                            key={item.id || `prelude-${idx}`}
                            item={item}
                            isLoading={isLoading}
                            stream={stream}
                            graphId={graphId}
                        />
                    ))}
                </div>
            )}

            {/* Todo Nodes - Main axis with pure text lines */}
            {timeline.visibleTodos.length > 0 && (
                <div className="space-y-0">
                    {timeline.visibleTodos.map((node, idx) => (
                        <ManusNodeCard
                            key={node.id}
                            node={node}
                            isLast={idx === timeline.visibleTodos.length - 1}
                            isLoading={isLoading}
                            stream={stream}
                            graphId={graphId}
                        />
                    ))}
                </div>
            )}

            {/* Epilogue: Content after all todos completed */}
            {timeline.epilogue.length > 0 && (
                <div className="space-y-2 mt-3">
                    {timeline.epilogue.map((item, idx) => (
                        <TimelineItemRenderer
                            key={item.id || `epilogue-${idx}`}
                            item={item}
                            isLoading={isLoading}
                            stream={stream}
                            graphId={graphId}
                        />
                    ))}
                </div>
            )}

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
