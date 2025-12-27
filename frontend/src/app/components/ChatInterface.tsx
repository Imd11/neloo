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
import { cn } from "@/lib/utils";

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

  const [metaOpen, setMetaOpen] = useState<"todos" | null>(null);
  const [filePanelOpen, setFilePanelOpen] = useState(false);
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

  const handleSendMessage = (content: string) => {
    setMetaOpen(null);
    sendMessage(content);
  };

  return (
    <div className="flex h-full relative">
      {/* Main chat area */}
      <div className="flex-1 flex flex-col overflow-hidden">
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

        <div className="border-t border-border bg-background">
          <div className="border-b border-border px-4 py-2">
            <div className="flex items-center gap-4">
              <button
                type="button"
                className={cn(
                  "inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  metaOpen === "todos"
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                )}
                onClick={() =>
                  setMetaOpen((prev) =>
                    prev === "todos" ? null : "todos"
                  )
                }
              >
                Tasks
                {hasTodos && (
                  <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary px-1.5 text-xs font-medium text-primary-foreground">
                    {todos.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {metaOpen === "todos" && hasTodos && (
            <div className="border-b border-border p-4">
              <TodoList todos={todos} />
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

      {/* Right-side toggle button */}
      <button
        onClick={() => setFilePanelOpen(!filePanelOpen)}
        className={cn(
          "fixed top-1/2 -translate-y-1/2 z-40 flex items-center justify-center",
          "h-16 w-8 rounded-l-lg border border-r-0 border-border",
          "bg-background shadow-md transition-all duration-300 hover:w-10",
          filePanelOpen ? "right-[320px]" : "right-0"
        )}
        aria-label="Toggle file panel"
      >
        <div className="flex flex-col items-center gap-1">
          <FileIcon className="h-4 w-4 text-muted-foreground" />
          {hasFiles && (
            <span className="text-[10px] font-medium text-muted-foreground">
              {Object.keys(files).length}
            </span>
          )}
        </div>
      </button>

      {/* Right sidebar - File Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 h-full w-80 bg-background border-l border-border",
          "transform transition-transform duration-300 ease-in-out z-30",
          filePanelOpen ? "translate-x-0" : "translate-x-full"
        )}
      >
        <FilePanel
          messages={messages}
          threadId={threadId || undefined}
          onClose={() => setFilePanelOpen(false)}
        />
      </div>
    </div>
  );
}
