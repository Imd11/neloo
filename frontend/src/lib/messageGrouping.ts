import { Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent, parseMessageContentBlocks, stripThinkTags } from "@/app/utils/utils";

export interface ToolCall {
    toolName: string;
    args: any;
    toolCallId: string;
    result?: string;
    status: "running" | "complete" | "error";
}

export interface ThinkingContent {
    content: string;
    startTime: number;
    endTime?: number;
    isStreaming: boolean;
}

export interface TaskGroup {
    id: string;
    type: "task";
    title: string;
    status: "pending" | "in_progress" | "completed" | "failed";
    items: (ToolCall | ThinkingContent | Message)[]; // Can contain tools, thoughts, or raw messages
    startTime: number;
}

export interface MessageGroup {
    id: string;
    type: "message";
    message: Message;
}

export type ChatItem = TaskGroup | MessageGroup;

/**
 * Sequential Replay Logic
 * Iterates through the flat message history and groups items into Task Cards
 * based on `write_todos` calls.
 */
export function groupMessagesByTask(messages: Message[]): ChatItem[] {
    const groups: ChatItem[] = [];
    let currentTask: TaskGroup | null = null;

    // Track known tools to correlate results
    const toolCallMap = new Map<string, ToolCall>();

    for (const msg of messages) {
        const role = msg.type === "human" ? "user" : (msg.type === "ai" ? "assistant" : (msg.type === "tool" ? "tool" : "video"));

        // helper to access properties safely
        const anyMsg = msg as any;
        const toolCalls = anyMsg.tool_calls || anyMsg.additional_kwargs?.tool_calls || [];
        const content = extractStringFromMessageContent(msg);

        // 1. Check for write_todos to start/update tasks
        if (role === "assistant" && toolCalls.length > 0) {
            for (const tool of toolCalls) {
                const toolName = tool.function?.name || tool.name;
                if (toolName === "write_todos") {
                    try {
                        const argsString = tool.function?.arguments || tool.args;
                        const args = typeof argsString === 'string' ? JSON.parse(argsString) : argsString;
                        // args is usually { todos: [...] }
                        const inProgress = args.todos?.find((t: any) => t.status === "in_progress");

                        if (inProgress) {
                            // START NEW TASK GROUP
                            // Use tool.id as the stable seed for the task ID
                            currentTask = {
                                id: `task-${tool.id}`,
                                type: "task",
                                title: inProgress.content,
                                status: "in_progress",
                                items: [],
                                startTime: Date.now() // Timestamps for display are fine, just not for IDs
                            };
                            groups.push(currentTask);
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        }

        // 2. Implicit Task Support: If no current task, but we have tools/thinking, start an implicit one.
        if (!currentTask && role === "assistant") {
            const blocks = parseMessageContentBlocks(msg);
            const hasThinking = blocks.some(b => b.type === "thinking");

            if (toolCalls.length > 0 || hasThinking) {
                // START IMPLICIT TASK GROUP
                currentTask = {
                    id: `implicit-task-${msg.id || Date.now()}`,
                    type: "task",
                    title: "Processing Request...", // Default title for implicit tasks
                    status: "in_progress",
                    items: [],
                    startTime: Date.now()
                };
                groups.push(currentTask);
            }
        }

        // 3. Classify the message content
        if (currentTask) {
            // If we have an active task, put items into it

            // A. Tool Calls
            if (role === "assistant" && toolCalls.length > 0) {
                for (const tool of toolCalls) {
                    const toolName = tool.function?.name || tool.name;
                    if (toolName === "write_todos") continue; // Skip the control tool itself

                    const argsString = tool.function?.arguments || tool.args;
                    const toolItem: ToolCall = {
                        toolName: toolName,
                        args: typeof argsString === 'string' ? argsString : JSON.stringify(argsString),
                        toolCallId: tool.id,
                        status: "running"
                    };
                    toolCallMap.set(tool.id, toolItem);
                    currentTask.items.push(toolItem);
                }
            }

            // A2. Extract Content from Assistant Messages
            if (role === "assistant") {
                const blocks = parseMessageContentBlocks(msg);

                if (toolCalls.length > 0) {
                    // Case 1: Message has tool calls.
                    // Treat ALL content (Thinking AND Text) as "Thinking/Context" for this task.
                    // This prevents text before `write_todos` or other tools from disappearing.
                    const contentBlocks = blocks.filter(b => b.type === "thinking" || b.type === "text");
                    contentBlocks.forEach(block => {
                        // Skip empty text blocks
                        if (!block.content.trim()) return;

                        currentTask!.items.push({
                            content: block.content,
                            startTime: Date.now(),
                            isStreaming: false
                        } as ThinkingContent);
                    });
                } else {
                    // Case 2: No tool calls.
                    // Only extract explicit Thinking blocks here.
                    // Text blocks will be handled by Logic C (Final Answer) below.
                    const thinkingBlocks = blocks.filter(b => b.type === "thinking");
                    if (thinkingBlocks.length > 0) {
                        thinkingBlocks.forEach(block => {
                            currentTask!.items.push({
                                content: block.content,
                                startTime: Date.now(),
                                isStreaming: false
                            } as ThinkingContent);
                        });
                    }
                }
            }

            // B. Tool Results
            if (role === "tool") {
                const toolCallId = anyMsg.tool_call_id; // Vercel AI SDK uses tool_call_id
                if (toolCallId && toolCallMap.has(toolCallId)) {
                    const item = toolCallMap.get(toolCallId)!;
                    item.result = content;
                    item.status = "complete";
                }
            }

            // C. Text Content (Final Answer detection)
            // Only process text separation if there are NO tool calls (pure text response)
            // If there ARE tool calls, any text is usually just context/thought which we handled in A2
            if (role === "assistant" && !toolCalls.length) {
                const textContent = stripThinkTags(content);

                // If there is meaningful text content, it's likely the final answer
                if (textContent.trim()) {
                    currentTask = null; // Break the task grouping

                    groups.push({
                        id: msg.id || `msg-toplevel-${Date.now()}`,
                        type: "message",
                        message: { ...msg, content: textContent }
                    });
                }
                // Note: If it was just thinking, it was added to task in A2. 
            }

            // If user message, break task?
            if (role === "user") {
                currentTask = null;
                groups.push({
                    id: msg.id || `msg-user-${content.substring(0, 10)}-${groups.length}`,
                    type: "message",
                    message: msg
                });
            }

        } else {
            // No active task, treat as top-level message
            groups.push({
                id: msg.id || `msg-toplevel-${content.substring(0, 10)}-${groups.length}`,
                type: "message",
                message: msg
            });
        }
    }

    return groups;
}
