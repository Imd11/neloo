"use client";

import { useCallback, useRef, useEffect, useState, useMemo } from "react";
import { useStream } from "@langchain/langgraph-sdk/react";
import {
  type Message,
  type Assistant,
  type Checkpoint,
} from "@langchain/langgraph-sdk";
import { v4 as uuidv4 } from "uuid";
import type { UseStreamThread } from "@langchain/langgraph-sdk/react";
import type { TodoItem } from "@/app/types/types";
import { useClient } from "@/providers/ClientProvider";
import { useQueryState } from "nuqs";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";
import { useAgentContext } from "@/providers/AgentProvider";
import { toast } from "sonner";
import { extractStringFromMessageContent } from "@/app/utils/utils";

// Helper to save a message to the database
async function saveMessageToDb(
  config: { deploymentUrl: string } | null,
  accessToken: string | undefined,
  threadId: string,
  message: Message
): Promise<void> {
  if (!config?.deploymentUrl || !accessToken || !threadId) return;

  try {
    const response = await fetch(
      `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}/messages`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({
          message_id: message.id,
          role: message.type === "human" ? "user" : message.type === "ai" ? "assistant" : message.type,
          message_data: message,
        }),
      }
    );

    if (response.ok) {
      console.log(`[useChat] Saved message ${message.id?.slice(0, 8)}... to database`);
    } else {
      console.error("[useChat] Failed to save message:", await response.text());
    }
  } catch (error) {
    console.error("[useChat] Error saving message:", error);
  }
}

export type StateType = {
  messages: Message[];
  todos: TodoItem[];
  files: Record<string, string>;
  email?: {
    id?: string;
    subject?: string;
    page_content?: string;
  };
  ui?: any;
};

export function useChat({
  activeAssistant,
  onHistoryRevalidate,
  thread,
}: {
  activeAssistant: Assistant | null;
  onHistoryRevalidate?: () => void;
  thread?: UseStreamThread<StateType>;
}) {
  const [threadId, setThreadId] = useQueryState("threadId");
  const client = useClient();
  const { session } = useAuth();
  const config = getConfig();
  const createdThreadsRef = useRef<Set<string>>(new Set());
  const creatingThreadsRef = useRef<Set<string>>(new Set());
  const recoveringThreadsRef = useRef<Set<string>>(new Set());

  // Web Development mode state
  const [webDevMode, setWebDevMode] = useState(false);
  const [fortuneMode, setFortuneMode] = useState(false);
  const [threadMode, setThreadMode] = useState<string>("default");

  // Active agent from shared context (for sidebar -> chat integration)
  const { activeAgent, setActiveAgent, clearAgent } = useAgentContext();

  // Generic active feature tracking (for slides, resume, prompt-optimize, deai, etc.)
  const [activeFeatureId, setActiveFeatureId] = useState<string | null>(null);

  // Track if thread history is unavailable (e.g., LangGraph checkpoint lost after restart)
  const [historyUnavailable, setHistoryUnavailable] = useState(false);

  // Track whether we've generated a title for this thread.
  // Also keep the first user message so we can generate a title once the thread record exists.
  const titleGeneratedRef = useRef<Set<string>>(new Set());
  const pendingFirstMessageRef = useRef<string | null>(null);

  const generateTitleForThread = useCallback(
    async (currentThreadId: string, userMessage: string) => {
      if (!config?.deploymentUrl || !session?.access_token) return;
      if (titleGeneratedRef.current.has(currentThreadId)) return;

      titleGeneratedRef.current.add(currentThreadId);

      try {
        const response = await fetch(
          `${config.deploymentUrl}/api/threads/${encodeURIComponent(currentThreadId)}/generate-title`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ user_message: userMessage }),
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.generated) {
            console.log(`[useChat] Generated title: ${data.title}`);
            onHistoryRevalidate?.();
          }
        }
      } catch (error) {
        console.error("[useChat] Failed to generate title:", error);
      }
    },
    [config?.deploymentUrl, session?.access_token, onHistoryRevalidate]
  );

  // If the URL contains a threadId but the user isn't logged in, clear it.
  // This prevents unauthenticated users from accessing globally addressable threads.
  useEffect(() => {
    if (!threadId) return;
    if (session?.access_token) return;
    setThreadId(null);
  }, [threadId, session?.access_token, setThreadId]);

  // Create/verify the thread record in the DB when threadId is set.
  // This is also our ownership gate: if the thread exists but belongs to another user, the backend returns 403.
  useEffect(() => {
    if (!threadId || !session || !config) return;

    // Skip if already created/verified for this threadId
    if (createdThreadsRef.current.has(threadId)) return;
    if (creatingThreadsRef.current.has(threadId)) return;

    creatingThreadsRef.current.add(threadId);

    // Create thread in database
    const createThread = async () => {
      try {
        const response = await fetch(`${config.deploymentUrl}/api/threads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            langgraph_thread_id: threadId,
            title: "New Task",
            mode: webDevMode ? "web-dev" : "default",
          }),
        });

        if (response.ok) {
          const threadData = await response.json();
          console.log(`[useChat] Created thread record for: ${threadId.slice(0, 8)}... mode=${threadData.mode}`);
          createdThreadsRef.current.add(threadId);

          // Update thread mode from server response
          setThreadMode(threadData.mode || "default");

          onHistoryRevalidate?.();

          // If we already sent the first message before the DB record existed,
          // generate a title now that creation/verification succeeded.
          const pendingFirstMessage = pendingFirstMessageRef.current;
          if (pendingFirstMessage) {
            pendingFirstMessageRef.current = null;
            await generateTitleForThread(threadId, pendingFirstMessage);
          }
          return;
        } else {
          const errorText = await response.text();
          // If the thread belongs to another user, clear it immediately to prevent data leakage.
          if (response.status === 403) {
            console.warn("[useChat] Thread ownership mismatch, clearing threadId");
            pendingFirstMessageRef.current = null;
            setThreadId(null);
            toast.error("无权限访问该对话", {
              description: "该对话不属于当前账号，已为你切换到新对话。",
            });
            return;
          }
          console.error("[useChat] Failed to create thread:", errorText);
        }
      } catch (error) {
        console.error("[useChat] Thread creation error:", error);
      } finally {
        creatingThreadsRef.current.delete(threadId);
      }
    };

    createThread();
  }, [threadId, session, config, onHistoryRevalidate, setThreadId, generateTitleForThread, webDevMode]);

  // Note: Thread mode is now fetched as part of the createThread flow above.
  // The POST /api/threads endpoint returns the thread data (including mode) for both
  // new and existing threads, so we don't need a separate GET request.

  // Reset mode and historyUnavailable when threadId changes
  useEffect(() => {
    if (!threadId) {
      setThreadMode("default");
      setWebDevMode(false);  // Reset to default for new threads
    }
    // Reset historyUnavailable flag when switching to a different thread
    setHistoryUnavailable(false);
  }, [threadId]);

  const recoverRuntimeThread = useCallback(
    async (currentThreadId: string): Promise<boolean> => {
      if (!config?.deploymentUrl || !session?.access_token) return false;
      if (recoveringThreadsRef.current.has(currentThreadId)) return false;

      recoveringThreadsRef.current.add(currentThreadId);

      try {
        const mode = (threadMode === "web-dev" || webDevMode) ? "web-dev" : "default";
        const response = await fetch(`${config.deploymentUrl}/api/threads`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            langgraph_thread_id: currentThreadId,
            title: "New Task",
            mode,
          }),
        });

        if (!response.ok) {
          const detail = await response.text().catch(() => "");
          console.error(`[useChat] Runtime recover failed: ${response.status} ${detail}`);
          return false;
        }

        createdThreadsRef.current.add(currentThreadId);
        console.log(`[useChat] Runtime recover succeeded for thread: ${currentThreadId.slice(0, 8)}...`);
        return true;
      } catch (error) {
        console.error("[useChat] Runtime recover error:", error);
        return false;
      } finally {
        recoveringThreadsRef.current.delete(currentThreadId);
      }
    },
    [config?.deploymentUrl, session?.access_token, threadMode, webDevMode]
  );

  // Handle errors, especially 404 when thread history doesn't exist in LangGraph
  const handleError = async (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const lowerError = errorMessage.toLowerCase();

    // Save any unsent messages even on error (important for message persistence)
    const currentThreadId = threadId;
    const token = session?.access_token;
    const currentConfig = config;

    if (currentThreadId && token && currentConfig) {
      const messagesToSave = messagesSnapshotRef.current;
      const savePromises: Promise<void>[] = [];

      for (const msg of messagesToSave) {
        if (msg.id && !savedMessageIdsRef.current.has(msg.id)) {
          savedMessageIdsRef.current.add(msg.id);
          savePromises.push(saveMessageToDb(currentConfig, token, currentThreadId, msg));
        }
      }

      if (savePromises.length > 0) {
        console.log(`[useChat] Saving ${savePromises.length} messages on error...`);
        await Promise.all(savePromises);
      }
    }

    const isRuntimeThreadMissing =
      lowerError.includes("thread or assistant not found") ||
      (lowerError.includes("/runs/stream") && lowerError.includes("404"));
    if (isRuntimeThreadMissing && currentThreadId) {
      const recovered = await recoverRuntimeThread(currentThreadId);
      if (recovered) {
        toast.warning("会话运行态已恢复", {
          description: "请重新发送一次刚才的消息。",
          duration: 5000,
        });
      } else {
        toast.error("会话恢复失败", {
          description: "请刷新页面后重试。",
          duration: 5000,
        });
      }
      onHistoryRevalidate?.();
      return;
    }

    const isHistoryMissingError =
      lowerError.includes("/history") ||
      lowerError.includes("thread history not found in langgraph");

    // Check if it's a history-not-found error (checkpoint lost after restart)
    if (isHistoryMissingError) {
      console.warn("[useChat] Thread history not found in LangGraph (checkpoint may have been lost):", threadId);

      // Don't clear threadId - that causes blank UI and triggers new thread creation
      // Instead, mark history as unavailable and show user notification
      setHistoryUnavailable(true);

      toast.warning("对话历史不可用", {
        description: "该对话的消息历史已丢失（服务器重启后可能发生）。你可以继续发送新消息。",
        duration: 6000,
      });
    } else {
      // For other errors, show generic error toast
      console.error("[useChat] Stream error:", error);
      toast.error("发生错误", {
        description: errorMessage.slice(0, 100),
      });
    }

    onHistoryRevalidate?.();
  };

  // Compute the effective web dev mode (either explicitly enabled or from thread mode)
  const isWebDevModeActive = webDevMode || threadMode === "web-dev";

  // Compute the effective fortune mode (either explicitly enabled or from thread mode)
  const isFortuneModeActive = fortuneMode || threadMode === "fortune";

  // Compute the effective assistant ID based on active mode
  // Priority: fortune mode > web-dev mode > default
  const effectiveAssistantId = useMemo(() => {
    const baseId = activeAssistant?.graph_id || activeAssistant?.assistant_id || "";

    // Fortune mode takes priority
    if (isFortuneModeActive && baseId && !baseId.endsWith("-fortune")) {
      const fortuneId = `${baseId}-fortune`;
      console.log(`[useChat] Using fortune graph: ${fortuneId}`);
      return fortuneId;
    }

    // Then web dev mode
    if (isWebDevModeActive && baseId && !baseId.endsWith("-web-dev")) {
      const webDevId = `${baseId}-web-dev`;
      console.log(`[useChat] Using web-dev graph: ${webDevId}`);
      return webDevId;
    }

    console.log(`[useChat] Using default graph: ${baseId}`);
    return baseId;
  }, [activeAssistant?.graph_id, activeAssistant?.assistant_id, isWebDevModeActive, isFortuneModeActive]);

  // Ref to hold the latest messages snapshot for saving before history rehydrate
  const messagesSnapshotRef = useRef<Message[]>([]);
  const pendingSavePromisesRef = useRef<Promise<void>[]>([]);

  const stream = useStream<StateType>({
    assistantId: effectiveAssistantId,
    client: client ?? undefined,
    reconnectOnMount: true,
    threadId: threadId ?? null,
    onThreadId: setThreadId,
    defaultHeaders: {
      "x-auth-scheme": "langsmith",
      ...(session?.access_token
        ? { Authorization: `Bearer ${session.access_token}` }
        : {}),
    },
    // Save all unsaved messages and AWAIT completion BEFORE revalidating history
    // This prevents race condition where history rehydrate overwrites unsaved messages
    onFinish: async () => {
      const currentThreadId = threadId;
      const token = session?.access_token;
      const currentConfig = config;

      if (!currentThreadId || !token || !currentConfig) {
        onHistoryRevalidate?.();
        return;
      }

      // Use the latest snapshot of messages (captured in useEffect below)
      const messagesToSave = messagesSnapshotRef.current;
      const savePromises: Promise<void>[] = [];

      for (const msg of messagesToSave) {
        if (msg.id && !savedMessageIdsRef.current.has(msg.id)) {
          // Save all message types (human, ai, tool)
          savedMessageIdsRef.current.add(msg.id);
          savePromises.push(saveMessageToDb(currentConfig, token, currentThreadId, msg));
        }
      }

      // Wait for all saves to complete BEFORE revalidating
      if (savePromises.length > 0) {
        console.log(`[useChat] Saving ${savePromises.length} messages before rehydrate...`);
        await Promise.all(savePromises);
        console.log(`[useChat] All messages saved, now revalidating history`);
      }

      onHistoryRevalidate?.();
    },
    onError: handleError,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
    // Enable state history for loading historical threads
    // Note: This causes history to replace streaming data after stream ends
    // We handle this by ensuring backend saves complete message_data
    fetchStateHistory: true,
  });

  const sendMessage = useCallback(
    (content: string, hiddenPrefix?: string) => {
      // For display: only show user content
      // For backend: prepend hiddenPrefix if provided, or activeAgent's systemPrompt
      const displayContent = content;

      // Build the backend content with agent context if active
      let backendContent = content;
      if (activeAgent?.systemPrompt) {
        // Prepend agent context as hidden system instruction
        const agentContext = `[System: You are now acting as the agent "${activeAgent.name}". Follow these instructions:\n${activeAgent.systemPrompt}\n---\nUser message:]\n`;
        backendContent = agentContext + content;
      } else if (hiddenPrefix) {
        backendContent = hiddenPrefix + content;
      }

      // Create message with display content for UI
      const displayMessage: Message = { id: uuidv4(), type: "human", content: displayContent };
      // Create message with full content for backend
      const backendMessage: Message = { id: displayMessage.id, type: "human", content: backendContent };

      const currentMessages = stream.messages ?? [];
      const isFirstMessage = currentMessages.length === 0;

      stream.submit(
        { messages: [backendMessage] },  // Send full content to backend
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), displayMessage],  // Show only user content in UI
          }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 1000 },
        }
      );

      // Save user message to database immediately (will be handled in onFinish with proper awaiting)
      // The message is already in messagesSnapshotRef and will be saved in onFinish
      // This ensures no race condition with history rehydrate
      // Update thread list immediately when sending a message
      onHistoryRevalidate?.();

      // Generate title for new threads (first message) - use display content for title
      if (isFirstMessage) {
        // Capture the first user message so we can generate a title once the thread is created/verified.
        pendingFirstMessageRef.current = displayContent;

        // If the thread record is already created/verified, generate immediately.
        if (threadId && createdThreadsRef.current.has(threadId)) {
          void generateTitleForThread(threadId, displayContent);
          pendingFirstMessageRef.current = null;
        }
      }
    },
    [stream, activeAssistant?.config, onHistoryRevalidate, threadId, generateTitleForThread, session?.access_token, config, activeAgent]
  );

  // Track saved message IDs to avoid duplicate saves
  const savedMessageIdsRef = useRef<Set<string>>(new Set());

  // Keep messagesSnapshotRef updated with the latest messages during streaming
  // This captures the "complete state" before history rehydrate overwrites it
  useEffect(() => {
    const currentMessages = stream.messages ?? [];
    if (currentMessages.length > 0) {
      messagesSnapshotRef.current = [...currentMessages];
    }
  }, [stream.messages]);

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      // Only use checkpoint if it has a valid string checkpoint_id
      // This prevents HTTP 422 when checkpoint_id is null (from Supabase history)
      const hasValidCheckpoint = checkpoint &&
        typeof checkpoint.checkpoint_id === 'string' &&
        checkpoint.checkpoint_id.length > 0;

      if (hasValidCheckpoint) {
        stream.submit(undefined, {
          ...(optimisticMessages
            ? { optimisticValues: { messages: optimisticMessages } }
            : {}),
          config: activeAssistant?.config,
          checkpoint: checkpoint,
          ...(isRerunningSubagent
            ? { interruptAfter: ["tools"] }
            : { interruptBefore: ["tools"] }),
        });
      } else {
        stream.submit(
          { messages },
          { config: activeAssistant?.config, interruptBefore: ["tools"] }
        );
      }
    },
    [stream, activeAssistant?.config]
  );

  const setFiles = useCallback(
    async (files: Record<string, string>) => {
      if (!threadId) return;
      // TODO: missing a way how to revalidate the internal state
      // I think we do want to have the ability to externally manage the state
      await client.threads.updateState(threadId, { values: { files } });
    },
    [client, threadId]
  );

  const continueStream = useCallback(
    (hasTaskToolCall?: boolean) => {
      stream.submit(undefined, {
        config: {
          ...(activeAssistant?.config || {}),
          recursion_limit: 1000,
        },
        ...(hasTaskToolCall
          ? { interruptAfter: ["tools"] }
          : { interruptBefore: ["tools"] }),
      });
      // Update thread list when continuing stream
      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  const markCurrentThreadAsResolved = useCallback(() => {
    stream.submit(null, { command: { goto: "__end__", update: null } });
    // Update thread list when marking thread as resolved
    onHistoryRevalidate?.();
  }, [stream, onHistoryRevalidate]);

  const resumeInterrupt = useCallback(
    (value: any) => {
      stream.submit(null, { command: { resume: value } });
      // Update thread list when resuming from interrupt
      onHistoryRevalidate?.();
    },
    [stream, onHistoryRevalidate]
  );

  const stopStream = useCallback(() => {
    stream.stop();
  }, [stream]);

  // Check if mode is locked (has messages)
  const isModeLocked = useMemo(() => {
    return (stream.messages ?? []).length > 0;
  }, [stream.messages]);

  // Enable web dev mode (only allowed before first message)
  const enableWebDevMode = useCallback(() => {
    if (!isModeLocked) {
      setWebDevMode(true);
    }
  }, [isModeLocked]);

  // Edit a message and re-run from that point (branching behavior)
  // This truncates all messages after the edited message and re-generates AI response
  const editMessageAndRerun = useCallback(
    (messageIndex: number, newContent: string) => {
      const currentMessages = stream.messages ?? [];
      if (messageIndex < 0 || messageIndex >= currentMessages.length) {
        console.error("[useChat] Invalid message index for edit:", messageIndex);
        return;
      }

      // Truncate: keep messages before the edited one, then add the new message
      const truncatedMessages = currentMessages.slice(0, messageIndex);
      const newMessage: Message = { id: uuidv4(), type: "human", content: newContent };

      // Submit with the truncated history + new message
      stream.submit(
        { messages: [...truncatedMessages, newMessage] },
        {
          optimisticValues: { messages: [...truncatedMessages, newMessage] },
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 1000 },
        }
      );

      onHistoryRevalidate?.();
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
  );

  // Regenerate the last AI response (removes it and re-runs from the last user message)
  const regenerateLastResponse = useCallback(() => {
    const currentMessages = stream.messages ?? [];
    if (currentMessages.length === 0) return;

    // Find the last human message index
    let lastHumanIndex = -1;
    for (let i = currentMessages.length - 1; i >= 0; i--) {
      if (currentMessages[i].type === "human") {
        lastHumanIndex = i;
        break;
      }
    }

    if (lastHumanIndex === -1) {
      console.error("[useChat] No human message found for regenerate");
      return;
    }

    // Get the last human message content
    const lastHumanMessage = currentMessages[lastHumanIndex];
    const content = extractStringFromMessageContent(lastHumanMessage);

    // Truncate: keep messages up to and including the last human message
    const truncatedMessages = currentMessages.slice(0, lastHumanIndex + 1);

    // Re-submit to generate a new response
    stream.submit(
      { messages: truncatedMessages },
      {
        optimisticValues: { messages: truncatedMessages },
        config: { ...(activeAssistant?.config ?? {}), recursion_limit: 1000 },
      }
    );

    onHistoryRevalidate?.();
  }, [stream, activeAssistant?.config, onHistoryRevalidate]);

  // Fork thread at a specific AI message and regenerate
  // This creates a new thread with history copied up to the anchor human message
  const forkAndRegenerate = useCallback(async (targetAiMessageId: string) => {
    if (!threadId || !config?.deploymentUrl || !session?.access_token) {
      console.error("[useChat] Missing requirements for fork");
      return;
    }

    try {
      // Call Fork API
      const response = await fetch(
        `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}/fork`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            fork_target_ai_message_id: targetAiMessageId,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || "Fork failed");
      }

      const data = await response.json();
      console.log(`[useChat] Forked to new thread: ${data.new_thread_id}, copied ${data.messages_copied} messages`);

      // Navigate to new thread - this will trigger history load
      setThreadId(data.new_thread_id);

      // After navigation, the new thread will load its history (copied messages)
      // The frontend will show the copied conversation
      // User can then submit a new message to trigger AI regeneration

      onHistoryRevalidate?.();

      return data;
    } catch (error) {
      console.error("[useChat] Fork failed:", error);
      throw error;
    }
  }, [threadId, config, session?.access_token, setThreadId, onHistoryRevalidate]);

  return {
    stream,
    todos: stream.values.todos ?? [],
    files: stream.values.files ?? {},
    email: stream.values.email,
    ui: stream.values.ui,
    setFiles,
    messages: stream.messages,
    isLoading: stream.isLoading,
    isThreadLoading: stream.isThreadLoading,
    interrupt: stream.interrupt,
    getMessagesMetadata: stream.getMessagesMetadata,
    sendMessage,
    runSingleStep,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
    // Edit and regenerate with branching
    editMessageAndRerun,
    regenerateLastResponse,
    forkAndRegenerate,
    // Web Dev mode
    webDevMode: isWebDevModeActive,
    enableWebDevMode,
    isModeLocked,
    // Fortune mode (五行算命)
    fortuneMode: isFortuneModeActive,
    setFortuneMode,
    // Generic feature mode
    activeFeatureId,
    setActiveFeatureId,
    // Thread metadata
    threadId,
    // History availability
    historyUnavailable,
    // Active agent for context injection
    activeAgent,
    setActiveAgent,
  };
}
