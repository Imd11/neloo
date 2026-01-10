import { Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent } from "@/app/utils/utils";

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
                            currentTask = {
                                id: `task-${Date.now()}-${inProgress.content.slice(0, 10)}`,
                                type: "task",
                                title: inProgress.content,
                                status: "in_progress",
                                items: [],
                                startTime: Date.now() // Approximation
                            };
                            groups.push(currentTask);
                        }
                    } catch {
                        // Ignore parse errors
                    }
                }
            }
        }

        // 2. Classify the message content
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
                        status: "running" // Will update when result found
                    };
                    toolCallMap.set(tool.id, toolItem);
                    currentTask.items.push(toolItem);
                }
            }

            // B. Tool Results
            if (role === "tool") {
                const toolCallId = anyMsg.tool_call_id; // Vercel AI SDK uses tool_call_id
                if (toolCallId && toolCallMap.has(toolCallId)) {
                    const item = toolCallMap.get(toolCallId)!;
                    item.result = content;
                    item.status = "complete"; // Or error if content implies
                    // We don't push tool messages as separate items, we merge them into the ToolCall item
                }
            }

            // C. Thinking & Text
            if (role === "assistant" && !toolCalls.length) {
                // For V1 validity: Add text/thinking message
                currentTask.items.push(msg);
            }

            // If user message, break task?
            if (role === "user") {
                currentTask = null;
                groups.push({
                    id: msg.id || `msg-${Date.now()}`,
                    type: "message",
                    message: msg
                });
            }

        } else {
            // No active task, treat as top-level message
            groups.push({
                id: msg.id || `msg-${Date.now()}`,
                type: "message",
                message: msg
            });
        }
    }

    return groups;
}
