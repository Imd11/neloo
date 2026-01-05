"use client";

import React, { useMemo, useState, useCallback } from "react";
import { SubAgentIndicator } from "@/app/components/SubAgentIndicator";
import { ToolCallBox } from "@/app/components/ToolCallBox";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import type {
  SubAgent,
  ToolCall,
  ActionRequest,
  ReviewConfig,
} from "@/app/types/types";
import { Message } from "@langchain/langgraph-sdk";
import {
  extractSubAgentContent,
  extractStringFromMessageContent,
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
  }) => {
    const isUser = message.type === "human";
    const rawMessageContent = extractStringFromMessageContent(message);

    // For user messages, parse out file attachments and get clean display text
    // For AI messages in webDevMode, strip artifact tags (code is shown in right panel)
    const messageContent = useMemo(() => {
      if (isUser) {
        return stripUploadedFilesAnnotation(rawMessageContent);
      }
      // In Web Dev Mode, strip <artifact> tags from AI messages
      if (webDevMode) {
        return stripArtifacts(rawMessageContent);
      }
      return rawMessageContent;
    }, [isUser, rawMessageContent, webDevMode]);

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

      return { completed, streaming };
    }, [isUser, webDevMode, rawMessageContent, isLastMessage, isLoading]);

    const hasArtifacts = messageArtifacts.completed.length > 0 || messageArtifacts.streaming !== null;

    const hasContent = messageContent && messageContent.trim() !== "";
    const hasToolCalls = toolCalls.length > 0;
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
          return {
            id: toolCall.id,
            name: toolCall.name,
            subAgentName: subagentType,
            input: toolCall.args,
            output: toolCall.result ? { result: toolCall.result } : undefined,
            status: toolCall.status,
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

    return (
      <div
        className={cn(
          "flex w-full max-w-full overflow-x-hidden",
          isUser && "flex-row-reverse"
        )}
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
          {(hasContent || (!isUser && userAttachments.length > 0)) && (
            <div className={cn("relative flex items-end gap-0")}>
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
            </div>
          )}
          {hasToolCalls && (
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
          {!isUser && subAgents.length > 0 && (
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
