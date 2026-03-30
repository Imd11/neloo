// Shared model configuration for the entire application
// All model selectors should import from this file

export interface ModelInfo {
    id: string;
    name: string;
    logo: string;
    provider: string;
}

// Chat models available for conversations and scheduled tasks
export const CHAT_MODELS: ModelInfo[] = [
    // DeepSeek
    { id: "deepseek-chat", name: "DeepSeek V3.2", logo: "/logos/deepseek.png", provider: "DeepSeek" },
    { id: "deepseek-reasoner", name: "DeepSeek V3.2 (思考)", logo: "/logos/deepseek.png", provider: "DeepSeek" },

    // Claude (OpenRouter/NewAPI)
    { id: "claude-opus-or", name: "Claude Opus 4.5 (OR)", logo: "/logos/claude.png", provider: "Anthropic" },

    // GLM
    { id: "glm-4.7", name: "GLM-4.7", logo: "/logos/glm.png", provider: "Zhipu AI" },

    // Llama (OpenRouter)
    { id: "llama-4-maverick", name: "Llama 4 Maverick", logo: "/logos/llama.png", provider: "Meta" },
    { id: "llama-3.3-70b", name: "Llama 3.3", logo: "/logos/llama.png", provider: "Meta" },
];

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
