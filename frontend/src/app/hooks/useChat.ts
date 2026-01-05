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
import { getLatestArtifact, type Artifact } from "@/lib/artifactParser";
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

  // Fetch thread mode when switching to an existing thread
  useEffect(() => {
    if (!threadId || !session || !config) return;

    const fetchThreadMode = async () => {
      try {
        const response = await fetch(
          `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (response.ok) {
          const threadData = await response.json();
          const mode = threadData.mode || "default";
          setThreadMode(mode);
          setWebDevMode(mode === "web-dev");
        }
      } catch (error) {
        console.error("[useChat] Failed to fetch thread mode:", error);
      }
    };

    fetchThreadMode();
  }, [threadId, session, config]);

  // Reset webDevMode when threadId is cleared (new thread)
  useEffect(() => {
    if (!threadId) {
      setThreadMode("default");
      // Don't reset webDevMode here - let user set it before first message
    }
  }, [threadId]);

  // Handle errors, especially 404 when thread doesn't exist
  const handleError = (error: unknown) => {
    // Check if it's a 404 error (thread not found)
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("404") || errorMessage.includes("not found")) {
      console.warn("Thread not found, clearing threadId from URL");
      setThreadId(null);
    }
    onHistoryRevalidate?.();
  };

  const stream = useStream<StateType>({
    assistantId: activeAssistant?.assistant_id || "",
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
          config: { ...(activeAssistant?.config ?? {}), recursion_limit: 100 },
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
          recursion_limit: 100,
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

  // Parse artifacts from the latest AI message when in web-dev mode
  const currentArtifact = useMemo(() => {
    if (!webDevMode && threadMode !== "web-dev") {
      return null;
    }

    // Find the last AI message
    const messages = stream.messages ?? [];
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.type === "ai") {
        const content = extractStringFromMessageContent(msg);
        if (content) {
          const result = getLatestArtifact(content, stream.isLoading);
          if (result.artifact) {
            return {
              artifact: result.artifact,
              isComplete: result.isComplete,
            };
          }
        }
        break; // Only check the last AI message
      }
    }
    return null;
  }, [stream.messages, stream.isLoading, webDevMode, threadMode]);

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
    webDevMode: webDevMode || threadMode === "web-dev",
    enableWebDevMode,
    isModeLocked,
    currentArtifact,
  };
}
