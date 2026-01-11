"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SubAgentIndicator } from "@/app/components/SubAgentIndicator";
import { ToolCallBox } from "@/app/components/ToolCallBox";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { ThinkingBlock } from "@/app/components/ui/agentic/ThinkingBlock";
import type {
  SubAgent,
  ToolCall,
  ActionRequest,
  ReviewConfig,
  ContentBlock,
} from "@/app/types/types";
import { Message } from "@langchain/langgraph-sdk";
import {
  extractSubAgentContent,
  extractStringFromMessageContent,
  parseMessageContentBlocks,
  stripThinkTags,
} from "@/app/utils/utils";
import { cn } from "@/lib/utils";
import {
  stripUploadedFilesAnnotation,
  parseUploadedFilesAnnotation,
} from "@/lib/uploadedFilesAnnotation";
import { stripArtifacts, parseArtifacts, getStreamingArtifact } from "@/lib/artifactParser";
import type { Artifact } from "@/lib/artifactParser";
import { MessageAttachments } from "@/app/components/MessageAttachments";
import { ArtifactCard } from "@/app/components/ArtifactCard";
import { Copy, Check, Pencil, RefreshCw, Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ChatMessageProps {
  message: Message;
  toolCalls: ToolCall[];
  isLoading?: boolean;
  actionRequestsMap?: Map<string, ActionRequest>;
  reviewConfigsMap?: Map<string, ReviewConfig>;
  ui?: any[];
  stream?: any;
  onResumeInterrupt?: (value: any) => void;
  graphId?: string;
  /** When true, parse and display artifact cards for AI messages */
  webDevMode?: boolean;
  /** Whether this is the last message (for streaming artifact detection) */
  isLastMessage?: boolean;
  /** Callback when user clicks an artifact card to preview it */
  onArtifactSelect?: (artifact: Artifact) => void;
  /** Currently selected artifact ID (to highlight the active card) */
  selectedArtifactId?: string;
  /** Callback when user wants to edit their message */
  onEditMessage?: (messageContent: string) => void;
  /** Callback when user wants to regenerate AI response */
  onRegenerate?: () => void;
  /** Callback when user wants to share the conversation */
  onShare?: () => void;
  /** Suggested follow-up questions to display */
  suggestedQuestions?: string[];
  /** Callback when user clicks a suggested question */
  onSuggestionClick?: (question: string) => void;
  /** Whether to hide thinking blocks (managed by parent) */
  hideThinking?: boolean;
  /** Whether to hide tool calls (managed by parent) */
  hideTools?: boolean;
}

export const ChatMessage = React.memo<ChatMessageProps>(
  ({
    message,
    toolCalls,
    isLoading,
    actionRequestsMap,
    reviewConfigsMap,
    ui,
    stream,
    onResumeInterrupt,
    graphId,
    webDevMode,
    isLastMessage,
    onArtifactSelect,
    selectedArtifactId,
    onEditMessage,
    onRegenerate,
    onShare,
    suggestedQuestions,
    onSuggestionClick,
    hideThinking = false,
    hideTools = false,
  }) => {
    const [copied, setCopied] = useState(false);
    const [isHovered, setIsHovered] = useState(false);
    const isUser = message.type === "human";
    const rawMessageContent = extractStringFromMessageContent(message);

    // Parse message content into structured blocks (for AI messages)
    // This handles both OpenAI format (<think> tags) and Anthropic format (thinking blocks)
    const contentBlocks = useMemo(() => {
      if (isUser) return [];
      return parseMessageContentBlocks(message);
    }, [isUser, message]);

    // Cache thinking blocks to prevent them from disappearing if tags are stripped in final message
    const [cachedThinkingBlocks, setCachedThinkingBlocks] = useState<ContentBlock[]>([]);

    React.useEffect(() => {
      const thinking = contentBlocks.filter(
        (block) => block.type === "thinking" || block.type === "redacted_thinking"
      );
      if (thinking.length > 0) {
        setCachedThinkingBlocks(thinking);
      }
    }, [contentBlocks]);

    // Check if we have any thinking blocks to render (current or cached)
    const displayThinkingBlocks = useMemo(() => {
      const currentThinking = contentBlocks.filter(
        (block) => block.type === "thinking" || block.type === "redacted_thinking"
      );
      return currentThinking.length > 0 ? currentThinking : cachedThinkingBlocks;
    }, [contentBlocks, cachedThinkingBlocks]);

    const hasThinkingBlocks = displayThinkingBlocks.length > 0;

    // For user messages, parse out file attachments and get clean display text
    // For AI messages in webDevMode, strip artifact tags (code is shown in right panel)
    // For AI messages with content blocks, we use the blocks directly instead
    const messageContent = useMemo(() => {
      if (isUser) {
        return stripUploadedFilesAnnotation(rawMessageContent);
      }
      // If we have content blocks (Anthropic format), extract only text blocks
      // The thinking blocks will be rendered separately
      if (contentBlocks.length > 0 && hasThinkingBlocks) {
        const textContent = contentBlocks
          .filter((block): block is ContentBlock & { type: "text" } => block.type === "text")
          .map((block) => block.content)
          .join("\n\n");
        // In Web Dev Mode, strip <artifact> tags
        if (webDevMode) {
          return stripArtifacts(textContent);
        }
        return textContent;
      }
      // For AI messages, always strip <think> tags (handles streaming display)
      // The thinking content will be parsed and shown in ThinkingBlock after message completes
      let content = stripThinkTags(rawMessageContent);
      // In Web Dev Mode, also strip <artifact> tags from AI messages
      if (webDevMode) {
        content = stripArtifacts(content);
      }
      return content;
    }, [isUser, rawMessageContent, webDevMode, contentBlocks, hasThinkingBlocks]);

    const userAttachments = isUser
      ? parseUploadedFilesAnnotation(rawMessageContent)
      : [];

    // Parse artifacts from AI messages in Web Dev Mode
    const messageArtifacts = useMemo(() => {
      if (isUser || !webDevMode) return { completed: [], streaming: null };

      // Get completed artifacts
      const completed = parseArtifacts(rawMessageContent);

      // Check for streaming artifact (only for last message when loading)
      let streaming: Artifact | null = null;
      if (isLastMessage && isLoading) {
        const streamingInfo = getStreamingArtifact(rawMessageContent);
        if (streamingInfo.isStreaming && streamingInfo.type) {
          streaming = {
            id: "streaming",
            type: streamingInfo.type,
            title: streamingInfo.title,
            code: streamingInfo.partialCode || "",
          };
        }
      }

      // Debug logging
      if (isLastMessage && webDevMode) {
        const hasArtifactTag = rawMessageContent.includes("<artifact");
        const hasClosingTag = rawMessageContent.includes("</artifact>");
        console.log("[ChatMessage] Artifact parsing:", {
          isLastMessage,
          isLoading,
          hasArtifactTag,
          hasClosingTag,
          completedCount: completed.length,
          hasStreaming: streaming !== null,
          contentPreview: rawMessageContent.substring(0, 200) + "...",
        });
      }

      return { completed, streaming };
    }, [isUser, webDevMode, rawMessageContent, isLastMessage, isLoading]);

    const hasArtifacts = messageArtifacts.completed.length > 0 || messageArtifacts.streaming !== null;

    const hasContent = messageContent && messageContent.trim() !== "";
    const hasToolCalls = toolCalls.length > 0;
    // Track SubAgent start times for elapsed time calculation
    const subAgentTimestampsRef = React.useRef<Record<string, { startedAt: number; completedAt?: number }>>({});

    const subAgents = useMemo(() => {
      return toolCalls
        .filter((toolCall: ToolCall) => {
          return (
            toolCall.name === "task" &&
            toolCall.args["subagent_type"] &&
            toolCall.args["subagent_type"] !== "" &&
            toolCall.args["subagent_type"] !== null
          );
        })
        .map((toolCall: ToolCall) => {
          const subagentType = (toolCall.args as Record<string, unknown>)[
            "subagent_type"
          ] as string;

          // Map ToolCall status to SubAgent status
          // ToolCall: "pending" | "completed" | "error" | "interrupted"
          // SubAgent: "pending" | "active" | "completed" | "error"
          let subAgentStatus: SubAgent["status"];
          if (toolCall.status === "pending") {
            // If pending and no result yet, it's actively running
            subAgentStatus = toolCall.result ? "completed" : "active";
          } else if (toolCall.status === "completed") {
            subAgentStatus = "completed";
          } else if (toolCall.status === "error" || toolCall.status === "interrupted") {
            subAgentStatus = "error";
          } else {
            subAgentStatus = "pending";
          }

          // Track timestamps
          const timestamps = subAgentTimestampsRef.current;
          if (!timestamps[toolCall.id]) {
            timestamps[toolCall.id] = { startedAt: Date.now() };
          }
          if (subAgentStatus === "completed" && !timestamps[toolCall.id].completedAt) {
            timestamps[toolCall.id].completedAt = Date.now();
          }

          return {
            id: toolCall.id,
            name: toolCall.name,
            subAgentName: subagentType,
            input: toolCall.args,
            output: toolCall.result ? { result: toolCall.result } : undefined,
            status: subAgentStatus,
            startedAt: timestamps[toolCall.id].startedAt,
            completedAt: timestamps[toolCall.id].completedAt,
          } as SubAgent;
        });
    }, [toolCalls]);

    const [expandedSubAgents, setExpandedSubAgents] = useState<
      Record<string, boolean>
    >({});
    const isSubAgentExpanded = useCallback(
      (id: string) => expandedSubAgents[id] ?? true,
      [expandedSubAgents]
    );
    const toggleSubAgent = useCallback((id: string) => {
      setExpandedSubAgents((prev) => ({
        ...prev,
        [id]: prev[id] === undefined ? false : !prev[id],
      }));
    }, []);

    // Copy message content to clipboard
    const handleCopy = useCallback(async () => {
      try {
        // For AI messages, copy the raw content (including artifact code)
        const textToCopy = isUser ? messageContent : rawMessageContent;
        await navigator.clipboard.writeText(textToCopy);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    }, [isUser, messageContent, rawMessageContent]);

    // Edit user message
    const handleEdit = useCallback(() => {
      if (onEditMessage && messageContent) {
        onEditMessage(messageContent);
      }
    }, [onEditMessage, messageContent]);

    // Regenerate AI response
    const handleRegenerate = useCallback(() => {
      if (onRegenerate) {
        onRegenerate();
      }
    }, [onRegenerate]);

    // Action buttons component
    // position="inline" (user messages): show on hover
    // position="bottom" (AI messages): always visible
    const MessageActions = ({ show, alwaysVisible = false }: { show: boolean; alwaysVisible?: boolean }) => {
      if (!show || isLoading) return null;

      return (
        <TooltipProvider delayDuration={0}>
          <div className={cn(
            "flex items-center gap-0.5 transition-opacity duration-200",
            alwaysVisible ? "opacity-100" : (isHovered ? "opacity-100" : "opacity-0")
          )}>
            {/* Copy button - for both user and AI messages */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleCopy}
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top">
                {copied ? "已复制" : "复制"}
              </TooltipContent>
            </Tooltip>

            {/* Edit button - only for user messages */}
            {isUser && onEditMessage && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleEdit}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">编辑</TooltipContent>
              </Tooltip>
            )}

            {/* Regenerate button - only for AI messages */}
            {!isUser && onRegenerate && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleRegenerate}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">重新生成</TooltipContent>
              </Tooltip>
            )}

            {/* Share button - only for AI messages */}
            {!isUser && onShare && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onShare}
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  >
                    <Share2 className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">分享对话</TooltipContent>
              </Tooltip>
            )}
          </div>
        </TooltipProvider>
      );
    };

    return (
      <div
        className={cn(
          "flex w-full max-w-full overflow-x-hidden group",
          isUser && "flex-row-reverse"
        )}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        <div
          className={cn(
            "min-w-0 max-w-full",
            isUser ? "max-w-[70%]" : "w-full"
          )}
        >
          {/* Attachment chips outside the bubble for user messages */}
          {isUser && userAttachments.length > 0 && (
            <div className="mt-4 flex justify-end">
              <MessageAttachments attachments={userAttachments} />
            </div>
          )}
          {/* Render thinking blocks for AI messages (before text content) */}
          {!isUser && !hideThinking && hasThinkingBlocks && (
            <div className="mt-2">
              {displayThinkingBlocks.map((block, index) => {
                if (block.type === "thinking") {
                  // Determine if this thinking block is still streaming
                  // It's streaming if: this is the last message, still loading, and it's the last thinking block
                  // AND the current LIVE message actually has thinking content (otherwise we are showing cached static content)
                  const isLiveThinking = contentBlocks.some(b => b.type === "thinking");
                  const isLastThinkingBlock = index === displayThinkingBlocks.length - 1;
                  const isThinkingStreaming = isLastMessage && isLoading && isLastThinkingBlock && isLiveThinking;

                  return (
                    <ThinkingBlock
                      key={`thinking-${index}`}
                      content={block.content}
                      isStreaming={isThinkingStreaming}
                      defaultExpanded={isThinkingStreaming}
                    />
                  );
                }
                if (block.type === "redacted_thinking") {
                  return (
                    <ThinkingBlock
                      key={`redacted-${index}`}
                      content=""
                      isRedacted={true}
                      signature={block.signature}
                    />
                  );
                }
                return null;
              })}
            </div>
          )}

          {(hasContent || (!isUser && userAttachments.length > 0)) && (
            <div className="relative">
              <div className={cn("flex items-end gap-2", isUser && "flex-row-reverse")}>
                <div
                  className={cn(
                    "mt-2 overflow-hidden break-words text-sm font-normal leading-[150%]",
                    isUser
                      ? "rounded-xl rounded-br-none border border-border px-3 py-2 text-foreground"
                      : "mt-4 text-primary"
                  )}
                  style={
                    isUser
                      ? { backgroundColor: "var(--color-user-message-bg)" }
                      : undefined
                  }
                >
                  {isUser ? (
                    hasContent && (
                      <p className="m-0 whitespace-pre-wrap break-words text-sm leading-relaxed">
                        {messageContent}
                      </p>
                    )
                  ) : hasContent ? (
                    <MarkdownContent content={messageContent} />
                  ) : null}
                </div>
                {/* User message action buttons - show on hover, positioned at right */}
                {isUser && <MessageActions show={!!hasContent} />}
              </div>
              {/* AI message action buttons - always visible, positioned at bottom */}
              {!isUser && hasContent && (
                <div className="mt-2 flex justify-start">
                  <MessageActions show={true} alwaysVisible={true} />
                </div>
              )}
              {/* Suggested follow-up questions - only for AI messages */}
              {!isUser && suggestedQuestions && suggestedQuestions.length > 0 && onSuggestionClick && (
                <div className="mt-3 flex flex-col gap-2">
                  {suggestedQuestions.map((question, index) => (
                    <button
                      key={index}
                      onClick={() => onSuggestionClick(question)}
                      className="group flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-left text-sm text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-foreground"
                    >
                      <span className="flex-1">{question}</span>
                      <span className="text-primary/60 group-hover:text-primary">→</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {hasToolCalls && !hideTools && (
            <div className="mt-4 flex w-full flex-col">
              {toolCalls.map((toolCall: ToolCall) => {
                if (toolCall.name === "task") return null;
                const toolCallGenUiComponent = ui?.find(
                  (u) => u.metadata?.tool_call_id === toolCall.id
                );
                const actionRequest = actionRequestsMap?.get(toolCall.name);
                const reviewConfig = reviewConfigsMap?.get(toolCall.name);
                return (
                  <ToolCallBox
                    key={toolCall.id}
                    toolCall={toolCall}
                    uiComponent={toolCallGenUiComponent}
                    stream={stream}
                    graphId={graphId}
                    actionRequest={actionRequest}
                    reviewConfig={reviewConfig}
                    onResume={onResumeInterrupt}
                    isLoading={isLoading}
                  />
                );
              })}
            </div>
          )}
          {!isUser && !hideTools && subAgents.length > 0 && (
            <div className="flex w-fit max-w-full flex-col gap-4">
              {subAgents.map((subAgent) => (
                <div
                  key={subAgent.id}
                  className="flex w-full flex-col gap-2"
                >
                  <div className="flex items-end gap-2">
                    <div className="w-[calc(100%-100px)]">
                      <SubAgentIndicator
                        subAgent={subAgent}
                        onClick={() => toggleSubAgent(subAgent.id)}
                        isExpanded={isSubAgentExpanded(subAgent.id)}
                      />
                    </div>
                  </div>
                  {isSubAgentExpanded(subAgent.id) && (
                    <div className="w-full max-w-full">
                      <div className="bg-surface border-border-light rounded-md border p-4">
                        <h4 className="text-primary/70 mb-2 text-xs font-semibold uppercase tracking-wider">
                          Input
                        </h4>
                        <div className="mb-4">
                          <MarkdownContent
                            content={extractSubAgentContent(subAgent.input)}
                          />
                        </div>
                        {subAgent.output && (
                          <>
                            <h4 className="text-primary/70 mb-2 text-xs font-semibold uppercase tracking-wider">
                              Output
                            </h4>
                            <MarkdownContent
                              content={extractSubAgentContent(subAgent.output)}
                            />
                          </>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Artifact Cards - inline with message in Web Dev Mode */}
          {!isUser && hasArtifacts && (
            <div className="mt-3 flex flex-wrap gap-2">
              {/* Completed artifacts */}
              {messageArtifacts.completed.map((artifact) => (
                <ArtifactCard
                  key={artifact.id}
                  artifact={artifact}
                  isStreaming={false}
                  isComplete={true}
                  onPreview={() => onArtifactSelect?.(artifact)}
                  className={cn(
                    selectedArtifactId === artifact.id && "ring-2 ring-primary"
                  )}
                />
              ))}
              {/* Streaming artifact */}
              {messageArtifacts.streaming && (
                <ArtifactCard
                  artifact={messageArtifacts.streaming}
                  isStreaming={true}
                  isComplete={false}
                  onPreview={() => onArtifactSelect?.(messageArtifacts.streaming!)}
                />
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";
