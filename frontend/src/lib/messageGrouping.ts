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

// New timeline item types for flat rendering
export interface TimelineThinking {
    id: string;
    type: "timeline_thinking";
    content: string;
    duration?: number;
}

export interface TimelineToolCall {
    id: string;
    type: "timeline_tool_call";
    toolName: string;
    args: string;
    toolCallId: string;
    status: "running" | "complete" | "error";
    result?: string;
}

export interface TimelineText {
    id: string;
    type: "timeline_text";
    content: string;
    messageId?: string;
}

export type TimelineItem = TimelineThinking | TimelineToolCall | TimelineText | MessageGroup;

export type ChatItem = TaskGroup | MessageGroup | GlobalThinkingGroup | TimelineItem;

/**
 * Flat Timeline Logic - NEW
 * 
 * Renders each content block in the exact order received from backend.
 * No grouping, no reordering. Simple and predictable.
 */
export function flattenMessagesToTimeline(messages: Message[]): ChatItem[] {
    const items: ChatItem[] = [];
    const toolCallMap = new Map<string, TimelineToolCall>();
    let blockIndex = 0;

    for (const msg of messages) {
        const role = msg.type === "human" ? "user" : (msg.type === "ai" ? "assistant" : (msg.type === "tool" ? "tool" : "other"));

        if (role === "user") {
            // User messages always render as MessageGroup
            items.push({
                id: msg.id || `user-${blockIndex++}`,
                type: "message",
                message: msg
            });
            continue;
        }

        if (role === "tool") {
            // Tool result - update the corresponding tool call OR create standalone result
            const anyMsg = msg as any;
            const toolCallId = anyMsg.tool_call_id;
            const toolContent = extractStringFromMessageContent(msg);

            if (toolCallId && toolCallMap.has(toolCallId)) {
                // Found matching tool call - update it
                const toolItem = toolCallMap.get(toolCallId)!;
                toolItem.result = toolContent;
                toolItem.status = "complete";
            } else {
                // No matching tool call found (history reload scenario)
                // Create a standalone tool result item
                items.push({
                    id: `tool-result-${msg.id || toolCallId || blockIndex++}`,
                    type: "timeline_tool_call",
                    toolName: "Tool Result",  // We don't know the tool name from ToolMessage alone
                    args: "",
                    toolCallId: toolCallId || "",
                    status: "complete",
                    result: toolContent
                });
            }
            continue;
        }

        if (role === "assistant") {
            // Parse content blocks in order
            const blocks = parseMessageContentBlocks(msg);

            // Check for injected thinking duration
            const content = extractStringFromMessageContent(msg);
            const durationRegex = /<!-- think_duration: (\d+) -->/;
            const match = content.match(durationRegex);
            const injectedDuration = match ? parseInt(match[1], 10) : undefined;

            // Process each block in array order (time order)
            for (const block of blocks) {
                if (block.type === "thinking") {
                    const duration = injectedDuration ?? estimateDuration(block.content);
                    items.push({
                        id: `thinking-${msg.id}-${blockIndex++}`,
                        type: "timeline_thinking",
                        content: block.content,
                        duration: duration
                    });
                } else if (block.type === "text") {
                    if (block.content.trim()) {
                        items.push({
                            id: `text-${msg.id}-${blockIndex++}`,
                            type: "timeline_text",
                            content: block.content,
                            messageId: msg.id
                        });
                    }
                } else if (block.type === "tool_use") {
                    // Skip write_todos (control tool)
                    if (block.name === "write_todos") continue;

                    const toolItem: TimelineToolCall = {
                        id: `tool-${block.id}-${blockIndex++}`,
                        type: "timeline_tool_call",
                        toolName: block.name,
                        args: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
                        toolCallId: block.id,
                        status: "running"
                    };
                    toolCallMap.set(block.id, toolItem);
                    items.push(toolItem);
                }
            }

            // Also check msg.tool_calls for tools not in content array
            const anyMsg = msg as any;
            const toolCalls = anyMsg.tool_calls || anyMsg.additional_kwargs?.tool_calls || [];
            for (const tool of toolCalls) {
                const toolId = tool.id || tool.function?.id;
                const toolName = tool.function?.name || tool.name;

                // Skip if already added from content blocks
                if (toolCallMap.has(toolId)) continue;
                // Skip control tool
                if (toolName === "write_todos") continue;

                const argsString = tool.function?.arguments || tool.args;
                const toolItem: TimelineToolCall = {
                    id: `tool-${toolId}-${blockIndex++}`,
                    type: "timeline_tool_call",
                    toolName: toolName,
                    args: typeof argsString === 'string' ? argsString : JSON.stringify(argsString),
                    toolCallId: toolId,
                    status: "running"
                };
                toolCallMap.set(toolId, toolItem);
                items.push(toolItem);
            }

            // If no blocks were extracted but there's text content, add as text
            if (blocks.length === 0) {
                const textContent = stripThinkTags(content);
                if (textContent.trim()) {
                    items.push({
                        id: `text-${msg.id}-${blockIndex++}`,
                        type: "timeline_text",
                        content: textContent,
                        messageId: msg.id
                    });
                }
            }
        }
    }

    return items;
}

/**
 * Legacy groupMessagesByTask - kept for backwards compatibility
 * 
 * Now just wraps flattenMessagesToTimeline.
 * TaskGroup is no longer used - everything renders as timeline items.
 */
export function groupMessagesByTask(messages: Message[]): ChatItem[] {
    return flattenMessagesToTimeline(messages);
}

/**
 * Hierarchical Todo Grouping (Manus-style)
 * 
 * Groups timeline items under their corresponding todos.
 * Uses write_todos tool calls as task boundaries:
 * - Items before first write_todos → "top-level" (todoId = null)
 * - Items after write_todos(id=X, status=in_progress) → todoId = X
 * 
 * @param messages - Raw messages from stream
 * @param todos - Todo items from stream.values.todos
 * @returns Object with topLevel items and grouped items per todo
 */
export interface TodoGroup {
    todoId: string;
    title: string;
    status: "pending" | "in_progress" | "completed";
    items: TimelineItem[];
}

export interface HierarchicalTimeline {
    topLevel: TimelineItem[];  // Items before any todo (intro text, initial thinking)
    todoGroups: TodoGroup[];   // Items grouped by todo
}

export function groupMessagesByTodo(
    messages: Message[],
    todos: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>
): HierarchicalTimeline {
    const result: HierarchicalTimeline = {
        topLevel: [],
        todoGroups: []
    };

    // Create a map for quick todo lookup
    const todoMap = new Map(todos.map(t => [t.id, t]));

    // Create groups for each todo
    const groupsById = new Map<string, TodoGroup>();
    for (const todo of todos) {
        const group: TodoGroup = {
            todoId: todo.id,
            title: todo.content,
            status: todo.status,
            items: []
        };
        groupsById.set(todo.id, group);
        result.todoGroups.push(group);
    }

    // Track current active todo
    let currentTodoId: string | null = null;
    const toolCallMap = new Map<string, TimelineToolCall>();
    let blockIndex = 0;

    for (const msg of messages) {
        const role = msg.type === "human" ? "user" : (msg.type === "ai" ? "assistant" : (msg.type === "tool" ? "tool" : "other"));

        if (role === "user") {
            // User messages go to current group or top-level
            const item: MessageGroup = {
                id: msg.id || `user-${blockIndex++}`,
                type: "message",
                message: msg
            };
            addItemToGroup(result, currentTodoId, groupsById, item);
            continue;
        }

        if (role === "tool") {
            // Tool result - update matching tool call
            const anyMsg = msg as any;
            const toolCallId = anyMsg.tool_call_id;
            const toolContent = extractStringFromMessageContent(msg);

            if (toolCallId && toolCallMap.has(toolCallId)) {
                const toolItem = toolCallMap.get(toolCallId)!;
                toolItem.result = toolContent;
                toolItem.status = "complete";
            }
            continue;
        }

        if (role === "assistant") {
            // Check for write_todos calls to update current todo
            const anyMsg = msg as any;
            const toolCalls = anyMsg.tool_calls || anyMsg.additional_kwargs?.tool_calls || [];

            for (const tool of toolCalls) {
                const toolName = tool.function?.name || tool.name;
                if (toolName === "write_todos") {
                    // Parse the todos being written
                    const argsStr = tool.function?.arguments || tool.args;
                    try {
                        const args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
                        const writtenTodos = args.todos || [];

                        // Find in_progress todo to set as current
                        for (const wt of writtenTodos) {
                            if (wt.status === "in_progress") {
                                currentTodoId = wt.id;
                                break;
                            }
                        }
                    } catch (e) {
                        // Parse error, continue
                    }
                }
            }

            // Also check content[] for tool_use blocks (backend sends write_todos here)
            if (Array.isArray(msg.content)) {
                for (const block of msg.content as any[]) {
                    if (block?.type === "tool_use" && block?.name === "write_todos") {
                        const args = block.input;
                        const writtenTodos = args?.todos || [];
                        for (const wt of writtenTodos) {
                            if (wt.status === "in_progress") {
                                currentTodoId = wt.id;
                                break;
                            }
                        }
                    }
                }
            }

            // Parse content blocks
            const blocks = parseMessageContentBlocks(msg);
            const content = extractStringFromMessageContent(msg);
            const durationRegex = /<!-- think_duration: (\d+) -->/;
            const match = content.match(durationRegex);
            const injectedDuration = match ? parseInt(match[1], 10) : undefined;

            for (const block of blocks) {
                if (block.type === "thinking") {
                    const duration = injectedDuration ?? estimateDuration(block.content);
                    const item: TimelineThinking = {
                        id: `thinking-${msg.id}-${blockIndex++}`,
                        type: "timeline_thinking",
                        content: block.content,
                        duration: duration
                    };
                    addItemToGroup(result, currentTodoId, groupsById, item);
                } else if (block.type === "text") {
                    const textContent = block.content.trim();
                    // Filter out system log text from write_todos
                    if (textContent && !/^Updated todo list to \[/i.test(textContent)) {
                        const item: TimelineText = {
                            id: `text-${msg.id}-${blockIndex++}`,
                            type: "timeline_text",
                            content: block.content,
                            messageId: msg.id
                        };
                        addItemToGroup(result, currentTodoId, groupsById, item);
                    }
                } else if (block.type === "tool_use") {
                    if (block.name === "write_todos") continue;

                    const toolItem: TimelineToolCall = {
                        id: `tool-${block.id}-${blockIndex++}`,
                        type: "timeline_tool_call",
                        toolName: block.name,
                        args: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
                        toolCallId: block.id,
                        status: "running"
                    };
                    toolCallMap.set(block.id, toolItem);
                    addItemToGroup(result, currentTodoId, groupsById, toolItem);
                }
            }

            // Process tool calls not in content array
            for (const tool of toolCalls) {
                const toolId = tool.id || tool.function?.id;
                const toolName = tool.function?.name || tool.name;

                if (toolCallMap.has(toolId)) continue;
                if (toolName === "write_todos") continue;

                const argsString = tool.function?.arguments || tool.args;
                const toolItem: TimelineToolCall = {
                    id: `tool-${toolId}-${blockIndex++}`,
                    type: "timeline_tool_call",
                    toolName: toolName,
                    args: typeof argsString === 'string' ? argsString : JSON.stringify(argsString),
                    toolCallId: toolId,
                    status: "running"
                };
                toolCallMap.set(toolId, toolItem);
                addItemToGroup(result, currentTodoId, groupsById, toolItem);
            }

            // Fallback for messages with no blocks
            if (blocks.length === 0) {
                const textContent = stripThinkTags(content);
                if (textContent.trim()) {
                    const item: TimelineText = {
                        id: `text-${msg.id}-${blockIndex++}`,
                        type: "timeline_text",
                        content: textContent,
                        messageId: msg.id
                    };
                    addItemToGroup(result, currentTodoId, groupsById, item);
                }
            }
        }
    }

    return result;
}

// Helper to add item to correct group
function addItemToGroup(
    result: HierarchicalTimeline,
    currentTodoId: string | null,
    groupsById: Map<string, TodoGroup>,
    item: TimelineItem
): void {
    if (currentTodoId && groupsById.has(currentTodoId)) {
        groupsById.get(currentTodoId)!.items.push(item);
    } else {
        result.topLevel.push(item);
    }
}

// =============================================================================
// Manus-Style Timeline (NEW)
// =============================================================================

/**
 * Manus-style timeline structure:
 * - prelude: Content before any todo (AI intro)
 * - visibleTodos: Only done + running todos (pending hidden)
 * - epilogue: Content after all todos completed
 */
export interface ManusTimeline {
    prelude: TimelineItem[];       // Items before any todo
    visibleTodos: ManusNode[];     // Only done + running nodes
    hiddenPlan: ManusNode[];       // Pending nodes (optional reveal)
    epilogue: TimelineItem[];      // Items after all todos done
}

export interface ManusNode {
    id: string;
    title: string;
    status: 'running' | 'done';
    children: TimelineItem[];
}

/**
 * Build Manus-style timeline from messages and todos.
 * 
 * Key rules:
 * 1. Only reveal done + running todos (pending hidden)
 * 2. activeTodoId only changes on write_todos snapshot
 * 3. Prelude = items before seenAnyTodo, Epilogue = items after allTodosCompleted
 * 4. Items assigned to activeTodoId, not by time guessing
 */
export function buildManusTimeline(
    messages: Message[],
    todos: Array<{ id: string; content: string; status: "pending" | "in_progress" | "completed" }>
): ManusTimeline {
    const result: ManusTimeline = {
        prelude: [],
        visibleTodos: [],
        hiddenPlan: [],
        epilogue: []
    };

    // Create nodes for each todo
    const nodesById = new Map<string, ManusNode>();
    const orderedTodos: string[] = [];

    for (const todo of todos) {
        const node: ManusNode = {
            id: todo.id,
            title: todo.content,
            status: todo.status === 'completed' ? 'done' :
                todo.status === 'in_progress' ? 'running' :
                    'done', // pending won't be visible anyway
            children: []
        };
        nodesById.set(todo.id, node);
        orderedTodos.push(todo.id);

        // Split into visible vs hidden
        if (todo.status === 'completed' || todo.status === 'in_progress') {
            result.visibleTodos.push(node);
        } else {
            result.hiddenPlan.push(node);
        }
    }

    // State tracking
    let activeTodoId: string | null = null;
    let lastInProgressTodoId: string | null = null;  // Keep track for fallback after all completed
    let seenAnyTodo = false;
    // Removed: allTodosCompleted check - this caused all content to go to epilogue

    const toolCallMap = new Map<string, TimelineToolCall>();
    let blockIndex = 0;

    // Helper to add item to correct location
    function addItem(item: TimelineItem) {
        if (!seenAnyTodo) {
            result.prelude.push(item);
        } else if (activeTodoId && nodesById.has(activeTodoId)) {
            nodesById.get(activeTodoId)!.children.push(item);
        } else if (lastInProgressTodoId && nodesById.has(lastInProgressTodoId)) {
            // After all completed, mount to the last todo that was in_progress
            nodesById.get(lastInProgressTodoId)!.children.push(item);
        } else if (result.visibleTodos.length > 0) {
            // Fallback: add to last visible todo's children
            result.visibleTodos[result.visibleTodos.length - 1].children.push(item);
        } else {
            result.prelude.push(item);
        }
    }

    // Process messages
    for (const msg of messages) {
        const role = msg.type === "human" ? "user" :
            (msg.type === "ai" ? "assistant" :
                (msg.type === "tool" ? "tool" : "other"));

        if (role === "user") {
            const item: MessageGroup = {
                id: msg.id || `user-${blockIndex++}`,
                type: "message",
                message: msg
            };
            addItem(item);
            continue;
        }

        if (role === "tool") {
            const anyMsg = msg as any;
            const toolCallId = anyMsg.tool_call_id;
            const toolContent = extractStringFromMessageContent(msg);

            if (toolCallId && toolCallMap.has(toolCallId)) {
                const toolItem = toolCallMap.get(toolCallId)!;
                toolItem.result = toolContent;
                toolItem.status = "complete";
            }
            continue;
        }

        if (role === "assistant") {
            const anyMsg = msg as any;
            const toolCalls = anyMsg.tool_calls || anyMsg.additional_kwargs?.tool_calls || [];

            // Check for write_todos calls to update activeTodoId (anchor rule)
            for (const tool of toolCalls) {
                const toolName = tool.function?.name || tool.name;
                if (toolName === "write_todos") {
                    seenAnyTodo = true;
                    const argsStr = tool.function?.arguments || tool.args;
                    try {
                        const args = typeof argsStr === 'string' ? JSON.parse(argsStr) : argsStr;
                        const writtenTodos = args.todos || [];
                        for (const wt of writtenTodos) {
                            if (wt.status === "in_progress") {
                                activeTodoId = wt.id;
                                lastInProgressTodoId = wt.id;  // Keep track for fallback
                                break;
                            }
                        }
                    } catch (e) { /* ignore parse errors */ }
                }
            }


            // Also check content[] for tool_use blocks
            if (Array.isArray(msg.content)) {
                for (const block of msg.content as any[]) {
                    if (block?.type === "tool_use" && block?.name === "write_todos") {
                        seenAnyTodo = true;
                        const args = block.input;
                        const writtenTodos = args?.todos || [];
                        for (const wt of writtenTodos) {
                            if (wt.status === "in_progress") {
                                activeTodoId = wt.id;
                                lastInProgressTodoId = wt.id;  // Keep track for fallback
                                break;
                            }
                        }
                    }
                }
            }

            // Parse content blocks
            const blocks = parseMessageContentBlocks(msg);
            const content = extractStringFromMessageContent(msg);
            const durationRegex = /<!-- think_duration: (\d+) -->/;
            const match = content.match(durationRegex);
            const injectedDuration = match ? parseInt(match[1], 10) : undefined;

            for (const block of blocks) {
                if (block.type === "thinking") {
                    const duration = injectedDuration ?? estimateDuration(block.content);
                    const item: TimelineThinking = {
                        id: `thinking-${msg.id}-${blockIndex++}`,
                        type: "timeline_thinking",
                        content: block.content,
                        duration: duration
                    };
                    addItem(item);
                } else if (block.type === "text") {
                    const textContent = block.content.trim();
                    if (textContent && !/^Updated todo list to \[/i.test(textContent)) {
                        const item: TimelineText = {
                            id: `text-${msg.id}-${blockIndex++}`,
                            type: "timeline_text",
                            content: block.content,
                            messageId: msg.id
                        };
                        addItem(item);
                    }
                } else if (block.type === "tool_use") {
                    if (block.name === "write_todos") continue;

                    const toolItem: TimelineToolCall = {
                        id: `tool-${block.id}-${blockIndex++}`,
                        type: "timeline_tool_call",
                        toolName: block.name,
                        args: typeof block.input === 'string' ? block.input : JSON.stringify(block.input),
                        toolCallId: block.id,
                        status: "running"
                    };
                    toolCallMap.set(block.id, toolItem);
                    addItem(toolItem);
                }
            }

            // Process tool calls not in content array
            for (const tool of toolCalls) {
                const toolId = tool.id || tool.function?.id;
                const toolName = tool.function?.name || tool.name;

                if (toolCallMap.has(toolId)) continue;
                if (toolName === "write_todos") continue;

                const argsString = tool.function?.arguments || tool.args;
                const toolItem: TimelineToolCall = {
                    id: `tool-${toolId}-${blockIndex++}`,
                    type: "timeline_tool_call",
                    toolName: toolName,
                    args: typeof argsString === 'string' ? argsString : JSON.stringify(argsString),
                    toolCallId: toolId,
                    status: "running"
                };
                toolCallMap.set(toolId, toolItem);
                addItem(toolItem);
            }

            // Fallback for messages with no blocks
            if (blocks.length === 0) {
                const textContent = stripThinkTags(content);
                if (textContent.trim()) {
                    const item: TimelineText = {
                        id: `text-${msg.id}-${blockIndex++}`,
                        type: "timeline_text",
                        content: textContent,
                        messageId: msg.id
                    };
                    addItem(item);
                }
            }
        }
    }

    return result;
}
