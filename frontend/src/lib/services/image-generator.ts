/**
 * AI 图片生成服务
 * 基于 tu-zi API，支持多分辨率模型
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_API_URL || "https://api.tu-zi.com";
const API_ENDPOINT = `${API_BASE_URL}/v1/images/generations`;

// Model IDs for different resolutions
const MODEL_MAP: Record<string, string> = {
    "1k": "gemini-3-pro-image-preview",
    "2k": "gemini-3-pro-image-preview-2k",
    "4k": "gemini-3-pro-image-preview-4k",
};

export type ResolutionTier = "1k" | "2k" | "4k";
export type ImageSize = "1x1" | "16x9" | "9x16" | "4x3" | "3x4" | "2x3" | "3x2" | "4x5" | "5x4" | "21x9" | undefined;

type NormalizedImage = {
    base64Data?: string;
    dataUrl?: string;
    mimeType?: string;
    url?: string;
};

function normalizeImageSource(image?: string): NormalizedImage | undefined {
    if (!image) return undefined;
    // Data URL
    const dataUrlMatch = image.match(/^data:(.*?);base64,(.*)$/);
    if (dataUrlMatch) {
        return {
            mimeType: dataUrlMatch[1],
            base64Data: dataUrlMatch[2],
            dataUrl: image
        };
    }
    // Plain base64
    if (/^[A-Za-z0-9+/]+=*$/.test(image)) {
        return {
            mimeType: "image/png",
            base64Data: image,
            dataUrl: `data:image/png;base64,${image}`
        };
    }
    // Remote URL
    return { url: image };
}

/**
 * Check if API response contains actual images (not just text)
 */
function hasImageInResponse(raw: any): boolean {
    if (Array.isArray(raw?.data)) {
        for (const item of raw.data) {
            if (item?.url && typeof item.url === "string" && item.url.startsWith("http")) {
                return true;
            }
        }
    }
    if (Array.isArray(raw?.data?.images)) {
        for (const img of raw.data.images) {
            if (img?.url) return true;
        }
    }
    return false;
}

type GenerationOptions = {
    onImage?: (url: string) => void;
    expectCount?: number;
};

// Max retry attempts when AI returns text instead of image
const MAX_RETRIES = 2;

/**
 * Generate an image based on prompt
 */
export async function generateImage(
    prompt: string,
    apiKey: string,
    resolution: ResolutionTier = "1k",
    size: ImageSize = "1x1",
    options: GenerationOptions = {},
    timeoutMs = 120000
): Promise<string[] | null> {
    if (!apiKey) {
        console.error("[AI Image] Missing API Key");
        return null;
    }

    const model = MODEL_MAP[resolution] || MODEL_MAP["1k"];

    const collectedSet = new Set<string>();
    const collected: string[] = [];
    const pushImages = (images: string[]) => {
        for (const img of images) {
            if (!img) continue;
            if (collectedSet.has(img)) continue;
            collectedSet.add(img);
            collected.push(img);
            options.onImage?.(img);
        }
    };

    const buildRequestBody = (attemptPrompt: string) => {
        return {
            model,
            prompt: attemptPrompt,
            n: options.expectCount || 1,
            response_format: "url",
            ...(size && { size }),
            ...(resolution ? { quality: resolution } : {})
        };
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
                attemptPrompt = `[RETRY ${attempt}] 上次请求返回了文字而非图片，这是错误的。请务必生成图片！\n\n` + prompt;
            }

            const requestBody = buildRequestBody(attemptPrompt);

            if (attempt === 0) {
                console.log("[AI Image] Sending request:", JSON.stringify(requestBody, null, 2));
            }

            const res = await fetch(API_ENDPOINT, {
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

            if (!hasImageInResponse(raw)) {
                console.warn(`[AI Image] Attempt ${attempt + 1}: No images in response`);
                if (attempt < MAX_RETRIES) {
                    continue;
                }
                console.error(`[AI Image] All ${MAX_RETRIES + 1} attempts failed`);
                return null;
            }

            // Parse images from response
            const images: string[] = [];
            if (Array.isArray(raw?.data)) {
                raw.data.forEach((item: any) => {
                    if (item?.url) images.push(item.url);
                });
            }
            if (!images.length && Array.isArray(raw?.data?.images)) {
                raw.data.images.forEach((img: any) => {
                    if (img?.url) images.push(img.url);
                });
            }

            pushImages(images);

            if (collected.length) {
                console.log("[AI Image] Received image(s)", collected.length);
                return collected;
            }
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof Error && error.name === "AbortError") {
                console.error(`[AI Image] Attempt ${attempt + 1} aborted after timeout`);
                if (collected.length) {
                    return collected;
                }
                return null;
            }

            console.error(`[AI Image] Attempt ${attempt + 1} failed:`, error);

            if (collected.length) {
                return collected;
            }

            if (attempt >= MAX_RETRIES) {
                return null;
            }
        }
    }

    return null;
}
