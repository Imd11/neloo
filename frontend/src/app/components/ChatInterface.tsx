"use client";

import React, { useCallback, useState, useEffect, useRef, useMemo } from "react";
import { Message } from "@langchain/langgraph-sdk";
import { v4 as uuid } from "uuid";
import { useChatContext } from "@/providers/ChatProvider";
import { TodoItem } from "@/app/types/types";
import { MessageGroup } from "@/app/components/MessageGroup";
import { ChatInput } from "@/app/components/ChatInput";
import { TodoList } from "@/app/components/TodoList";
import { FilePanel } from "@/app/components/FilePanel";
import { FilesPopover } from "@/app/components/FilesPopover";
import { TriangleAlert, FileIcon } from "lucide-react";
import { useQueryState } from "nuqs";

const MAX_VISIBLE_CHARS = 100000;

type Metadata = {
  tool_calls?: {
    id: string;
    name: string;
    args: any;
  }[];
  tool_result?: any;
  agent_node_name?: string;
  run_id?: string;
  checkpoint_ns?: string;
};

function isToolMessage(msg: Message, name?: string): boolean {
  const metadata = (msg.additional_kwargs?.metadata || {}) as Metadata;
  if (!metadata.tool_calls?.length) return false;
  if (!name) return true;
  return metadata.tool_calls.some((tc) => tc.name === name);
}

function groupMessages(messages: Message[]): Message[][] {
  const groups: Message[][] = [];
  let currentGroup: Message[] = [];
  let lastTodoToolCall: any = null;

  for (const msg of messages) {
    if (msg.type === "human") {
      if (currentGroup.length > 0) {
        groups.push(currentGroup);
        currentGroup = [];
      }
      currentGroup.push(msg);
    } else if (msg.type === "ai") {
      currentGroup.push(msg);
      const metadata = (msg.additional_kwargs?.metadata || {}) as Metadata;
      const todoToolCall = metadata.tool_calls?.find(
        (tc) => tc.name === "TodoWrite"
      );
      if (todoToolCall) lastTodoToolCall = todoToolCall;
    } else if (msg.type === "tool") {
      currentGroup.push(msg);
    }
  }

  if (currentGroup.length > 0) groups.push(currentGroup);
  return groups;
}

interface ChatInterfaceProps {
  assistant: any;
}

export function ChatInterface({ assistant }: ChatInterfaceProps) {
  const [threadId] = useQueryState("threadId");
  const {
    todos,
    files,
    email,
    ui,
    messages,
    isLoading,
    isThreadLoading,
    interrupt,
    sendMessage,
    continueStream,
    stopStream,
    markCurrentThreadAsResolved,
    resumeInterrupt,
  } = useChatContext();

  const [metaOpen, setMetaOpen] = useState<"todos" | "files" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const groupedMessages = useMemo(() => groupMessages(messages), [messages]);

  const totalVisibleChars = useMemo(
    () =>
      messages.reduce((sum, msg) => {
        const content =
          typeof msg.content === "string" ? msg.content : JSON.stringify(msg.content);
        return sum + content.length;
      }, 0),
    [messages]
  );

  const hasTodos = todos.length > 0;
  const hasFiles = Object.keys(files).length > 0;

  const todosTrigger = (() => {
    if (!hasTodos) return null;
    return (
      <button
        type="button"
        onClick={() =>
          setMetaOpen((prev) => (prev === "todos" ? null : "todos"))
        }
        className="flex flex-shrink-0 cursor-pointer items-center gap-2 px-[18px] py-3 text-left text-sm"
        aria-expanded={metaOpen === "todos"}
      >
        <span className="flex h-4 min-w-4 items-center justify-center rounded-full bg-[#2F6868] px-0.5 text-[10px] leading-[16px] text-white">
          {todos.length}
        </span>
        Tasks
      </button>
    );
  })();

  const filesTrigger = (() => {
    const fileCount = Object.keys(files).length;
    return (
      <button
        type="button"
        onClick={() =>
          setMetaOpen((prev) =>
            prev === "files" ? null : "files"
          )
        }
        className="flex flex-shrink-0 cursor-pointer items-center gap-2 px-[18px] py-3 text-left text-sm"
        aria-expanded={metaOpen === "files"}
      >
        <FileIcon size={16} />
        Files
        {fileCount > 0 && (
          <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
            {fileCount}
          </span>
        )}
      </button>
    );
  })();

  const handleSendMessage = (content: string) => {
    setMetaOpen(null);
    sendMessage(content);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-3 md:px-4">
        {isThreadLoading ? (
          <div className="flex h-full items-center justify-center">
            <p className="text-muted-foreground">Loading thread...</p>
          </div>
        ) : (
          <div className="mx-auto max-w-4xl py-6">
            <div className="space-y-4">
              {groupedMessages.map((group, idx) => (
                <MessageGroup
                  key={`group-${idx}`}
                  messages={group}
                  files={files}
                  continueStream={continueStream}
                  stopStream={stopStream}
                  isLoading={isLoading}
                  interrupt={interrupt}
                  resumeInterrupt={resumeInterrupt}
                  markCurrentThreadAsResolved={markCurrentThreadAsResolved}
                />
              ))}
            </div>

            <div className="py-4">
              {!isLoading && totalVisibleChars > MAX_VISIBLE_CHARS && (
                <div className="mb-4 flex items-start gap-3 rounded-lg bg-yellow-50 p-4 dark:bg-yellow-950/20">
                  <TriangleAlert className="h-5 w-5 flex-shrink-0 text-yellow-600 dark:text-yellow-500" />
                  <div className="flex-1">
                    <h3 className="font-medium text-yellow-800 dark:text-yellow-200">
                      Large conversation detected
                    </h3>
                    <p className="mt-1 text-sm text-yellow-700 dark:text-yellow-300">
                      Your conversation has grown quite large. Consider starting
                      a new thread to improve performance.
                    </p>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          </div>
        )}
      </div>

      <div className="flex flex-col border-t border-border bg-background">
        <div className="flex items-center justify-between border-b border-border">
          <div className="flex flex-1 items-center">
            <button
              type="button"
              className="inline-flex items-center gap-2 py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold"
              onClick={() =>
                setMetaOpen((prev) =>
                  prev === "todos" ? null : "todos"
                )
              }
              aria-expanded={metaOpen === "todos"}
            >
              Tasks
              {hasTodos && (
                <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
                  {todos.length}
                </span>
              )}
            </button>
            <button
              type="button"
              className="inline-flex items-center gap-2 py-3 pr-4 first:pl-[18px] aria-expanded:font-semibold"
              onClick={() =>
                setMetaOpen((prev) =>
                  prev === "files" ? null : "files"
                )
              }
              aria-expanded={metaOpen === "files"}
            >
              Files
              {Object.keys(files).length > 0 && (
                <span className="h-4 min-w-4 rounded-full bg-[#2F6868] px-0.5 text-center text-[10px] leading-[16px] text-white">
                  {Object.keys(files).length}
                </span>
              )}
            </button>
          </div>
        </div>

        {metaOpen === "todos" && hasTodos && (
          <div className="mb-6">
            <TodoList todos={todos} />
          </div>
        )}

        {metaOpen === "files" && (
          <div className="mb-6">
            <FilePanel
              messages={messages}
              threadId={threadId || undefined}
              compact={true}
            />
          </div>
        )}

        <ChatInput
          onSubmit={handleSendMessage}
          isLoading={isLoading}
          disabled={isThreadLoading}
          assistant={assistant}
        />
      </div>
    </div>
  );
}
