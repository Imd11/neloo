import { Message } from "@langchain/langgraph-sdk";
import { extractStringFromMessageContent, parseMessageContentBlocks, stripThinkTags } from "@/app/utils/utils";

export interface ToolCall {
    toolName: string;
    args: any;
    toolCallId: string;
    result?: string;
    status: "running" | "complete" | "error";
}

// Helper to estimate reading/generation time
function estimateDuration(content: string): number {
    // Estimate: 50ms per character (approx 20 chars/sec, conservative for thinking)
    // Minimum 2 seconds
    return Math.max(2000, content.length * 50);
}

export interface ThinkingContent {
    content: string;
    startTime: number;
    endTime?: number;
    isStreaming: boolean;
    duration?: number;
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

export interface GlobalThinkingGroup {
    id: string;
    type: "global_thinking";
    items: ThinkingContent[];
}

export type ChatItem = TaskGroup | MessageGroup | GlobalThinkingGroup;

/**
 * Sequential Replay Logic
 * Iterates through the flat message history and groups items into Task Cards
 * based on `write_todos` calls.
 */
export function groupMessagesByTask(messages: Message[]): ChatItem[] {
    const groups: ChatItem[] = [];
    let currentTask: TaskGroup | null = null;
    let globalThinking: GlobalThinkingGroup | null = null;
    let hasStartedTasks = false;

    // Track known tools to correlate results
    const toolCallMap = new Map<string, ToolCall>();

    for (const msg of messages) {
        const role = msg.type === "human" ? "user" : (msg.type === "ai" ? "assistant" : (msg.type === "tool" ? "tool" : "video"));

        // helper to access properties safely
        const anyMsg = msg as any;
        const toolCalls = anyMsg.tool_calls || anyMsg.additional_kwargs?.tool_calls || [];
        const content = extractStringFromMessageContent(msg);

        // 0. Global Thinking Detection (Before any task starts)
        // If we haven't started any tasks yet, and we see thinking content, add to global thinking
        if (!hasStartedTasks && role === "assistant" && toolCalls.length === 0) {
            const blocks = parseMessageContentBlocks(msg);

            // Check for injected thinking duration
            const durationRegex = /<!-- think_duration: (\d+) -->/;
            const match = content.match(durationRegex);
            const injectedDuration = match ? parseInt(match[1], 10) : undefined;

            const thinkingBlocks = blocks.filter(b => b.type === "thinking");
            const textContent = stripThinkTags(content).trim();

            if (thinkingBlocks.length > 0) {
                if (!globalThinking) {
                    globalThinking = {
                        id: `global-think-${msg.id || Date.now()}`,
                        type: "global_thinking",
                        items: []
                    };
                    groups.push(globalThinking);
                }

                thinkingBlocks.forEach(block => {
                    // Use injected duration if available
                    const duration = injectedDuration
                        ? injectedDuration
                        : estimateDuration(block.content);

                    globalThinking!.items.push({
                        content: block.content,
                        startTime: Date.now(),
                        isStreaming: false,
                        duration: duration
                    });
                });

                // If there IS text content, we don't 'continue'. We let it fall through to be processed as a message.
                // BUT we must ensure Step 2 doesn't create an implicit task just because of this thinking (which we already handled).
                // Step 2 below checks (!currentTask). 'hasStartedTasks' is still false.
                // We will handle the Text part in Step 3.

                // If there is ONLY thinking (no text), we are done with this message.
                if (!textContent) {
                    continue;
                }

                // If there IS text, we want to proceed to Step 3 (Message Classification).
                // But we must NOT trigger Step 2 (Implicit Task) based on 'thinking' because we just consumed it.
                // We'll modify Step 2 to explicitly ignore thinking if !hasStartedTasks (since Step 0 handled it).
            }
        }

        // 1. Check for write_todos to start/update tasks
        if (role === "assistant" && toolCalls.length > 0) {
            hasStartedTasks = true; // Mark that we entered task mode
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

            // Only create implicit task if:
            // 1. There are tool calls (ALWAYS create task for tools)
            // 2. OR There is thinking AND we have already started tasks (meaning it's a mid-stream thought that lost its task context?)
            //    If we haven't started tasks (!hasStartedTasks), Step 0 handled the thinking, so we DON'T want an implicit task.
            const shouldCreateImplicitTask =
                toolCalls.length > 0 ||
                (hasThinking && hasStartedTasks);

            if (shouldCreateImplicitTask) {
                hasStartedTasks = true;
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

            // A2. Extract Thinking Content from Assistant Messages (ONLY thinking, not text)
            if (role === "assistant") {
                const blocks = parseMessageContentBlocks(msg);

                // Check for injected thinking duration in result content
                // The backend injects: \n\n<!-- think_duration: {ms} -->
                const durationRegex = /<!-- think_duration: (\d+) -->/;
                let injectedDuration: number | undefined;
                const match = content.match(durationRegex);
                if (match) {
                    injectedDuration = parseInt(match[1], 10);
                }

                // Extract ONLY thinking blocks - text content is handled separately in Step C
                const thinkingBlocks = blocks.filter(b => b.type === "thinking");

                if (thinkingBlocks.length > 0) {
                    thinkingBlocks.forEach(block => {
                        // Use injected duration if available
                        const duration = injectedDuration
                            ? injectedDuration
                            : estimateDuration(block.content);

                        currentTask!.items.push({
                            content: block.content,
                            startTime: Date.now(),
                            isStreaming: false,
                            duration: duration
                        } as ThinkingContent);
                    });
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
                    hasStartedTasks = true;

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
                hasStartedTasks = true;
                groups.push({
                    id: msg.id || `msg-user-${groups.length}`,
                    type: "message",
                    message: msg
                });
            }

        } else {
            // No active task, treat as top-level message
            if (role === "assistant") {
                // Double check if we missed any content handled by global thinking
                // If it's pure text, render as message
                const textContent = stripThinkTags(content);
                if (textContent.trim()) {
                    groups.push({
                        id: msg.id || `msg-toplevel-${groups.length}`,
                        type: "message",
                        message: msg
                    });
                }
            } else {
                groups.push({
                    id: msg.id || `msg-toplevel-${groups.length}`,
                    type: "message",
                    message: msg
                });
            }
        }
    }

    return groups;
}
