"use client";

import React, { useState, useMemo, useCallback } from "react";
import { Copy, Check, RefreshCw, Share, CheckCircle2 } from "lucide-react";
import {
    buildEventTimeline,
    EventTimelineEvent,
    TimelineItem,
} from "@/lib/messageGrouping";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { ThinkingBlock } from "@/app/components/ui/agentic/ThinkingBlock";
import { ToolStep } from "@/app/components/ui/agentic/ToolStep";
import { UserMessageBubble } from "@/app/components/UserMessageBubble";
import { Message } from "@langchain/langgraph-sdk";
import { cn } from "@/lib/utils";
import type { TodoItem } from "@/app/types/types";
import { extractStringFromMessageContent } from "@/app/utils/utils";
import { useLanguage } from "@/providers/LanguageProvider";

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
            // User message - use shared UserMessageBubble component
            if (item.message.type === "human") {
                const content = extractStringFromMessageContent(item.message);
                return <UserMessageBubble content={content} messageId={item.message.id} />;
            }
            return null;

        default:
            return null;
    }
}

/**
 * Render a todo anchor row with spinner/check icons
 */
function TodoNodeRow({
    title,
    status,
}: {
    title: string;
    status: "running" | "done";
}) {
    return (
        <div className="flex items-center gap-2 w-full py-1">
            {/* Status indicator */}
            <div className="w-4 h-4 shrink-0 flex items-center justify-center">
                {status === "done" ? (
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <circle cx="12" cy="12" r="10" className="fill-muted-foreground/20 stroke-muted-foreground" strokeWidth="2" />
                        <path d="M7.5 12.5L10.5 15.5L16.5 9" className="stroke-muted-foreground" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                ) : (
                    <div className="gradient-spinner" />
                )}
            </div>
            {/* Title */}
            <span className="text-sm flex-1 text-foreground font-semibold">
                {title}
            </span>
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
    todos: _todos,
    isLoading,
    stream,
    graphId,
    onRegenerate,
    onShare,
    suggestedQuestions,
    onSuggestionClick
}: HierarchicalTaskViewProps) {
    const [copied, setCopied] = useState(false);
    const { t } = useLanguage();

    // Build event-anchor timeline (write_todos = anchor signal)
    const timeline = useMemo(() => buildEventTimeline(messages), [messages]);

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
            <div className="space-y-0">
                {timeline.events.map((evt: EventTimelineEvent, idx: number) => {
                    if (evt.type === "todo_node") {
                        return (
                            <TodoNodeRow
                                key={evt.id}
                                title={evt.title}
                                status={evt.status}
                            />
                        );
                    }

                    const contentKey =
                        (evt.item as any)?.id || `content-${idx}`;

                    if (evt.indent) {
                        return (
                            <div
                                key={contentKey}
                                className="flex items-stretch"
                            >
                                {/* Vertical connecting line - CSS solid line with negative margin to connect to circles */}
                                <div className="w-4 shrink-0 flex justify-center">
                                    <div className="w-px bg-border h-[calc(100%+12px)] -my-1.5" />
                                </div>
                                <div className="ml-1 flex-1 min-w-0 py-0.5">
                                    <TimelineItemRenderer
                                        item={evt.item}
                                        isLoading={isLoading}
                                        stream={stream}
                                        graphId={graphId}
                                        indent={true}
                                    />
                                </div>
                            </div>
                        );
                    }

                    return (
                        <div key={contentKey} className="space-y-2">
                            <TimelineItemRenderer
                                item={evt.item}
                                isLoading={isLoading}
                                stream={stream}
                                graphId={graphId}
                            />
                        </div>
                    );
                })}
            </div>

            {/* Action Buttons */}
            {showActions && (
                <div className="mt-2 flex items-center gap-1">
                    <button
                        onClick={handleCopy}
                        className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                        title={t("chat.copy")}
                    >
                        {copied ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                    {onRegenerate && (
                        <button
                            onClick={onRegenerate}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={t("chat.regenerate")}
                        >
                            <RefreshCw size={14} />
                        </button>
                    )}
                    {onShare && (
                        <button
                            onClick={onShare}
                            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                            title={t("chat.share")}
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
                        <span>{t("chat.follow_up_suggestions")}</span>
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
