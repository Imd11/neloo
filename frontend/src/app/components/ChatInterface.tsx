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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Square,
  ArrowUp,
  CheckCircle,
  Clock,
  Circle,
  FileIcon,
  AlertCircle,
  FolderOpen,
  Plus,
  X,
  Upload,
  Loader2,
  Mic,
} from "lucide-react";
import { ChatMessage } from "@/app/components/ChatMessage";
import { TaskCard } from "@/app/components/ui/agentic/TaskCard";
import { ToolStep } from "@/app/components/ui/agentic/ToolStep";
import { ThinkingBlock } from "@/app/components/ui/agentic/ThinkingBlock";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { buildEventTimeline, groupMessagesByTask } from "@/lib/messageGrouping";
import { HierarchicalTaskView } from "@/app/components/HierarchicalTaskView";
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
import { useGoogleDrivePicker } from "@/app/hooks/useGoogleDrivePicker";
// WebDevToggle removed - web-dev mode is now set via homepage feature selection
import type { Artifact } from "@/lib/artifactParser";
import { TypingIndicator } from "@/app/components/ui/TypingIndicator";

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
  const inputRef = useRef<HTMLInputElement | null>(null);
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
    forkAndRegenerate,
    fortuneMode,
    activeFeatureId,
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

  // Google Drive file picker
  const handleGoogleDriveFile = useCallback((file: File) => {
    fileUpload.addFiles([file]);
  }, [fileUpload]);

  const googleDrivePicker = useGoogleDrivePicker(handleGoogleDriveFile);

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

  // anyai-style typing dots: show only when the UI has not rendered any AI-visible output yet.
  // This must work in both rendering modes:
  // - HierarchicalTaskView (todos.length > 0)
  // - Legacy timeline rendering (todos.length === 0)
  const showTypingIndicator = useMemo(() => {
    if (!isLoading) return false;
    if (!messages || messages.length === 0) return false;

    if (todos.length > 0) {
      const timeline = buildEventTimeline(messages);
      const hasAnyAiVisibleOutput = timeline.events.some((evt) => {
        if (evt.type === "todo_node") return true;
        if (evt.type !== "content") return false;
        const item = evt.item;
        if (item.type === "message") return item.message.type !== "human";
        return true;
      });
      return !hasAnyAiVisibleOutput;
    }

    const deduplicatedMessages = messages.reduce((acc, msg) => {
      const existingIndex = acc.findIndex((m) => m.id === msg.id);
      if (existingIndex >= 0) {
        acc[existingIndex] = msg;
      } else {
        acc.push(msg);
      }
      return acc;
    }, [] as typeof messages);

    const groupedItems = groupMessagesByTask(deduplicatedMessages);
    const hasAnyAiVisibleOutput = groupedItems.some((item) => {
      if (item.type === "message") return item.message.type !== "human";
      return true;
    });

    return !hasAnyAiVisibleOutput;
  }, [isLoading, messages, todos.length]);

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

  // Handle fork and regenerate - for non-last AI messages
  // Creates a new thread branch and navigates to it
  const handleForkRegenerate = useCallback(async (targetAiMessageId: string) => {
    if (isLoading || !messages || messages.length === 0) return;

    try {
      toast.info("正在创建新分支...", {
        description: "将从该位置重新生成",
      });

      await forkAndRegenerate(targetAiMessageId);

      toast.success("已创建新分支", {
        description: "请发送消息以触发 AI 重新生成",
      });
    } catch (error) {
      toast.error("创建分支失败", {
        description: error instanceof Error ? error.message : "请稍后重试",
      });
    }
  }, [isLoading, messages, forkAndRegenerate]);

  // Handle share - create share link and copy to clipboard
  // targetAiMessageId: if provided, shares up to that AI message
  const handleShare = useCallback(async (targetAiMessageId?: string) => {
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
          body: JSON.stringify({
            target_ai_message_id: targetAiMessageId ?? null,
          }),
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
        description: targetAiMessageId
          ? "任何人都可以通过此链接查看这轮对话"
          : "任何人都可以通过此链接查看完整对话",
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

  // Trigger suggestion generation when AI response completes OR when thread history loads
  const prevIsLoadingRef = useRef(isLoading);
  const prevIsThreadLoadingRef = useRef(isThreadLoading);
  useEffect(() => {
    // Detect when isLoading transitions from true to false (AI finished responding)
    // OR when isThreadLoading transitions from true to false (history loaded)
    const streamCompleted = prevIsLoadingRef.current && !isLoading;
    const historyLoaded = prevIsThreadLoadingRef.current && !isThreadLoading;

    if ((streamCompleted || historyLoaded) && messages && messages.length > 0) {
      // Find the last AI message (not just the last message, which could be a tool result)
      let lastAiMessage: Message | null = null;
      for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].type === "ai") {
          lastAiMessage = messages[i];
          break;
        }
      }
      if (lastAiMessage) {
        const content = extractStringFromMessageContent(lastAiMessage);
        if (content) {
          fetchSuggestedQuestions(content);
        }
      }
    }
    prevIsLoadingRef.current = isLoading;
    prevIsThreadLoadingRef.current = isThreadLoading;
  }, [isLoading, isThreadLoading, messages, fetchSuggestedQuestions]);

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
    inputRef.current?.focus();
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
              <>
                {/* Manus-style Hierarchical Task View when todos exist */}
                {todos.length > 0 ? (
                  <HierarchicalTaskView
                    messages={messages}
                    todos={todos}
                    isLoading={isLoading}
                    stream={stream}
                    graphId={assistant?.graph_id}
                    onRegenerate={handleRegenerate}
                    suggestedQuestions={!isLoading ? suggestedQuestions : undefined}
                    onSuggestionClick={handleSuggestionClick}
                  />
                ) : (
                  /* Legacy Grouped Rendering Logic (no todos) */
                  (() => {
                    // Deduplicate messages by ID - keep only the last occurrence of each ID
                    // This handles streaming where SDK may have multiple entries for same message ID
                    // with progressively growing content (we want the latest/most complete version)
                    const deduplicatedMessages = messages.reduce((acc, msg) => {
                      const existingIndex = acc.findIndex(m => m.id === msg.id);
                      if (existingIndex >= 0) {
                        // Replace with newer version (later in stream = more content)
                        acc[existingIndex] = msg;
                      } else {
                        acc.push(msg);
                      }
                      return acc;
                    }, [] as typeof messages);

                    const groupedItems = groupMessagesByTask(deduplicatedMessages);

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
                                    const isAiMessage = !isUserMessage;

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
                                          const msgIndex = messages?.findIndex(m => m.id === msgId) ?? -1;
                                          if (msgIndex >= 0) handleStartEdit(msgIndex, content);
                                        } : undefined}
                                        onRegenerate={isAiMessage ? (isLastAiMessage ? handleRegenerate : () => handleForkRegenerate(msgId!)) : undefined}
                                        onShare={isAiMessage ? () => handleShare(msgId) : undefined}
                                        hideTools={true}
                                      />
                                    );
                                  }
                                  return null;
                                })}
                              </TaskCard>
                            );
                          } else if (group.type === "timeline_thinking") {
                            // Render Timeline Thinking (flat mode)
                            return (
                              <ThinkingBlock
                                key={group.id}
                                content={group.content}
                                startTime={Date.now()}
                                isStreaming={isLoading && isLastGroup}
                                duration={group.duration}
                                defaultExpanded={false}
                              />
                            );
                          } else if (group.type === "timeline_tool_call") {
                            // Render Timeline Tool Call (flat mode)
                            return (
                              <ToolStep
                                key={group.id}
                                toolName={group.toolName}
                                input={group.args}
                                output={group.result}
                                status={group.status}
                                isLast={isLastGroup}
                              />
                            );
                          } else if (group.type === "timeline_text") {
                            // Check if this is the last AI content group (for showing buttons/suggestions)
                            const isLastAiContent = isLastGroup || groupedItems.slice(groupIdx + 1).every(
                              g => g.type !== "timeline_text" && g.type !== "message"
                            );

                            // For intermediate text blocks: use lightweight MarkdownContent (no action buttons)
                            // For the last text block: use full ChatMessage (with copy/regenerate/share buttons)
                            if (!isLastAiContent) {
                              return (
                                <div key={group.id} className="text-sm leading-relaxed text-primary">
                                  <MarkdownContent content={group.content} />
                                </div>
                              );
                            }

                            // Last AI content block: use ChatMessage with action buttons
                            const syntheticMessage = {
                              id: group.id,
                              type: "ai" as const,
                              content: group.content,
                            };

                            return (
                              <ChatMessage
                                key={group.id}
                                message={syntheticMessage as any}
                                toolCalls={[]}
                                isLoading={false}
                                onRegenerate={handleRegenerate}
                                onShare={() => handleShare()}
                                suggestedQuestions={!isLoading ? suggestedQuestions : undefined}
                                onSuggestionClick={handleSuggestionClick}
                              />
                            );
                          } else if (group.type === "message") {
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
                            const isAiMessage = !isUserMessage;

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
                                  const msgIndex = messages?.findIndex(m => m.id === msgId) ?? -1;
                                  if (msgIndex >= 0) handleStartEdit(msgIndex, content);
                                } : undefined}
                                onRegenerate={isAiMessage ? (isLastAiMessage ? handleRegenerate : () => handleForkRegenerate(msgId!)) : undefined}
                                onShare={isAiMessage ? () => handleShare(msgId) : undefined}
                                suggestedQuestions={isLastAiMessage && !isLoading ? suggestedQuestions : undefined}
                                onSuggestionClick={isLastAiMessage ? handleSuggestionClick : undefined}
                              />
                            );
                          }
                          return null;
                        })}
                      </div>
                    );
                  })()
                )}

                {showTypingIndicator && (
                  <div className="mt-4 flex w-full justify-start">
                    <div className="max-w-[85%] md:max-w-[75%]">
                      <TypingIndicator />
                    </div>
                  </div>
                )}
              </>
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

              {/* Single-line input layout like AnyAI: + | [tag] | input | mic | send */}
              <div className="flex items-center gap-2 px-4 py-3">
                {/* Plus Button with Dropdown and Tooltip */}
                <TooltipProvider delayDuration={300}>
                  <Tooltip>
                    <DropdownMenu>
                      <TooltipTrigger asChild>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="icon"
                            size="icon-sm"
                            className="shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                            disabled={isLoading}
                          >
                            {fileUpload.isUploading || fileUpload.isImporting ? (
                              <Loader2 className="h-5 w-5 animate-spin" />
                            ) : (
                              <Plus className="h-5 w-5" />
                            )}
                          </Button>
                        </DropdownMenuTrigger>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        添加文件
                      </TooltipContent>
                      <DropdownMenuContent align="start" className="w-56">
                        <DropdownMenuItem onClick={() => googleDrivePicker.openPicker()} disabled={googleDrivePicker.isLoading}>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M12 2L2 19.5h20L12 2z" />
                            <path d="M12 2l10 17.5" />
                            <path d="M2 19.5h20" />
                            <path d="M7 12l5 7.5 5-7.5" />
                          </svg>
                          <span>从 Google Drive 添加</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setLibraryDialogOpen(true)}>
                          <FolderOpen className="h-4 w-4" />
                          <span>从库中选择</span>
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => fileUpload.inputRef.current?.click()}>
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                          </svg>
                          <span>从本地文件添加</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </Tooltip>
                </TooltipProvider>

                {/* FilePanel button - show when there's a thread OR local files */}
                {(showFilePanelButton || fileUpload.files.length > 0) && onOpenFilePanel && (
                  <Button
                    type="button"
                    variant="icon"
                    size="icon-sm"
                    onClick={onOpenFilePanel}
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                    title="查看文件"
                  >
                    <FolderOpen className="h-5 w-5" />
                  </Button>
                )}

                {/* Feature Mode Tags - shown when a feature is active (locked after sending) */}
                {activeFeatureId && (() => {
                  const featureConfig: Record<string, { label: string; color: string }> = {
                    'image': { label: 'AI 生图', color: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-400' },
                    'web-dev': { label: '网页开发', color: 'bg-blue-500/15 text-blue-600 dark:text-blue-400' },
                    'fortune': { label: '五行算命', color: 'bg-orange-500/15 text-orange-600 dark:text-orange-400' },
                    'slides': { label: '制作幻灯片', color: 'bg-purple-500/15 text-purple-600 dark:text-purple-400' },
                    'resume': { label: '制作简历', color: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' },
                    'prompt-optimize': { label: '提示词优化', color: 'bg-violet-500/15 text-violet-600 dark:text-violet-400' },
                    'deai': { label: '去AI化', color: 'bg-rose-500/15 text-rose-600 dark:text-rose-400' },
                  };
                  const config = featureConfig[activeFeatureId];
                  if (!config) return null;
                  return (
                    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0", config.color)}>
                      <span>{config.label}</span>
                    </div>
                  );
                })()}

                {/* File chips - show uploaded files inline */}
                {fileUpload.files.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-muted/50 border shrink-0"
                  >
                    <span className="max-w-[80px] truncate">{file.file.name}</span>
                    <button
                      type="button"
                      onClick={() => fileUpload.removeFile(file.id)}
                      className="p-0.5 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}

                {/* Input Field */}
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      if (input.trim() && !isLoading) {
                        handleSubmit();
                      }
                    }
                  }}
                  placeholder={
                    isLoading
                      ? "Running..."
                      : webDevMode
                        ? "描述你想要开发的网页..."
                        : "继续对话..."
                  }
                  disabled={isLoading}
                  className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-5 outline-none min-w-0"
                />

                {/* Voice Button */}
                <Button
                  type="button"
                  variant="icon"
                  size="icon-sm"
                  className="shrink-0 text-muted-foreground hover:text-foreground"
                  disabled={isLoading}
                >
                  <Mic className="h-5 w-5" />
                </Button>

                {/* Send/Stop Button */}
                {isLoading ? (
                  <Button
                    type="button"
                    variant="send"
                    size="icon-sm"
                    onClick={stopStream}
                    className="shrink-0"
                  >
                    <Square className="h-3 w-3 fill-current" />
                  </Button>
                ) : (
                  <Button
                    type="submit"
                    variant="send"
                    size="icon-sm"
                    disabled={submitDisabled || !input.trim()}
                    className="shrink-0"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </form>
          </div>
        </div>
      </div >
    </>
  );
});

ChatInterface.displayName = "ChatInterface";
