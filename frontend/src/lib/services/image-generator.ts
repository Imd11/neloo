/**
 * Server-side image generation service.
 *
 * Browser code must call the Next.js route. Provider API keys and base URLs
 * stay on the server.
 */

export type ResolutionTier = "1k" | "2k" | "4k";
export type ImageSize =
    | "1x1"
    | "16x9"
    | "9x16"
    | "4x3"
    | "3x4"
    | "2x3"
    | "3x2"
    | "4x5"
    | "5x4"
    | "21x9"
    | undefined;

type ImageProvider = "nanobanana" | "openai";

export interface ProviderConfig {
    provider: ImageProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
}

const DEFAULT_NANO_BANANA_MODEL = "nano-banana";
const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";

function normalizeModel(model?: string): string {
    return (model || "").trim().toLowerCase();
}

export function resolveImageProvider(model?: string): ProviderConfig {
    const normalized = normalizeModel(model);

    if (normalized === "gpt-image-2" || normalized === "openai") {
        const apiKey = process.env.OPENAI_API_KEY?.trim();
        if (!apiKey) {
            throw new Error("Missing OPENAI_API_KEY for GPT Image 2");
        }
        return {
            provider: "openai",
            apiKey,
            baseUrl: (process.env.OPENAI_BASE_URL || "https://api.openai.com").replace(/\/+$/, ""),
            model: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL,
        };
    }

    const apiKey = process.env.NANOBANANA_IMAGE_API_KEY?.trim();
    const baseUrl = process.env.NANOBANANA_IMAGE_BASE_URL?.trim();
    if (!apiKey) {
        throw new Error("Missing NANOBANANA_IMAGE_API_KEY");
    }
    if (!baseUrl) {
        throw new Error("Missing NANOBANANA_IMAGE_BASE_URL");
    }

    return {
        provider: "nanobanana",
        apiKey,
        baseUrl: baseUrl.replace(/\/+$/, ""),
        model: process.env.NANOBANANA_IMAGE_MODEL?.trim() || model || DEFAULT_NANO_BANANA_MODEL,
    };
}

function extractImages(raw: any): string[] {
    const images: string[] = [];

    if (Array.isArray(raw?.data)) {
        for (const item of raw.data) {
            if (typeof item?.url === "string") images.push(item.url);
            if (typeof item?.b64_json === "string") {
                images.push(`data:image/png;base64,${item.b64_json}`);
            }
        }
    }

    if (Array.isArray(raw?.data?.images)) {
        for (const item of raw.data.images) {
            if (typeof item?.url === "string") images.push(item.url);
            if (typeof item?.b64_json === "string") {
                images.push(`data:image/png;base64,${item.b64_json}`);
            }
        }
    }

    return images;
}

export async function generateImage(
    prompt: string,
    resolution: ResolutionTier = "1k",
    size?: ImageSize,
    timeoutMs = 120000,
    model?: string
): Promise<string[]> {
    const provider = resolveImageProvider(model);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    const requestBody: Record<string, any> = {
        model: provider.model,
        prompt,
        n: 1,
        response_format: "url",
    };

    if (size) requestBody.size = size;
    if (resolution) requestBody.quality = resolution;

    try {
        const response = await fetch(`${provider.baseUrl}/v1/images/generations`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${provider.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });

        if (!response.ok) {
            const text = await response.text();
            throw new Error(`${provider.provider} image request failed: ${response.status} ${text}`);
        }

        const images = extractImages(await response.json());
        if (!images.length) {
            throw new Error("No image returned from provider");
        }
        return images;
    } finally {
        clearTimeout(timeoutId);
    }
}
