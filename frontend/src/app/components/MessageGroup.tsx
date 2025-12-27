"use client";

import React from "react";
import { Message } from "@langchain/langgraph-sdk";
import { ChatMessage } from "@/app/components/ChatMessage";

interface MessageGroupProps {
  messages: Message[];
  files?: Record<string, string>;
  continueStream?: (hasTaskToolCall?: boolean) => void;
  stopStream?: () => void;
  isLoading?: boolean;
  interrupt?: any;
  resumeInterrupt?: (value: any) => void;
  markCurrentThreadAsResolved?: () => void;
}

export function MessageGroup({ messages, isLoading }: MessageGroupProps) {
  return (
    <div className="space-y-2">
      {messages.map((message) => (
        <ChatMessage key={message.id} message={message} toolCalls={[]} isLoading={isLoading} />
      ))}
    </div>
  );
}

