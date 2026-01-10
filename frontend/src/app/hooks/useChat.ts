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
import { toast } from "sonner";
import { extractStringFromMessageContent } from "@/app/utils/utils";

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

  // Web Development mode state
  const [webDevMode, setWebDevMode] = useState(false);
  const [threadMode, setThreadMode] = useState<string>("default");

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

  // Handle errors, especially 404 when thread history doesn't exist in LangGraph
  const handleError = (error: unknown) => {
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check if it's a 404 error (thread history not found in LangGraph checkpoint store)
    // This happens when LangGraph Server restarts and loses in-memory checkpoints
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
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

  // Compute the effective assistant ID based on web dev mode
  // When webDevMode is active, use the -web-dev variant of the graph
  const effectiveAssistantId = useMemo(() => {
    const baseId = activeAssistant?.graph_id || activeAssistant?.assistant_id || "";
    // If web dev mode is enabled and we have a base ID, use the web-dev variant
    if (isWebDevModeActive && baseId && !baseId.endsWith("-web-dev")) {
      const webDevId = `${baseId}-web-dev`;
      console.log(`[useChat] Using web-dev graph: ${webDevId}`);
      return webDevId;
    }
    console.log(`[useChat] Using default graph: ${baseId}`);
    return baseId;
  }, [activeAssistant?.graph_id, activeAssistant?.assistant_id, isWebDevModeActive]);

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
    // Revalidate thread list when stream finishes, errors, or creates new thread
    onFinish: onHistoryRevalidate,
    onError: handleError,
    onCreated: onHistoryRevalidate,
    experimental_thread: thread,
    // Enable state history fetching to support history access
    fetchStateHistory: true,
  });

  const sendMessage = useCallback(
    (content: string) => {
      const newMessage: Message = { id: uuidv4(), type: "human", content };
      const currentMessages = stream.messages ?? [];
      const isFirstMessage = currentMessages.length === 0;

      stream.submit(
        { messages: [newMessage] },
        {
          optimisticValues: (prev) => ({
            messages: [...(prev.messages ?? []), newMessage],
          }),
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 1000 },
        }
      );
      // Update thread list immediately when sending a message
      onHistoryRevalidate?.();

      // Generate title for new threads (first message)
      if (isFirstMessage) {
        // Capture the first user message so we can generate a title once the thread is created/verified.
        pendingFirstMessageRef.current = content;

        // If the thread record is already created/verified, generate immediately.
        if (threadId && createdThreadsRef.current.has(threadId)) {
          void generateTitleForThread(threadId, content);
          pendingFirstMessageRef.current = null;
        }
      }
    },
    [stream, activeAssistant?.config, onHistoryRevalidate, threadId, generateTitleForThread]
  );

  const runSingleStep = useCallback(
    (
      messages: Message[],
      checkpoint?: Checkpoint,
      isRerunningSubagent?: boolean,
      optimisticMessages?: Message[]
    ) => {
      if (checkpoint) {
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
    // Web Dev mode
    webDevMode: isWebDevModeActive,
    enableWebDevMode,
    isModeLocked,
    // History unavailable flag - true when LangGraph checkpoint was lost
    historyUnavailable,
  };
}
