import type { Message } from "@langchain/langgraph-sdk";

export type HiddenPromptFeature =
  | "fortune"
  | "prompt-optimize"
  | "deai"
  | "agent";

export interface HiddenPromptContext {
  feature: HiddenPromptFeature;
  templateId?: number;
  agentName?: string;
}

export interface HiddenPromptEnvelope {
  visibleContent: string;
  hiddenPrefix: string;
  context: HiddenPromptContext;
}

export const HIDDEN_PROMPT_KEY = "neloo_hidden_prompt";

const LEGACY_HIDDEN_PREFIX_MARKERS = [
  "You are a senior prompt engineer.",
  "Act like a professional content writer",
  "Analysis direction:",
  "[System: You are now acting as the agent",
] as const;

const LEGACY_VISIBLE_CONTENT_MARKERS = [
  "\nUser information:\n",
  "\nRewrite the user's text. Return only the rewritten text.",
  "Rewrite the user's text. Return only the rewritten text.",
  "\n- Do not answer the user's task. Only return the improved prompt.",
  "- Do not answer the user's task. Only return the improved prompt.",
  "\n---\nUser message:]\n",
] as const;

type MessageWithAdditionalKwargs = Message & {
  additional_kwargs?: Record<string, unknown>;
};

export function createHiddenPromptMessage(
  id: string,
  envelope: HiddenPromptEnvelope
): Message {
  return {
    id,
    type: "human",
    content: `${envelope.hiddenPrefix}${envelope.visibleContent}`,
    additional_kwargs: {
      [HIDDEN_PROMPT_KEY]: {
        visibleContent: envelope.visibleContent,
        context: envelope.context,
      },
    },
  } as Message;
}

export function getVisibleHumanContent(message: Message): string | null {
  const additional = (message as MessageWithAdditionalKwargs).additional_kwargs;
  const payload = additional?.[HIDDEN_PROMPT_KEY];

  if (
    payload &&
    typeof payload === "object" &&
    "visibleContent" in payload &&
    typeof (payload as { visibleContent?: unknown }).visibleContent === "string"
  ) {
    return (payload as { visibleContent: string }).visibleContent;
  }

  return typeof message.content === "string"
    ? sanitizeLegacyHiddenPromptContent(message.content)
    : null;
}

export function sanitizeLegacyHiddenPromptContent(content: string): string {
  const stripped = content.trimStart();
  if (
    !LEGACY_HIDDEN_PREFIX_MARKERS.some((marker) => stripped.startsWith(marker))
  ) {
    return content;
  }

  for (const marker of LEGACY_VISIBLE_CONTENT_MARKERS) {
    const markerIndex = stripped.indexOf(marker);
    if (markerIndex >= 0) {
      return stripped.slice(markerIndex + marker.length).trimStart();
    }
  }

  return content;
}

export function sanitizeHiddenPromptMessageForPersistence(
  message: Message
): Message {
  if (message.type !== "human") return message;

  const additional = (message as MessageWithAdditionalKwargs).additional_kwargs;
  const hiddenPayload = additional?.[HIDDEN_PROMPT_KEY];

  if (!hiddenPayload) return message;

  const visibleContent = getVisibleHumanContent(message);
  if (visibleContent === null) return message;

  return {
    ...message,
    content: visibleContent,
    additional_kwargs: {
      ...(additional ?? {}),
      [HIDDEN_PROMPT_KEY]: {
        ...(typeof hiddenPayload === "object" && hiddenPayload
          ? hiddenPayload
          : {}),
      },
    },
  } as Message;
}

export function sanitizeHiddenPromptMessagesForPersistence(
  messages: Message[]
): Message[] {
  return messages.map(sanitizeHiddenPromptMessageForPersistence);
}
