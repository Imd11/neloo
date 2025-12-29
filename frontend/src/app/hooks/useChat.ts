"use client";

import { useCallback, useRef, useEffect } from "react";
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
          }),
        });

        if (response.ok) {
          console.log(`[useChat] Created thread record for: ${threadId.slice(0, 8)}...`);
          createdThreadsRef.current.add(threadId);
          onHistoryRevalidate?.();
          return;
        } else {
          const errorText = await response.text();
          // If the thread belongs to another user, clear it immediately to prevent data leakage.
          if (response.status === 403) {
            console.warn("[useChat] Thread ownership mismatch, clearing threadId");
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
  }, [threadId, session, config, onHistoryRevalidate, setThreadId]);

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
    },
    [stream, activeAssistant?.config, onHistoryRevalidate]
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
  };
}
