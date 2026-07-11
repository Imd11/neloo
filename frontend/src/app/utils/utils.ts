import { Message } from "@langchain/langgraph-sdk";
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import type { ContentBlock } from "@/app/types/types";
import { getVisibleHumanContent } from "@/app/utils/hiddenPromptEnvelope";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Parse message content into structured ContentBlocks.
 * Handles multiple formats:
 * - OpenAI format: string content with <think> tags
 * - Anthropic format: array content with thinking blocks
 * - DeepSeek format: additional_kwargs.reasoning_content
 *
 * @param message - The message to parse
 * @returns Array of ContentBlocks in display order
 */
export function parseMessageContentBlocks(message: Message): ContentBlock[] {
  const content = message.content;
  const blocks: ContentBlock[] = [];

  // Check for DeepSeek reasoning_content in additional_kwargs
  // DeepSeek format: { content: "...", additional_kwargs: { reasoning_content: "..." } }
  const additionalKwargs = (message as Record<string, unknown>)
    .additional_kwargs as Record<string, unknown> | undefined;
  const reasoningContent = additionalKwargs?.reasoning_content as
    | string
    | undefined;

  if (reasoningContent?.trim()) {
    blocks.push({ type: "thinking", content: reasoningContent });
  }

  // String format (OpenAI) - parse <think> tags as best-effort compatibility
  if (typeof content === "string") {
    const stringBlocks = parseThinkTagsFromString(content);
    // If we already have reasoning_content, only add text blocks from string parsing
    // to avoid duplicate thinking blocks
    if (blocks.length > 0) {
      blocks.push(...stringBlocks.filter((b) => b.type === "text"));
    } else {
      blocks.push(...stringBlocks);
    }
    return blocks;
  }

  // Array format (Anthropic) - map structured blocks
  if (Array.isArray(content)) {
    for (const item of content as unknown[]) {
      if (typeof item === "string") {
        // Plain string in array
        if (item.trim()) {
          blocks.push({ type: "text", content: item });
        }
      } else if (item && typeof item === "object") {
        const block = item as Record<string, unknown>;
        const blockType = block.type as string;

        if (blockType === "thinking") {
          // Anthropic thinking block: { type: "thinking", thinking: "..." }
          const thinkingContent = block.thinking as string;
          if (thinkingContent?.trim()) {
            blocks.push({ type: "thinking", content: thinkingContent });
          }
        } else if (blockType === "redacted_thinking") {
          // Redacted thinking block (signature only, no readable content)
          blocks.push({
            type: "redacted_thinking",
            signature: block.signature as string | undefined,
          });
        } else if (blockType === "text") {
          // Text block: { type: "text", text: "..." }
          const textContent = block.text as string;
          if (textContent?.trim()) {
            blocks.push({ type: "text", content: textContent });
          }
        } else if (blockType === "tool_use") {
          // Tool use block: { type: "tool_use", id: "...", name: "...", input: {...} }
          // Include in blocks to preserve time ordering
          blocks.push({
            type: "tool_use",
            id: block.id as string,
            name: block.name as string,
            input: block.input,
          });
        }
        // Skip tool_result, image, etc.
      }
    }

    return blocks;
  }

  return blocks;
}

/**
 * Strip <think>...</think> tags from content for streaming display.
 * This handles partial tags during streaming (e.g., incomplete <think> or </think>).
 *
 * For complete messages, use parseMessageContentBlocks instead.
 */
export function stripThinkTags(content: string): string {
  // Remove complete <think>...</think> blocks
  let result = content.replace(/<think>[\s\S]*?<\/think>/gi, "");

  // Handle partial opening tag at the end (streaming)
  // e.g., "<think>some thinking content..." without closing tag
  const openTagMatch = result.match(/<think>[\s\S]*$/i);
  if (openTagMatch) {
    result = result.slice(0, openTagMatch.index);
  }

  // Handle orphaned closing tag (if opening was stripped in previous chunk)
  result = result.replace(/^[\s\S]*?<\/think>/i, "");

  // Handle partial tag being typed: "<", "<t", "<th", "<thi", "<thin", "<think"
  result = result.replace(/<(?:t(?:h(?:i(?:n(?:k)?)?)?)?)?$/i, "");

  // Remove injected think_duration tag
  result = result.replace(/<!-- think_duration: \d+ -->/g, "");

  return result.trim();
}

/**
 * Parse thinking content from string using multiple formats:
 * 1. <think>...</think> tags (OpenAI/DeepSeek format)
 * 2. Markdown blockquote format ending with "*Thought for Xs*" (GPT-5 thinking format)
 *
 * This is best-effort parsing for models that output thinking in text.
 */
function parseThinkTagsFromString(content: string): ContentBlock[] {
  const blocks: ContentBlock[] = [];

  // First, try to parse GPT-5 thinking format:
  // The format has markdown blockquotes containing thinking, ending with "*Thought for Xs*"
  // Pattern: lines starting with > containing thinking content, then *Thought for Ns* marker
  // After the marker, there may be regular text content

  // Look for the "*Thought for Xs*" marker which separates thinking from content
  const thoughtMarkerMatch = content.match(
    /^([\s\S]*?>\s*\*Thought for \d+s\*)\s*\n*([\s\S]*)$/
  );

  if (thoughtMarkerMatch) {
    const thinkingPart = thoughtMarkerMatch[1];
    const textPart = thoughtMarkerMatch[2].trim();

    // Clean up the thinking content:
    // 1. Remove > prefixes from lines
    // 2. Remove the "Thought for Xs" marker line
    // 3. Remove empty lines at start/end
    const cleanedThinking = thinkingPart
      .split("\n")
      .map((line) => line.replace(/^>\s?/, ""))
      .filter((line) => !line.match(/^\s*\*Thought for \d+s\*\s*$/))
      .join("\n")
      .trim();

    if (cleanedThinking) {
      blocks.push({ type: "thinking", content: cleanedThinking });
    }

    if (textPart) {
      blocks.push({ type: "text", content: textPart });
    }

    return blocks;
  }

  // Fall back to <think>...</think> tag parsing
  const thinkRegex = /<think>([\s\S]*?)<\/think>/gi;

  let lastIndex = 0;
  let match;

  while ((match = thinkRegex.exec(content)) !== null) {
    // Add text before this think block
    const textBefore = content.slice(lastIndex, match.index).trim();
    if (textBefore) {
      blocks.push({ type: "text", content: textBefore });
    }

    // Add the thinking block
    const thinkingContent = match[1].trim();
    if (thinkingContent) {
      blocks.push({ type: "thinking", content: thinkingContent });
    }

    lastIndex = match.index + match[0].length;
  }

  // Handle unclosed <think> tag at the end (streaming scenario)
  const remainingContent = content.slice(lastIndex);
  const unclosedThinkMatch = remainingContent.match(/<think>([\s\S]*)$/i);

  if (unclosedThinkMatch) {
    // Add text before the unclosed think tag
    const textBefore = remainingContent
      .slice(0, unclosedThinkMatch.index)
      .trim();
    if (textBefore) {
      blocks.push({ type: "text", content: textBefore });
    }

    // Add the partial thinking block
    const thinkingContent = unclosedThinkMatch[1].trim();
    // We render specific partial content even if empty to show the block opening
    blocks.push({ type: "thinking", content: thinkingContent });

    // Update lastIndex to end of string so we don't add duplicates
    lastIndex = content.length;
  } else {
    // Normal text remaining
    const textAfter = remainingContent.trim();
    if (textAfter) {
      blocks.push({ type: "text", content: textAfter });
    }
  }

  // If no think tags found, return entire content as text
  if (blocks.length === 0 && content.trim()) {
    blocks.push({ type: "text", content: content });
  }

  return blocks;
}

export function extractStringFromMessageContent(message: Message): string {
  if (message.type === "human") {
    const visibleContent = getVisibleHumanContent(message);
    if (visibleContent !== null) return visibleContent;
  }

  return typeof message.content === "string"
    ? message.content
    : Array.isArray(message.content)
    ? message.content
        .filter(
          (c: unknown) =>
            (typeof c === "object" &&
              c !== null &&
              "type" in c &&
              (c as { type: string }).type === "text") ||
            typeof c === "string"
        )
        .map((c: unknown) =>
          typeof c === "string"
            ? c
            : typeof c === "object" && c !== null && "text" in c
            ? (c as { text?: string }).text || ""
            : ""
        )
        .join("")
    : "";
}

export function extractSubAgentContent(data: unknown): string {
  if (typeof data === "string") {
    return data;
  }

  if (data && typeof data === "object") {
    const dataObj = data as Record<string, unknown>;

    // Try to extract description first
    if (dataObj.description && typeof dataObj.description === "string") {
      return dataObj.description;
    }

    // Then try prompt
    if (dataObj.prompt && typeof dataObj.prompt === "string") {
      return dataObj.prompt;
    }

    // For output objects, try result
    if (dataObj.result && typeof dataObj.result === "string") {
      return dataObj.result;
    }

    // Fallback to JSON stringification
    return JSON.stringify(data, null, 2);
  }

  // Fallback for any other type
  return JSON.stringify(data, null, 2);
}

export function isPreparingToCallTaskTool(messages: Message[]): boolean {
  const lastMessage = messages[messages.length - 1];
  return (
    (lastMessage.type === "ai" &&
      lastMessage.tool_calls?.some(
        (call: { name?: string }) => call.name === "task"
      )) ||
    false
  );
}

export function formatMessageForLLM(message: Message): string {
  let role: string;
  if (message.type === "human") {
    role = "Human";
  } else if (message.type === "ai") {
    role = "Assistant";
  } else if (message.type === "tool") {
    role = `Tool Result`;
  } else {
    role = message.type || "Unknown";
  }

  const timestamp = message.id ? ` (${message.id.slice(0, 8)})` : "";

  let contentText = "";

  // Extract content text
  if (message.type === "human") {
    contentText = extractStringFromMessageContent(message);
  } else if (typeof message.content === "string") {
    contentText = message.content;
  } else if (Array.isArray(message.content)) {
    const textParts: string[] = [];

    message.content.forEach((part: any) => {
      if (typeof part === "string") {
        textParts.push(part);
      } else if (part && typeof part === "object" && part.type === "text") {
        textParts.push(part.text || "");
      }
      // Ignore other types like tool_use in content - we handle tool calls separately
    });

    contentText = textParts.join("\n\n").trim();
  }

  // For tool messages, include additional tool metadata
  if (message.type === "tool") {
    const toolName = (message as any).name || "unknown_tool";
    const toolCallId = (message as any).tool_call_id || "";
    role = `Tool Result [${toolName}]`;
    if (toolCallId) {
      role += ` (call_id: ${toolCallId.slice(0, 8)})`;
    }
  }

  // Handle tool calls from .tool_calls property (for AI messages)
  const toolCallsText: string[] = [];
  if (
    message.type === "ai" &&
    message.tool_calls &&
    Array.isArray(message.tool_calls) &&
    message.tool_calls.length > 0
  ) {
    message.tool_calls.forEach((call: any) => {
      const toolName = call.name || "unknown_tool";
      const toolArgs = call.args ? JSON.stringify(call.args, null, 2) : "{}";
      toolCallsText.push(`[Tool Call: ${toolName}]\nArguments: ${toolArgs}`);
    });
  }

  // Combine content and tool calls
  const parts: string[] = [];
  if (contentText) {
    parts.push(contentText);
  }
  if (toolCallsText.length > 0) {
    parts.push(...toolCallsText);
  }

  if (parts.length === 0) {
    return `${role}${timestamp}: [Empty message]`;
  }

  if (parts.length === 1) {
    return `${role}${timestamp}: ${parts[0]}`;
  }

  return `${role}${timestamp}:\n${parts.join("\n\n")}`;
}

export function formatConversationForLLM(messages: Message[]): string {
  const formattedMessages = messages.map(formatMessageForLLM);
  return formattedMessages.join("\n\n---\n\n");
}
