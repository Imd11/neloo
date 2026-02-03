// DeepSeek API Client
// Using OpenAI-compatible API format

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
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
    field: string;        // e.g., "personal.summary" or "experience.0.description"
    before: string;       // Original value
    after: string;        // Suggested new value
    reason?: string;      // Why this change is recommended
}

// System prompt for resume optimization with structured suggestions
export const RESUME_SYSTEM_PROMPT = `你是一位专业的简历优化助手。你的任务是帮助用户优化他们的简历内容。

你的能力包括：
1. 优化职位描述和工作经历的表述
2. 建议更有力的动词和关键词
3. 提供针对特定行业的优化建议
4. 帮助精简冗长的内容
5. 检查语法和表达问题

【重要】当用户要求修改简历内容时，你需要返回 JSON 格式的响应：

如果用户只是提问（不涉及修改），正常回复文字即可。

如果用户要求修改某个字段，返回如下 JSON：
\`\`\`json
{
  "message": "你的回复文字，解释为什么这样修改",
  "suggestion": {
    "field": "字段路径，如 personal.summary 或 experience.0.description",
    "before": "原始内容",
    "after": "优化后的内容",
    "reason": "修改理由"
  }
}
\`\`\`

字段路径说明：
- personal.name - 姓名
- personal.title - 职位
- personal.summary - 个人简介
- personal.email - 邮箱
- experience.0.description - 第一段工作经历的描述
- experience.0.position - 第一段工作经历的职位
- education.0.description - 第一段教育经历的描述
- skills.0.name - 第一个技能名称

回复规则：
- 如果是普通对话，直接返回文字
- 如果是修改请求，返回包含 suggestion 的 JSON
- JSON 必须用 \`\`\`json 包裹`;

export async function sendMessage(
    messages: ChatMessage[],
    onStream?: (chunk: string) => void
): Promise<string> {
    const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;

    if (!apiKey) {
        throw new Error('DeepSeek API key not configured');
    }

    const response = await fetch(DEEPSEEK_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
            model: 'deepseek-chat',
            messages: [
                { role: 'system', content: RESUME_SYSTEM_PROMPT },
                ...messages,
            ],
            stream: !!onStream,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`);
    }

    // Handle streaming
    if (onStream && response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let fullContent = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value);
            const lines = chunk.split('\n').filter(line => line.startsWith('data: '));

            for (const line of lines) {
                const data = line.slice(6);
                if (data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                        fullContent += content;
                        onStream(content);
                    }
                } catch {
                    // Skip invalid JSON
                }
            }
        }

        return fullContent;
    }

    // Non-streaming response
    const data: DeepSeekResponse = await response.json();
    return data.choices[0]?.message?.content || '';
}

// Helper to create a context message with current resume data
export function createResumeContext(resumeData: unknown): string {
    return `当前简历数据：\n\`\`\`json\n${JSON.stringify(resumeData, null, 2)}\n\`\`\``;
}

// Parse AI response to extract suggestion if present
export function parseAIResponse(content: string): { message: string; suggestion?: Suggestion } {
    // Try to extract JSON from the response
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);

    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed.suggestion) {
                return {
                    message: parsed.message || '',
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
    const path = suggestion.field.split('.');

    let current: Record<string, unknown> = newData;
    for (let i = 0; i < path.length - 1; i++) {
        const key = path[i];
        // Handle array indices like "experience.0"
        if (!isNaN(Number(key))) {
            current = (current as unknown as Record<string, unknown>[])[Number(key)] as Record<string, unknown>;
        } else {
            current = current[key] as Record<string, unknown>;
        }
    }

    const lastKey = path[path.length - 1];
    current[lastKey] = suggestion.after;

    return newData;
}
