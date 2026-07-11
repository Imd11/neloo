// DeepSeek API Client
// Using OpenAI-compatible API format

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface DeepSeekResponse {
  id: string;
  choices: {
    index: number;
    message: {
      role: string;
      content: string;
    };
    finish_reason: string;
  }[];
}

// Suggestion structure for applying changes
export interface Suggestion {
  field: string; // e.g., "personal.summary" or "experience.0.description"
  before: string; // Original value
  after: string; // Suggested new value
  reason?: string; // Why this change is recommended
}

// System prompt for resume optimization with structured suggestions
export const RESUME_SYSTEM_PROMPT = `You are a professional resume optimization assistant. Your task is to help users improve their resume content.

Your capabilities include:
1. Improving role descriptions and work experience wording.
2. Suggesting stronger action verbs and keywords.
3. Providing optimization suggestions for specific industries.
4. Helping simplify overly long content.
5. Checking grammar and expression issues.

Important: when the user asks you to modify resume content, return a JSON response.

If the user is only asking a question and not requesting a modification, reply in normal text.

If the user asks to modify a field, return JSON in this shape:
\`\`\`json
{
  "message": "Your response explaining why this change is recommended",
  "suggestion": {
    "field": "Field path, such as personal.summary or experience.0.description",
    "before": "Original content",
    "after": "Optimized content",
    "reason": "Reason for the change"
  }
}
\`\`\`

Field path examples:
- personal.name - full name
- personal.title - professional title
- personal.summary - professional summary
- personal.email - email address
- experience.0.description - description of the first work experience
- experience.0.position - position of the first work experience
- education.0.description - description of the first education record
- skills.0.name - first skill name

Response rules:
- For normal conversation, return text directly.
- For modification requests, return JSON containing suggestion.
- JSON must be wrapped in \`\`\`json fences.`;

// Backend URL for API proxy
const BACKEND_URL = process.env.NEXT_PUBLIC_API_URL || "";

export async function sendMessage(
  messages: ChatMessage[],
  onStream?: (chunk: string) => void
): Promise<string> {
  // Call backend proxy instead of direct DeepSeek API
  // This avoids exposing API keys in frontend
  const response = await fetch(`${BACKEND_URL}/api/resume/optimize`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
      stream: false, // Streaming not supported via proxy yet
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new Error(errorData.detail || `API error: ${response.status}`);
  }

  const data = await response.json();

  if (!data.success) {
    throw new Error(data.detail || "Optimization failed");
  }

  const content = data.content || "";

  // If onStream callback provided, simulate streaming with full content
  if (onStream && content) {
    onStream(content);
  }

  return content;
}

// Helper to create a context message with current resume data
export function createResumeContext(resumeData: unknown): string {
  return `Current resume data:\n\`\`\`json\n${JSON.stringify(
    resumeData,
    null,
    2
  )}\n\`\`\``;
}

// Parse AI response to extract suggestion if present
export function parseAIResponse(content: string): {
  message: string;
  suggestion?: Suggestion;
} {
  // Try to extract JSON from the response
  const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);

  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[1]);
      if (parsed.suggestion) {
        return {
          message: parsed.message || "",
          suggestion: parsed.suggestion,
        };
      }
    } catch {
      // Not valid JSON, return as plain message
    }
  }

  // Return as plain message if no suggestion found
  return { message: content };
}

// Apply suggestion to resume data
export function applySuggestion(
  resumeData: Record<string, unknown>,
  suggestion: Suggestion
): Record<string, unknown> {
  const newData = JSON.parse(JSON.stringify(resumeData)); // Deep clone
  const path = suggestion.field.split(".");

  let current: Record<string, unknown> = newData;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    // Handle array indices like "experience.0"
    if (!isNaN(Number(key))) {
      current = (current as unknown as Record<string, unknown>[])[
        Number(key)
      ] as Record<string, unknown>;
    } else {
      current = current[key] as Record<string, unknown>;
    }
  }

  const lastKey = path[path.length - 1];
  current[lastKey] = suggestion.after;

  return newData;
}
