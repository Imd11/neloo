/**
 * AI 图片生成服务
 * 基于 tu-zi Chat API，支持返回文字 + 图片
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_API_URL || "https://api.tu-zi.com";
const CHAT_ENDPOINT = `${API_BASE_URL}/v1/chat/completions`;

// Model IDs for different resolutions
const MODEL_MAP: Record<string, string> = {
    "1k": "gemini-3-pro-image-preview",
    "2k": "gemini-3-pro-image-preview-2k",
    "4k": "gemini-3-pro-image-preview-4k",
};

export type ResolutionTier = "1k" | "2k" | "4k";
export type ImageSize = "1x1" | "16x9" | "9x16" | "4x3" | "3x4" | "2x3" | "3x2" | "4x5" | "5x4" | "21x9" | undefined;

// 图片生成结果，包含文字和图片
export interface ImageGenerationResult {
    text: string | null;      // AI 返回的文字描述
    images: string[];         // 图片 URL 列表
}

// Max retry attempts when AI returns text instead of image
const MAX_RETRIES = 2;

/**
 * 从 Chat API 响应中提取文字内容
 */
function extractTextFromResponse(content: any): string | null {
    if (typeof content === "string") {
        // 移除 URL 后返回纯文字
        const textWithoutUrls = content.replace(/https?:\/\/[^\s"'<>]+/gi, '').trim();
        return textWithoutUrls || null;
    }
    if (Array.isArray(content)) {
        const textParts: string[] = [];
        for (const part of content) {
            if (part?.type === "text" && part?.text) {
                textParts.push(part.text);
            }
            if (typeof part === "string") {
                textParts.push(part);
            }
        }
        const combined = textParts.join(" ").replace(/https?:\/\/[^\s"'<>]+/gi, '').trim();
        return combined || null;
    }
    return null;
}

/**
 * 从 Chat API 响应中提取图片 URL
 */
function extractImagesFromResponse(content: any): string[] {
    const images: string[] = [];

    if (typeof content === "string") {
        // 从文字中提取图片 URL
        const urlMatches = content.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|gif|webp)/gi);
        if (urlMatches) images.push(...urlMatches);

        // 检查 base64 data URLs
        const base64Matches = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
        if (base64Matches) images.push(...base64Matches);
    }

    if (Array.isArray(content)) {
        for (const part of content) {
            if (part?.type === "image_url" && part?.image_url?.url) {
                images.push(part.image_url.url);
            }
            if (typeof part === "string") {
                const urlMatches = part.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|gif|webp)/gi);
                if (urlMatches) images.push(...urlMatches);
            }
        }
    }

    return images;
}

/**
 * 检查响应中是否有图片
 */
function hasImageInChatResponse(raw: any): boolean {
    const content = raw?.choices?.[0]?.message?.content;
    if (!content) return false;

    const images = extractImagesFromResponse(content);
    return images.length > 0;
}

/**
 * Generate an image based on prompt using Chat API
 * Returns both text description and image URLs
 */
export async function generateImage(
    prompt: string,
    apiKey: string,
    resolution: ResolutionTier = "1k",
    size: ImageSize = "1x1",
    timeoutMs = 120000
): Promise<ImageGenerationResult | null> {
    if (!apiKey) {
        console.error("[AI Image] Missing API Key");
        return null;
    }

    const model = MODEL_MAP[resolution] || MODEL_MAP["1k"];

    const systemPrompt = `你是一个专业的AI图像生成助手。当用户发送描述时，你需要：
1. 根据描述生成一张高质量图片
2. 用简短自然的语言回应用户（1-2句话即可）

回应要自然友好，避免生硬的模板式回答。`;

    const buildUserMessage = (attemptPrompt: string) => {
        let content = attemptPrompt;
        if (size && size !== "1x1") {
            content += `\n\n[图片比例: ${size}]`;
        }
        return content;
    };

    // Retry loop
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const perAttemptTimeout = Math.floor(timeoutMs / (MAX_RETRIES + 1)) * (MAX_RETRIES + 1 - attempt);
        const timeoutId = setTimeout(() => controller.abort(), perAttemptTimeout);

        try {
            let attemptPrompt = prompt;
            if (attempt > 0) {
                console.log(`[AI Image] Retry attempt ${attempt}/${MAX_RETRIES}`);
                attemptPrompt = `[重试 ${attempt}] 请务必生成图片！\n\n` + prompt;
            }

            const requestBody = {
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: buildUserMessage(attemptPrompt) }
                ],
                max_tokens: 4096
            };

            if (attempt === 0) {
                console.log("[AI Image] Sending Chat API request:", JSON.stringify(requestBody, null, 2));
            }

            const res = await fetch(CHAT_ENDPOINT, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${apiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!res.ok) {
                const text = await res.text();
                throw new Error(`API request failed: ${res.status} ${res.statusText}\n${text}`);
            }

            const raw = await res.json();
            console.log("[AI Image] Raw API Response:", JSON.stringify(raw, null, 2));

            if (!hasImageInChatResponse(raw)) {
                console.warn(`[AI Image] Attempt ${attempt + 1}: No images in response`);
                if (attempt < MAX_RETRIES) {
                    continue;
                }
                console.error(`[AI Image] All ${MAX_RETRIES + 1} attempts failed`);
                return null;
            }

            // Extract text and images from response
            const content = raw?.choices?.[0]?.message?.content;
            const text = extractTextFromResponse(content);
            const images = extractImagesFromResponse(content);

            console.log("[AI Image] Extracted text:", text);
            console.log("[AI Image] Extracted images:", images);

            if (images.length > 0) {
                return { text, images };
            }
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === "AbortError") {
                console.error(`[AI Image] Attempt ${attempt + 1} aborted after timeout`);
                return null;
            }

            console.error(`[AI Image] Attempt ${attempt + 1} failed:`, error);

            if (attempt >= MAX_RETRIES) {
                return null;
            }
        }
    }

    return null;
}
