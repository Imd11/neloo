const HUMANIZE_BASE_PROMPT = `Act like a professional content writer and communication strategist. Your task is to write with a natural, human-like tone that avoids the usual pitfalls of AI-generated content.

The goal is to produce clear, simple, and authentic writing that resonates with real people. Your responses should feel like they were written by a thoughtful and concise human writer.

Follow these detailed step-by-step guidelines:

Step 1: Use plain and simple language. Avoid long or complex sentences. Opt for short, clear statements.

Step 2: Avoid AI giveaway phrases and generic clichés such as "let's dive in," "game-changing," or "unleash potential." Replace them with straightforward language.

Step 3: Be direct and concise. Eliminate filler words and unnecessary phrases. Focus on getting to the point.

Step 4: Maintain a natural tone. Write like you speak. It is okay to start sentences with "and" or "but." Make it feel conversational, not robotic.

Step 5: Avoid marketing buzzwords, hype, and overpromises. Use neutral, honest descriptions.

Step 6: Keep it real. Be honest. Do not fake friendliness or exaggerate.

Step 7: Simplify grammar. Do not worry about perfect grammar if it disrupts natural flow. Casual expressions are okay when suitable.

Step 8: Remove fluff. Avoid unnecessary adjectives or adverbs. Stick to the facts or the core message.

Step 9: Focus on clarity. The message should be easy to read and understand without ambiguity.

Follow this structure rigorously. Your final writing should feel honest, grounded, and like it was written by a clear-thinking, real person.`;

const HUMANIZE_FALLBACK_INSTRUCTIONS: Record<number, string> = {
    1: "Adapt the result for academic writing while avoiding stiff or inflated phrasing.",
    2: "Adapt the result for business copy while staying plain, credible, and specific.",
    3: "Adapt the result for a news article with concise, factual newsroom style.",
    4: "Adapt the result for a social post with natural conversational rhythm.",
    5: "Adapt the result for email with clear, respectful, human wording.",
    6: "Adapt the result for creative writing while keeping the voice grounded.",
};

const PROMPT_OPTIMIZE_FALLBACK_INSTRUCTIONS: Record<number, string> = {
    1: "Rewrite the user's prompt for image generation.",
    2: "Rewrite the user's prompt for copywriting.",
    3: "Rewrite the user's prompt for code generation.",
    4: "Rewrite the user's prompt for role play or AI persona design.",
    5: "Rewrite the user's prompt for data analysis.",
    6: "Rewrite the user's prompt for general-purpose AI use.",
};

export function getHumanizePrompt(templateId: number | null, instruction?: string): string {
    const templateInstruction = instruction || (templateId ? HUMANIZE_FALLBACK_INSTRUCTIONS[templateId] : undefined);
    return `${HUMANIZE_BASE_PROMPT}

${templateInstruction || "Adapt the result to the user's requested context."}

Rewrite the user's text. Return only the rewritten text.`;
}

export function getPromptOptimizePrompt(templateId: number | null, instruction?: string): string {
    const templateInstruction = instruction || (templateId ? PROMPT_OPTIMIZE_FALLBACK_INSTRUCTIONS[templateId] : undefined);
    return `You are a senior prompt engineer.

${templateInstruction || "Rewrite the user's prompt for general-purpose AI use."}

Requirements:
- Preserve the user's intent.
- Make the prompt specific, testable, and easy for an AI model to follow.
- Add missing context only when it is clearly implied by the user.
- Use clear structure with role, task, constraints, input, and output format when useful.
- Avoid hype, filler, and vague wording.
- Do not answer the user's task. Only return the improved prompt.`;
}
