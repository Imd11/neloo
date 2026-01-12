"use client";

import React, {
  useState,
  useRef,
  useCallback,
  useMemo,
  useEffect,
  FormEvent,
  Fragment,
} from "react";
import { Button } from "@/components/ui/button";
import {
  Square,
  ArrowUp,
  CheckCircle,
  Clock,
  Circle,
  FileIcon,
  AlertCircle,
  FolderOpen,
} from "lucide-react";
import { ChatMessage } from "@/app/components/ChatMessage";
import { TaskCard } from "@/app/components/ui/agentic/TaskCard";
import { ToolStep } from "@/app/components/ui/agentic/ToolStep";
import { ThinkingBlock } from "@/app/components/ui/agentic/ThinkingBlock";
import { groupMessagesByTask } from "@/lib/messageGrouping";
import type {
  TodoItem,
  ToolCall,
  ActionRequest,
  ReviewConfig,
} from "@/app/types/types";
import { Assistant, Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent } from "@/app/utils/utils";
import { useChatContext } from "@/providers/ChatProvider";
import { cn } from "@/lib/utils";
import { useStickToBottom } from "use-stick-to-bottom";
import { FilesPopover } from "@/app/components/TasksFilesSidebar";
import { toast } from "sonner";
import { useQueryState } from "nuqs";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";
import { formatFilesForMessage, getAcceptAttribute } from "@/lib/data-file-utils";
import { useDataFileUpload } from "@/app/hooks/useDataFileUpload";
import { DataFileUpload } from "@/app/components/DataFileUpload";
import { LibraryDialog } from "@/app/components/LibraryDialog";
// WebDevToggle removed - web-dev mode is now set via homepage feature selection
import type { Artifact } from "@/lib/artifactParser";

// Maximum visible characters before showing warning
const MAX_VISIBLE_CHARS = 100000;

interface ChatInterfaceProps {
  assistant: Assistant | null;
  onOpenFilePanel?: () => void;
  showFilePanelButton?: boolean;
  // Artifact panel control - new design: selected artifact from inline cards
  selectedArtifact?: Artifact | null;
  onArtifactSelect?: (artifact: Artifact | null) => void;
}

const getStatusIcon = (status: TodoItem["status"], className?: string) => {
  switch (status) {
    case "completed":
      return (
        <CheckCircle
          size={16}
          className={cn("text-success/80", className)}
        />
      );
    case "in_progress":
      return (
        <Clock
          size={16}
          className={cn("text-warning/80", className)}
        />
      );
    default:
      return (
        <Circle
          size={16}
          className={cn("text-tertiary/70", className)}
        />
      );
  }
};

export const ChatInterface = React.memo<ChatInterfaceProps>(({
  assistant,
  onOpenFilePanel,
  showFilePanelButton,
  selectedArtifact,
  onArtifactSelect,
}) => {
  const [metaOpen, setMetaOpen] = useState<"tasks" | "files" | null>(null);
  const tasksContainerRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [libraryDialogOpen, setLibraryDialogOpen] = useState(false);

  // Suggested follow-up questions state
  const [suggestedQuestions, setSuggestedQuestions] = useState<string[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);


  const [input, setInput] = useState("");
  const { scrollRef, contentRef } = useStickToBottom();



  const {
    stream,
    messages,
    todos,
    files,
    ui,
    setFiles,
    isLoading,
    isThreadLoading,
    interrupt,
    sendMessage,
    stopStream,
    resumeInterrupt,
    webDevMode,
    enableWebDevMode,
    isModeLocked,
    editMessageAndRerun,
    regenerateLastResponse,
  } = useChatContext();

  // DataFileUpload integration
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { session } = useAuth();
  const [threadId] = useQueryState("threadId");

  const fileUpload = useDataFileUpload({
    apiUrl,
    accessToken: session?.access_token,
    maxFiles: 5,
    threadId,
    autoUpload: true,
  });

  // Track pending file commits that need threadId
  const pendingCommitRef = useRef<{
    resolve: (threadId: string) => void;
    reject: (error: Error) => void;
  } | null>(null);

  // When threadId changes (created by useStream), commit any pending files
  useEffect(() => {
    if (threadId && pendingCommitRef.current) {
      const { resolve } = pendingCommitRef.current;
      pendingCommitRef.current = null;
      resolve(threadId);
    }
  }, [threadId]);

  const pendingCount = useMemo(
    () => fileUpload.files.filter((f) => f.status === "pending").length,
    [fileUpload.files]
  );

  const uploadingCount = useMemo(
    () => fileUpload.files.filter((f) => f.status === "uploading").length,
    [fileUpload.files]
  );

  const hasUploadFiles = fileUpload.files.length > 0;
  const hasPendingOrUploading = fileUpload.isUploading || pendingCount > 0 || uploadingCount > 0;

  const submitDisabled = isLoading || !assistant || hasPendingOrUploading || (!input.trim() && !hasUploadFiles);

  const handleSubmit = useCallback(
    async (e?: FormEvent) => {
      if (e) {
        e.preventDefault();
      }
      if (submitDisabled) return;

      if (fileUpload.isUploading || pendingCount > 0 || uploadingCount > 0) {
        toast.message("Uploading files...", {
          description: "Please wait for uploads to finish before sending.",
        });
        return;
      }

      try {
        // Build message content with file references
        const uploadedFiles = fileUpload.uploadedFiles;
        let messageContent = input.trim();
        if (uploadedFiles.length > 0) {
          messageContent += formatFilesForMessage(uploadedFiles);
        }

        if (!messageContent && uploadedFiles.length === 0) return;

        // If we have staged files but no threadId yet, we need to wait for
        // useStream to create the thread, then commit files
        const hasStagedFiles = fileUpload.stagedFiles.length > 0;

        if (hasStagedFiles && !threadId) {
          // Create a promise that will be resolved when threadId is set
          const threadIdPromise = new Promise<string>((resolve, reject) => {
            pendingCommitRef.current = { resolve, reject };
            // Set a timeout to prevent hanging
            setTimeout(() => {
              if (pendingCommitRef.current) {
                pendingCommitRef.current = null;
                reject(new Error("Thread creation timeout"));
              }
            }, 30000);
          });

          // Send message first - this will trigger useStream to create thread
          sendMessage(messageContent);
          setInput("");

          // Wait for threadId to be created, then commit files
          const newThreadId = await threadIdPromise;
          await fileUpload.commitFiles(newThreadId);
          fileUpload.clearFiles();
        } else if (hasStagedFiles && threadId) {
          // We already have a threadId, commit files first then send
          await fileUpload.commitFiles(threadId);
          sendMessage(messageContent);
          setInput("");
          fileUpload.clearFiles();
        } else {
          // No files to commit, just send message
          // useStream will create thread if needed (via onThreadId callback)
          sendMessage(messageContent);
          setInput("");
          fileUpload.clearFiles();
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error("Failed to send message", { description: message });
      }
    },
    [submitDisabled, fileUpload, input, sendMessage, pendingCount, uploadingCount, threadId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (submitDisabled) return;
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit, submitDisabled]
  );

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        fileUpload.addFiles(Array.from(e.target.files));
        e.target.value = "";
      }
    },
    [fileUpload]
  );

  // Handle edit message - show edit dialog or directly edit
  // Now uses branching: truncates history and re-runs from edited point
  const [editingMessageIndex, setEditingMessageIndex] = useState<number | null>(null);
  const [editingMessageContent, setEditingMessageContent] = useState("");

  const handleStartEdit = useCallback(
    (messageIndex: number, messageContent: string) => {
      setEditingMessageIndex(messageIndex);
      setEditingMessageContent(messageContent);
    },
    []
  );

  const handleConfirmEdit = useCallback(() => {
    if (editingMessageIndex === null || !editingMessageContent.trim()) return;

    editMessageAndRerun(editingMessageIndex, editingMessageContent.trim());
    toast.info("正在重新生成回复...", {
      description: "历史消息已从编辑点重新开始",
    });

    // Clear editing state
    setEditingMessageIndex(null);
    setEditingMessageContent("");
  }, [editingMessageIndex, editingMessageContent, editMessageAndRerun]);

  const handleCancelEdit = useCallback(() => {
    setEditingMessageIndex(null);
    setEditingMessageContent("");
  }, []);

  // Handle regenerate - uses branching: removes last AI response and re-generates
  const handleRegenerate = useCallback(() => {
    if (isLoading || !messages || messages.length === 0) return;

    regenerateLastResponse();
    toast.info("正在重新生成回复...", {
      description: "旧的 AI 回复已被替换",
    });
  }, [isLoading, messages, regenerateLastResponse]);

  // Handle share - create share link and copy to clipboard
  const handleShare = useCallback(async () => {
    if (!threadId || !config) {
      toast.error("无法分享", { description: "请先开始对话" });
      return;
    }

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`;
      }

      const response = await fetch(
        `${config.deploymentUrl}/api/threads/${threadId}/share`,
        {
          method: "POST",
          headers,
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "创建分享链接失败");
      }

      const data = await response.json();

      // Build the share URL using current window location
      const shareUrl = `${window.location.origin}/share/${data.share_id}`;

      // Copy to clipboard
      await navigator.clipboard.writeText(shareUrl);

      toast.success("链接已复制到剪贴板", {
        description: "任何人都可以通过此链接查看对话",
      });
    } catch (error) {
      console.error("Failed to create share link:", error);
      toast.error("分享失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    }
  }, [threadId, config, session?.access_token]);

  // Fetch suggested follow-up questions after AI response completes
  const fetchSuggestedQuestions = useCallback(async (aiResponse: string) => {
    if (!threadId || !config || !session?.access_token) return;

    setIsLoadingSuggestions(true);
    try {
      const response = await fetch(
        `${config.deploymentUrl}/api/threads/${threadId}/generate-suggestions`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            ai_response: aiResponse,
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setSuggestedQuestions(data.questions || []);
      }
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setIsLoadingSuggestions(false);
    }
  }, [threadId, config, session?.access_token]);

  // Trigger suggestion generation when AI response completes
  const prevIsLoadingRef = useRef(isLoading);
  useEffect(() => {
    // Detect when isLoading transitions from true to false (AI finished responding)
    if (prevIsLoadingRef.current && !isLoading && messages && messages.length > 0) {
      // Find the last AI message
      const lastMessage = messages[messages.length - 1];
      if (lastMessage.type === "ai") {
        const content = extractStringFromMessageContent(lastMessage);
        if (content) {
          fetchSuggestedQuestions(content);
        }
      }
    }
    prevIsLoadingRef.current = isLoading;
  }, [isLoading, messages, fetchSuggestedQuestions]);

  // Clear suggestions when user starts typing
  useEffect(() => {
    if (input.length > 0) {
      setSuggestedQuestions([]);
    }
  }, [input]);

  // Handle clicking a suggested question
  const handleSuggestionClick = useCallback((question: string) => {
    setInput(question);
    setSuggestedQuestions([]);
    textareaRef.current?.focus();
  }, []);

  // Handle files selected from library
  const handleLibraryFilesSelected = useCallback(
    async (files: Array<{
      id: string;
      filename: string;
      original_filename: string;
      size: number;
      storage_path?: string;
    }>) => {
      await fileUpload.addFromLibrary(files);
    },
    [fileUpload]
  );

  // TODO: can we make this part of the hook?
  const processedMessages = useMemo(() => {
    /*
     1. Loop through all messages
     2. For each AI message, add the AI message, and any tool calls to the messageMap
     3. For each tool message, find the corresponding tool call in the messageMap and update the status and output
    */
    const messageMap = new Map<
      string,
      { message: Message; toolCalls: ToolCall[] }
    >();
    messages.forEach((message: Message) => {
      if (message.type === "ai") {
        const toolCallsInMessage: Array<{
          id?: string;
          function?: { name?: string; arguments?: unknown };
          name?: string;
          type?: string;
          args?: unknown;
          input?: unknown;
        }> = [];
        if (
          message.additional_kwargs?.tool_calls &&
          Array.isArray(message.additional_kwargs.tool_calls)
        ) {
          toolCallsInMessage.push(...message.additional_kwargs.tool_calls);
        } else if (message.tool_calls && Array.isArray(message.tool_calls)) {
          toolCallsInMessage.push(
            ...message.tool_calls.filter(
              (toolCall: { name?: string }) => toolCall.name !== ""
            )
          );
        } else if (Array.isArray(message.content)) {
          const toolUseBlocks = message.content.filter(
            (block: { type?: string }) => block.type === "tool_use"
          );
          toolCallsInMessage.push(...toolUseBlocks);
        }
        const toolCallsWithStatus = toolCallsInMessage.map(
          (toolCall: {
            id?: string;
            function?: { name?: string; arguments?: unknown };
            name?: string;
            type?: string;
            args?: unknown;
            input?: unknown;
          }) => {
            const name =
              toolCall.function?.name ||
              toolCall.name ||
              toolCall.type ||
              "unknown";
            const args =
              toolCall.function?.arguments ||
              toolCall.args ||
              toolCall.input ||
              {};
            return {
              id: toolCall.id || `tool-${Math.random()}`,
              name,
              args,
              status: interrupt ? "interrupted" : ("pending" as const),
            } as ToolCall;
          }
        );
        messageMap.set(message.id!, {
          message,
          toolCalls: toolCallsWithStatus,
        });
      } else if (message.type === "tool") {
        const toolCallId = message.tool_call_id;
        if (!toolCallId) {
          return;
        }
        for (const [, data] of messageMap.entries()) {
          const toolCallIndex = data.toolCalls.findIndex(
            (tc: ToolCall) => tc.id === toolCallId
          );
          if (toolCallIndex === -1) {
            continue;
          }
          data.toolCalls[toolCallIndex] = {
            ...data.toolCalls[toolCallIndex],
            status: "completed" as const,
            result: extractStringFromMessageContent(message),
          };
          break;
        }
      } else if (message.type === "human") {
        messageMap.set(message.id!, {
          message,
          toolCalls: [],
        });
      }
    });
    const processedArray = Array.from(messageMap.values());
    return processedArray.map((data, index) => {
      const prevMessage = index > 0 ? processedArray[index - 1].message : null;
      return {
        ...data,
        showAvatar: data.message.type !== prevMessage?.type,
      };
    });
  }, [messages, interrupt]);

  const groupedTodos = {
    in_progress: todos.filter((t) => t.status === "in_progress"),
    pending: todos.filter((t) => t.status === "pending"),
    completed: todos.filter((t) => t.status === "completed"),
  };

  const hasTasks = todos.length > 0;
  const hasFiles = Object.keys(files).length > 0;

  // Parse out any action requests or review configs from the interrupt
  const actionRequestsMap: Map<string, ActionRequest> | null = useMemo(() => {
    const actionRequests =
      interrupt?.value && (interrupt.value as any)["action_requests"];
    if (!actionRequests) return new Map<string, ActionRequest>();
    return new Map(actionRequests.map((ar: ActionRequest) => [ar.name, ar]));
  }, [interrupt]);

  const reviewConfigsMap: Map<string, ReviewConfig> | null = useMemo(() => {
    const reviewConfigs =
      interrupt?.value && (interrupt.value as any)["review_configs"];
    if (!reviewConfigs) return new Map<string, ReviewConfig>();
    return new Map(
      reviewConfigs.map((rc: ReviewConfig) => [rc.actionName, rc])
    );
  }, [interrupt]);

  // Calculate total visible characters in conversation
  const totalVisibleChars = useMemo(() => {
    return messages.reduce((total, msg) => {
      const content = extractStringFromMessageContent(msg);
      return total + content.length;
    }, 0);
  }, [messages]);

  const showLargeConversationWarning = totalVisibleChars > MAX_VISIBLE_CHARS;

  return (
    <>
      {/* Library Dialog for importing files */}
      <LibraryDialog
        open={libraryDialogOpen}
        onOpenChange={setLibraryDialogOpen}
        mode="select"
        onFilesSelected={handleLibraryFilesSelected}
      />
      <div className="flex flex-1 flex-col overflow-hidden">
        <div
          className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain"
          ref={scrollRef}
        >
          <div
            className="mx-auto w-full max-w-[1024px] px-6 pb-6 pt-4"
            ref={contentRef}
          >
            {/* Large conversation warning */}
            {showLargeConversationWarning && (
              <div className="mb-4 rounded-lg border border-orange-500/20 bg-orange-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-orange-500" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-orange-500">
                      Large Conversation Warning
                    </h3>
                    <p className="mt-1 text-sm text-orange-500/90">
                      This conversation has exceeded {MAX_VISIBLE_CHARS.toLocaleString()} characters.
                      Performance may be affected. Consider starting a new thread for better performance.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {isThreadLoading && processedMessages.length === 0 ? (
              <div className="flex items-center justify-center p-8">
                <p className="text-muted-foreground">Loading...</p>
              </div>
            ) : (
              /* New Grouped Rendering Logic */
              (() => {
                const groupedItems = groupMessagesByTask(messages);

                return (
                  <div className="flex flex-col gap-0 relative">
                    {/* Continuous Thread Line container if needed, but we'll do per-item lines */}

                    {groupedItems.map((group, groupIdx) => {
                      const isLastGroup = groupIdx === groupedItems.length - 1;

                      if (group.type === "global_thinking") {
                        return (
                          <div key={group.id} className="flex flex-col">
                            {group.items.map((item, idx) => {
                              // Determine if active streaming
                              // Global thoughts stream at the very beginning
                              // Only true if item.isStreaming is explicitly true (not just !== false)
                              const isStreaming = isLoading && isLastGroup && (idx === group.items.length - 1) && item.isStreaming === true;
                              // Pass isLast=false always if there are subsequent groups (Tasks), effectively connecting deeply
                              // Actually ThinkingBlock handles its own line logic, we might need a prop to Force the line to continue
                              // But ThinkingBlock line is usually "bottom-0" if not last. 
                              return (
                                <ThinkingBlock
                                  key={`global-think-${idx}`}
                                  content={item.content}
                                  startTime={item.startTime}
                                  isStreaming={isStreaming}
                                  duration={item.duration}
                                  defaultExpanded={false} // User request: default collapsed
                                  className={cn(
                                    // Visual tweak to align with tasks
                                    "mb-2"
                                  )}
                                  hasDoctype={true} // Special prop to indicate it's global context? or just styling
                                />
                              );
                            })}
                          </div>
                        )
                      }

                      if (group.type === "task") {
                        return (
                          <TaskCard
                            key={group.id}
                            title={group.title}
                            status={group.status}
                            isLast={isLastGroup} // Pass isLast to control thread line
                          >
                            {group.items.map((item, idx) => {
                              // Render ToolStep
                              if ("toolName" in item) {
                                return (
                                  <ToolStep
                                    key={item.toolCallId}
                                    toolName={item.toolName}
                                    input={typeof item.args === 'string' ? item.args : JSON.stringify(item.args)}
                                    output={item.result}
                                    status={item.status}
                                    isLast={idx === group.items.length - 1}
                                  />
                                );
                              }

                              // Render ThinkingContent inside Task
                              if ("content" in item && "isStreaming" in item) {
                                // Only mark as actively streaming if:
                                // 1. Overall chat is loading
                                // 2. This task is in progress
                                // 3. This is the last item in the group
                                // 4. This item's isStreaming is explicitly true (not just defined)
                                const thinkingItem = item as { isStreaming: boolean };
                                const isActive = isLoading && (group.status === "in_progress") && (idx === group.items.length - 1) && thinkingItem.isStreaming === true;

                                return (
                                  <ThinkingBlock
                                    key={`thinking-${idx}`}
                                    content={item.content}
                                    startTime={item.startTime}
                                    isStreaming={isActive}
                                    duration={item.duration}
                                    defaultExpanded={false} // User request: default collapsed
                                  />
                                )
                              }

                              // Render Message (Thinking/Text) inside Task
                              if ("content" in item && "id" in item) { // Message interface
                                const msgId = item.id;
                                const processedData = processedMessages.find(pm => pm.message.id === msgId);

                                if (!processedData) return null;

                                const messageUi = ui?.filter(
                                  (u: any) => u.metadata?.message_id === msgId
                                );
                                const isLastMessage = msgId === messages[messages.length - 1].id;
                                const isUserMessage = item.type === "human";
                                const isLastAiMessage = !isUserMessage && isLastMessage;

                                return (
                                  <ChatMessage
                                    key={msgId}
                                    message={processedData.message}
                                    toolCalls={processedData.toolCalls}
                                    isLoading={isLoading}
                                    actionRequestsMap={
                                      isLastMessage ? actionRequestsMap : undefined
                                    }
                                    reviewConfigsMap={
                                      isLastMessage ? reviewConfigsMap : undefined
                                    }
                                    ui={messageUi}
                                    stream={stream}
                                    onResumeInterrupt={resumeInterrupt}
                                    graphId={assistant?.graph_id}
                                    webDevMode={webDevMode}
                                    isLastMessage={isLastMessage}
                                    onArtifactSelect={onArtifactSelect}
                                    selectedArtifactId={selectedArtifact?.id}
                                    onEditMessage={isUserMessage ? (content) => {
                                      // Find the message index in the original messages array
                                      const msgIndex = messages?.findIndex(m => m.id === msgId) ?? -1;
                                      if (msgIndex >= 0) handleStartEdit(msgIndex, content);
                                    } : undefined}
                                    onRegenerate={isLastAiMessage ? handleRegenerate : undefined}
                                    hideTools={true}
                                  />
                                );
                              }
                              return null;
                            })}
                          </TaskCard>
                        );
                      } else {
                        // Render Top Level Message
                        const msgId = group.message.id;
                        const processedData = processedMessages.find(pm => pm.message.id === msgId);

                        if (!processedData) return null;

                        const messageUi = ui?.filter(
                          (u: any) => u.metadata?.message_id === msgId
                        );
                        const isLastMessage = msgId === messages[messages.length - 1].id;
                        const isUserMessage = group.message.type === "human";
                        const isLastAiMessage = !isUserMessage && isLastMessage;

                        return (
                          <ChatMessage
                            key={msgId}
                            message={processedData.message}
                            toolCalls={processedData.toolCalls}
                            isLoading={isLoading}
                            actionRequestsMap={
                              isLastMessage ? actionRequestsMap : undefined
                            }
                            reviewConfigsMap={
                              isLastMessage ? reviewConfigsMap : undefined
                            }
                            ui={messageUi}
                            stream={stream}
                            onResumeInterrupt={resumeInterrupt}
                            graphId={assistant?.graph_id}
                            webDevMode={webDevMode}
                            isLastMessage={isLastMessage}
                            onArtifactSelect={onArtifactSelect}
                            selectedArtifactId={selectedArtifact?.id}
                            onEditMessage={isUserMessage ? (content) => {
                              // Find the message index in the original messages array
                              const msgIndex = messages?.findIndex(m => m.id === msgId) ?? -1;
                              if (msgIndex >= 0) handleStartEdit(msgIndex, content);
                            } : undefined}
                            onRegenerate={isLastAiMessage ? handleRegenerate : undefined}
                            onShare={!isUserMessage ? handleShare : undefined}
                            suggestedQuestions={isLastAiMessage && !isLoading ? suggestedQuestions : undefined}
                            onSuggestionClick={isLastAiMessage ? handleSuggestionClick : undefined}
                          />
                        );
                      }
                    })}
                  </div>
                );
              })()
            )}
          </div >
        </div >

        <div className="flex-shrink-0 bg-background">
          <div
            className={cn(
              "mx-4 mb-6 flex flex-shrink-0 flex-col overflow-hidden rounded-3xl border border-border bg-input-bg shadow-sm transition-all duration-200 ease-in-out focus-within:border-ring focus-within:shadow-md",
              "mx-auto w-[calc(100%-32px)] max-w-[1024px]"
            )}
          >
            {(hasTasks || hasFiles) && (
              <div className="flex max-h-72 flex-col overflow-y-auto border-b border-border/50 bg-muted/30 empty:hidden">
                {!metaOpen && (
                  <>
                    {(() => {
                      const activeTask = todos.find(
                        (t) => t.status === "in_progress"
                      );

                      const totalTasks = todos.length;
                      const remainingTasks =
                        totalTasks - groupedTodos.pending.length;
                      const isCompleted = totalTasks === remainingTasks;

                      const tasksTrigger = (() => {
                        if (!hasTasks) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setMetaOpen((prev) =>
                                prev === "tasks" ? null : "tasks"
                              )
                            }
                            className="grid w-full cursor-pointer grid-cols-[auto_auto_1fr] items-center gap-3 px-[18px] py-3 text-left hover:bg-muted/50 transition-colors"
                            aria-expanded={metaOpen === "tasks"}
                          >
                            {(() => {
                              if (isCompleted) {
                                return [
                                  <CheckCircle
                                    key="icon"
                                    size={16}
                                    className="text-success/80"
                                  />,
                                  <span
                                    key="label"
                                    className="ml-[1px] min-w-0 truncate text-sm"
                                  >
                                    All tasks completed
                                  </span>,
                                ];
                              }

                              if (activeTask != null) {
                                return [
                                  <div key="icon">
                                    {getStatusIcon(activeTask.status)}
                                  </div>,
                                  <span
                                    key="label"
                                    className="ml-[1px] min-w-0 truncate text-sm"
                                  >
                                    Task{" "}
                                    {totalTasks - groupedTodos.pending.length} of{" "}
                                    {totalTasks}
                                  </span>,
                                  <span
                                    key="content"
                                    className="min-w-0 gap-2 truncate text-sm text-muted-foreground"
                                  >
                                    {activeTask.content}
                                  </span>,
                                ];
                              }

                              return [
                                <Circle
                                  key="icon"
                                  size={16}
                                  className="text-tertiary/70"
                                />,
                                <span
                                  key="label"
                                  className="ml-[1px] min-w-0 truncate text-sm"
                                >
                                  Task {totalTasks - groupedTodos.pending.length}{" "}
                                  of {totalTasks}
                                </span>,
                              ];
                            })()}
                          </button>
                        );
                      })();

                      const filesTrigger = (() => {
                        if (!hasFiles) return null;
                        return (
                          <button
                            type="button"
                            onClick={() =>
                              setMetaOpen((prev) =>
                                prev === "files" ? null : "files"
                              )
                            }
                            className="flex flex-shrink-0 cursor-pointer items-center gap-2 px-[18px] py-3 text-left text-sm text-muted-foreground hover:bg-muted/50 transition-colors"
                            aria-expanded={metaOpen === "files"}
                            title="Temporary in-memory files (use File Panel for persistent files)"
                          >
                            <FileIcon size={16} />
                            Memory
                            <span className="h-4 min-w-4 rounded-full bg-muted px-0.5 text-center text-[10px] leading-[16px] text-muted-foreground">
                              {Object.keys(files).length}
                            </span>
                          </button>
                        );
                      })();

                      return (
                        <div className="grid grid-cols-[1fr_auto_auto] items-center">
                          {tasksTrigger}
                          {filesTrigger}
                        </div>
                      );
                    })()}
                  </>
                )}

                {metaOpen && (
                  <>
                    <div className="sticky top-0 flex items-stretch bg-muted/50 text-sm">
                      {hasTasks && (
                        <button
                          type="button"
                          className="py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold hover:text-foreground transition-colors"
                          onClick={() =>
                            setMetaOpen((prev) =>
                              prev === "tasks" ? null : "tasks"
                            )
                          }
                          aria-expanded={metaOpen === "tasks"}
                        >
                          Tasks
                        </button>
                      )}
                      {hasFiles && (
                        <button
                          type="button"
                          className="inline-flex items-center gap-2 py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold text-muted-foreground hover:text-foreground transition-colors"
                          onClick={() =>
                            setMetaOpen((prev) =>
                              prev === "files" ? null : "files"
                            )
                          }
                          aria-expanded={metaOpen === "files"}
                          title="Temporary in-memory files"
                        >
                          Memory
                          <span className="h-4 min-w-4 rounded-full bg-muted px-0.5 text-center text-[10px] leading-[16px] text-muted-foreground">
                            {Object.keys(files).length}
                          </span>
                        </button>
                      )}
                      <button
                        aria-label="Close"
                        className="flex-1"
                        onClick={() => setMetaOpen(null)}
                      />
                    </div>
                    <div
                      ref={tasksContainerRef}
                      className="px-[18px] pb-2"
                    >
                      {metaOpen === "tasks" &&
                        Object.entries(groupedTodos)
                          .filter(([_, todos]) => todos.length > 0)
                          .map(([status, todos]) => (
                            <div
                              key={status}
                              className="mb-4"
                            >
                              <h3 className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-tertiary">
                                {
                                  {
                                    pending: "Pending",
                                    in_progress: "In Progress",
                                    completed: "Completed",
                                  }[status]
                                }
                              </h3>
                              <div className="grid grid-cols-[auto_1fr] gap-3 rounded-sm p-1 pl-0 text-sm">
                                {todos.map((todo, index) => (
                                  <Fragment key={`${status}_${todo.id}_${index}`}>
                                    {getStatusIcon(todo.status, "mt-0.5")}
                                    <span className="break-words text-inherit">
                                      {todo.content}
                                    </span>
                                  </Fragment>
                                ))}
                              </div>
                            </div>
                          ))}

                      {metaOpen === "files" && (
                        <div className="mb-6">
                          <FilesPopover
                            files={files}
                            setFiles={setFiles}
                            editDisabled={
                              isLoading === true || interrupt !== undefined
                            }
                          />
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            )}
            <form
              onSubmit={handleSubmit}
              className="flex flex-col"
            >
              {/* Hidden file input for DataFileUpload */}
              <input
                ref={fileUpload.inputRef}
                type="file"
                multiple
                accept={getAcceptAttribute()}
                onChange={handleFileInputChange}
                className="hidden"
              />
              {/* Input area with optional web-dev mode tag */}
              <div className="flex items-start gap-2 px-4 pt-4 pb-0">
                {/* Web Dev Mode Tag - shown when enabled, like ANYAI */}
                {webDevMode && (
                  <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 bg-blue-500/15 text-blue-600 dark:text-blue-400">
                    <span>网页开发</span>
                    {!isModeLocked && (
                      <button
                        type="button"
                        onClick={() => {
                          // Clear web dev mode - need to implement this
                          // For now, this is visual only since mode is locked after first message
                        }}
                        className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-current/25 hover:scale-125 active:scale-95 transition-all duration-150"
                      >
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path d="M18 6L6 18M6 6l12 12" />
                        </svg>
                      </button>
                    )}
                  </div>
                )}
                <textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder={
                    isLoading
                      ? "Running..."
                      : webDevMode
                        ? "描述你想要开发的网页..."
                        : "Write your message..."
                  }
                  className="font-inherit field-sizing-content flex-1 resize-none border-0 bg-transparent pb-0 text-sm leading-7 text-foreground outline-none placeholder:text-muted-foreground min-h-[40px] max-h-[200px]"
                  rows={1}
                />
              </div>
              <div className="flex justify-between items-center gap-2 px-2 pb-2">
                {/* Left: Actions */}
                <div className="flex items-center gap-1">
                  <DataFileUpload
                    files={fileUpload.files}
                    onRemoveFile={fileUpload.removeFile}
                    onTriggerSelect={() => fileUpload.inputRef.current?.click()}
                    onTriggerLibrary={() => setLibraryDialogOpen(true)}
                    isUploading={fileUpload.isUploading}
                    isImporting={fileUpload.isImporting}
                  />
                  {/* FilePanel button - show when there's a thread OR local files */}
                  {(showFilePanelButton || hasUploadFiles) && onOpenFilePanel && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={onOpenFilePanel}
                      className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                      title="View files"
                    >
                      <FolderOpen size={18} />
                    </Button>
                  )}
                  {/* Web Development Mode toggle removed - now controlled via homepage */}
                </div>

                {/* Right: Send/Stop Button */}
                <div className="flex justify-end gap-2">
                  <Button
                    type={isLoading ? "button" : "submit"}
                    variant="send"
                    size="icon-sm"
                    onClick={isLoading ? stopStream : undefined}
                    disabled={!isLoading && (submitDisabled || !input.trim())}
                    className="shrink-0"
                  >
                    {isLoading ? (
                      <Square className="h-3 h-3 fill-current" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </div >
    </>
  );
});

ChatInterface.displayName = "ChatInterface";
