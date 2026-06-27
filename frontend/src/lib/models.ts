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
    { id: "deepseek", name: "DeepSeek", logo: "/logos/deepseek.png", provider: "DeepSeek" },
    { id: "qwen", name: "Qwen", logo: "/logos/qwen.png", provider: "Alibaba Cloud" },
    { id: "minimax", name: "MiniMax", logo: "/logos/minimax.png", provider: "MiniMax" },
    { id: "anthropic", name: "Claude", logo: "/logos/claude.png", provider: "Anthropic" },
    { id: "openai", name: "OpenAI", logo: "/logos/openai.png", provider: "OpenAI" },
    { id: "gemini", name: "Gemini", logo: "/logos/gemini.png", provider: "Google" },
    { id: "zhipu", name: "GLM", logo: "/logos/glm.png", provider: "Zhipu AI" },
    { id: "openrouter", name: "OpenRouter", logo: "/logos/llama.png", provider: "OpenRouter" },
    { id: "custom-openai", name: "Custom OpenAI", logo: "/logos/openai.png", provider: "Custom" },
    { id: "custom-anthropic", name: "Custom Claude", logo: "/logos/claude.png", provider: "Custom" },
];

export const CHAT_MODEL_BY_ID = Object.fromEntries(
    CHAT_MODELS.map((model) => [model.id, model])
) as Record<string, ModelInfo>;

// Image generation models
export const IMAGE_MODELS: ModelInfo[] = [
    { id: "nano-banana", name: "Nano Banana", logo: "/logos/nano-banana.png", provider: "Tu-zi" },
    { id: "gemini-2.5-flash-image-preview-nt", name: "Flash Image", logo: "/logos/gemini.png", provider: "Google" },
    { id: "kling-image", name: "可灵 AI", logo: "/logos/kling.png", provider: "Kuaishou" },
    { id: "jimeng-image", name: "即梦", logo: "/logos/jimeng.png", provider: "ByteDance" },
    { id: "midjourney", name: "Midjourney", logo: "/logos/midjourney.png", provider: "Midjourney" },
    { id: "dall-e-3", name: "DALL·E 3", logo: "/logos/openai.png", provider: "OpenAI" },
    { id: "stable-diffusion", name: "Stable Diffusion", logo: "/logos/stability.png", provider: "Stability AI" },
    { id: "minimax-image", name: "MiniMax", logo: "/logos/minimax.png", provider: "MiniMax" },
    { id: "tongyi-wanxiang", name: "通义万相", logo: "/logos/qwen.png", provider: "Alibaba Cloud" },
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
