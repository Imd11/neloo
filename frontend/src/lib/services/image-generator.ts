/**
 * Server-side image generation service.
 *
 * Browser code must call the Next.js route. Provider API keys and base URLs
 * stay on the server.
 */

import {
    buildGeminiImageRequest,
    resolveImageProvider,
    type ImageSize,
    type ResolutionTier,
} from "./image-provider";

export { resolveImageProvider, type ImageSize, type ResolutionTier } from "./image-provider";

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

function extractGeminiImages(raw: any): string[] {
    const outputImage = raw?.output_image;
    if (typeof outputImage?.data === "string") {
        return [`data:${outputImage.mime_type || "image/png"};base64,${outputImage.data}`];
    }

    const images: string[] = [];
    for (const step of raw?.steps || []) {
        for (const content of step?.content || []) {
            if (content?.type === "image" && typeof content?.data === "string") {
                images.push(`data:${content.mime_type || "image/png"};base64,${content.data}`);
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
    model?: string,
    signal?: AbortSignal
): Promise<string[]> {
    const provider = resolveImageProvider(model);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    const abortFromCaller = () => controller.abort();
    signal?.addEventListener("abort", abortFromCaller, { once: true });

    if (provider.provider === "gemini") {
        try {
            const response = await fetch(`${provider.baseUrl}/interactions`, {
                method: "POST",
                headers: {
                    "x-goog-api-key": provider.apiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(buildGeminiImageRequest(prompt, resolution, size, provider.model)),
                signal: controller.signal,
            });

            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Gemini image request failed: ${response.status} ${text}`);
            }

            const images = extractGeminiImages(await response.json());
            if (!images.length) {
                throw new Error("No image returned from Gemini");
            }
            return images;
        } finally {
            clearTimeout(timeoutId);
            signal?.removeEventListener("abort", abortFromCaller);
        }
    }

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
        signal?.removeEventListener("abort", abortFromCaller);
    }
}
