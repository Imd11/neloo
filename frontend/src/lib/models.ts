// Shared model configuration for the entire application
// All model selectors should import from this file

export interface ModelInfo {
    id: string;
    name: string;
    logo: string;
    provider: string;
    available?: boolean;
}

// Chat models available for conversations and scheduled tasks
export const CHAT_MODELS: ModelInfo[] = [
    { id: "deepseek", name: "DeepSeek V4 Pro", logo: "/logos/deepseek.png", provider: "DeepSeek" },
    { id: "qwen", name: "Qwen3.7 Max", logo: "/logos/qwen.png", provider: "Alibaba Cloud" },
    { id: "minimax", name: "MiniMax M2.7", logo: "/logos/minimax.png", provider: "MiniMax" },
    { id: "anthropic", name: "Claude Opus 4.8", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "openai", name: "GPT-5.5", logo: "/logos/openai.png", provider: "OpenAI" },
    { id: "gemini", name: "Gemini 3.1 Pro Preview", logo: "/logos/gemini.png", provider: "Google" },
    { id: "zhipu", name: "GLM-5.2", logo: "/logos/glm.png", provider: "Z.AI" },
    { id: "openrouter", name: "OpenRouter", logo: "/logos/llama.png", provider: "OpenRouter" },
    { id: "custom-openai", name: "Custom OpenAI-compatible", logo: "/logos/openai.png", provider: "Custom" },
    { id: "custom-anthropic", name: "Custom Anthropic-compatible", logo: "/logos/claude.png", provider: "Custom" },
];

export const CHAT_MODEL_BY_ID = Object.fromEntries(
    CHAT_MODELS.map((model) => [model.id, model])
) as Record<string, ModelInfo>;

// Image generation models
export const IMAGE_MODELS: ModelInfo[] = [
    { id: "gemini", name: "Nano Banana 2", logo: "/logos/nano-banana.png", provider: "Google" },
    { id: "gpt-image-2", name: "GPT Image 2", logo: "/logos/openai.png", provider: "OpenAI" },
];

// Logos that need dark background/inversion in light mode
export const LIGHT_LOGOS = [
    "/logos/openai.png",
    "/logos/grok.png",
    "/logos/kimi.png",
    "/logos/midjourney.png",
    "/logos/sora.png",
    "/logos/runway.png",
    "/logos/pika.png",
    "/logos/luma.png",
    "/logos/hailuo.png",
    "/logos/vidu.png"
];
