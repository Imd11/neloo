import { useState, useRef, useEffect } from "react";
import {
  sendMessage,
  createResumeContext,
  parseAIResponse,
  applySuggestion,
} from "../lib/deepseek";
import type { ChatMessage, Suggestion } from "../lib/deepseek";
import type { ResumeData } from "../types/resume";

interface ChatPanelProps {
  resumeData?: ResumeData;
  onDataChange?: (data: ResumeData) => void;
}

interface DisplayMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean;
  suggestion?: Suggestion;
  suggestionApplied?: boolean;
}

export function ChatPanel({ resumeData, onDataChange }: ChatPanelProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([
    {
      id: "welcome",
      role: "assistant",
      content: `你好！我是简历优化助手。你可以让我：

• 优化某段工作经历的描述
• 改进个人简介
• 检查语法问题

试试说："帮我优化第一段工作经历"`,
    },
  ]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: DisplayMessage = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    };

    // Add user message
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create assistant placeholder
    const assistantId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantId, role: "assistant", content: "", isStreaming: true },
    ]);

    try {
      // Build message history for API
      const apiMessages: ChatMessage[] = [];

      // Include resume context in first message
      if (resumeData) {
        apiMessages.push({
          role: "user",
          content: createResumeContext(resumeData),
        });
        apiMessages.push({
          role: "assistant",
          content: "我已了解你的简历内容，请告诉我你需要什么帮助。",
        });
      }

      // Add conversation history (skip welcome message)
      messages
        .filter((m) => m.id !== "welcome")
        .forEach((m) => {
          apiMessages.push({ role: m.role, content: m.content });
        });

      // Add current user message
      apiMessages.push({ role: "user", content: input });

      // Send with streaming
      const fullResponse = await sendMessage(apiMessages, (chunk) => {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, content: m.content + chunk } : m
          )
        );
      });

      // Parse the response for suggestions
      const parsed = parseAIResponse(fullResponse);

      // Update message with parsed content and suggestion
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: parsed.message || fullResponse,
                isStreaming: false,
                suggestion: parsed.suggestion,
              }
            : m
        )
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? {
                ...m,
                content: `错误: ${
                  error instanceof Error ? error.message : "请求失败"
                }`,
                isStreaming: false,
              }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleApplySuggestion = (messageId: string, suggestion: Suggestion) => {
    if (!resumeData || !onDataChange) return;

    // Apply the suggestion to resume data
    const newData = applySuggestion(
      resumeData as unknown as Record<string, unknown>,
      suggestion
    ) as unknown as ResumeData;

    onDataChange(newData);

    // Mark suggestion as applied
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId ? { ...m, suggestionApplied: true } : m
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center border-b px-4">
        <h2 className="text-sm font-semibold text-gray-700">✨ AI 助手</h2>
      </div>

      {/* Messages Area */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className="flex gap-3"
          >
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm text-white ${
                message.role === "assistant"
                  ? "bg-gradient-to-br from-indigo-500 to-purple-600"
                  : "bg-gray-500"
              }`}
            >
              {message.role === "assistant" ? "AI" : "我"}
            </div>
            <div className="flex-1 space-y-2">
              {/* Message content */}
              <div
                className={`max-w-[95%] whitespace-pre-wrap rounded-lg p-3 text-sm ${
                  message.role === "assistant"
                    ? "bg-gray-100 text-gray-700"
                    : "bg-indigo-500 text-white"
                }`}
              >
                {message.content || (message.isStreaming ? "思考中..." : "")}
                {message.isStreaming && message.content && (
                  <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-indigo-500" />
                )}
              </div>

              {/* Suggestion Card */}
              {message.suggestion && !message.isStreaming && (
                <div
                  className={`overflow-hidden rounded-lg border-2 ${
                    message.suggestionApplied
                      ? "border-green-300 bg-green-50"
                      : "border-indigo-200 bg-indigo-50"
                  }`}
                >
                  <div className="border-b border-indigo-100 bg-white px-3 py-2">
                    <span className="text-xs font-medium text-indigo-600">
                      💡 建议修改: {message.suggestion.field}
                    </span>
                  </div>
                  <div className="space-y-2 p-3">
                    {/* Before */}
                    <div>
                      <span className="text-xs text-gray-500">修改前:</span>
                      <p className="mt-1 rounded bg-red-50 p-2 text-sm text-red-600 line-through">
                        {message.suggestion.before || "(空)"}
                      </p>
                    </div>
                    {/* After */}
                    <div>
                      <span className="text-xs text-gray-500">修改后:</span>
                      <p className="mt-1 rounded bg-green-50 p-2 text-sm text-green-700">
                        {message.suggestion.after}
                      </p>
                    </div>
                    {/* Reason */}
                    {message.suggestion.reason && (
                      <p className="text-xs italic text-gray-500">
                        💬 {message.suggestion.reason}
                      </p>
                    )}
                    {/* Action Buttons */}
                    {!message.suggestionApplied ? (
                      <div className="flex gap-2 pt-2">
                        <button
                          onClick={() =>
                            handleApplySuggestion(
                              message.id,
                              message.suggestion!
                            )
                          }
                          className="flex-1 rounded-lg bg-gradient-to-r from-green-500 to-emerald-500 px-3 py-2 text-sm font-medium text-white transition-all hover:shadow-md"
                        >
                          ✅ 接受修改
                        </button>
                        <button
                          onClick={() =>
                            setMessages((prev) =>
                              prev.map((m) =>
                                m.id === message.id
                                  ? { ...m, suggestion: undefined }
                                  : m
                              )
                            )
                          }
                          className="rounded-lg bg-gray-200 px-3 py-2 text-sm text-gray-700 transition-colors hover:bg-gray-300"
                        >
                          忽略
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 pt-2 text-green-600">
                        <span className="text-lg">✓</span>
                        <span className="text-sm font-medium">已应用修改</span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="shrink-0 border-t p-3">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的需求..."
            disabled={isLoading}
            className="flex-1 rounded-lg border px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-50"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="rounded-lg bg-gradient-to-r from-indigo-500 to-purple-500 px-4 py-2 text-sm font-medium text-white transition-all hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-50"
          >
            发送
          </button>
        </div>
      </div>
    </div>
  );
}
