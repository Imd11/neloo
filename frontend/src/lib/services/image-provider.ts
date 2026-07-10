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

export type ImageProvider = "gemini" | "openai";

export interface ProviderConfig {
    provider: ImageProvider;
    apiKey: string;
    baseUrl: string;
    model: string;
}

export interface GeminiImageInput {
    type: "image";
    mime_type: string;
    data: string;
}

export const DEFAULT_GEMINI_IMAGE_MODEL = "gemini-3.1-flash-image";
export const DEFAULT_OPENAI_IMAGE_MODEL = "gpt-image-2";

const GEMINI_IMAGE_API_BASE_URL = "https://generativelanguage.googleapis.com/v1beta";

const ASPECT_RATIOS: Record<Exclude<ImageSize, undefined>, string> = {
    "1x1": "1:1",
    "16x9": "16:9",
    "9x16": "9:16",
    "4x3": "4:3",
    "3x4": "3:4",
    "2x3": "2:3",
    "3x2": "3:2",
    "4x5": "4:5",
    "5x4": "5:4",
    "21x9": "21:9",
};

const GEMINI_IMAGE_SIZES: Record<ResolutionTier, string> = {
    "1k": "1K",
    "2k": "2K",
    "4k": "4K",
};

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

    const apiKey = process.env.GEMINI_IMAGE_API_KEY?.trim() || process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
        throw new Error("Missing GEMINI_IMAGE_API_KEY for Nano Banana 2");
    }

    return {
        provider: "gemini",
        apiKey,
        baseUrl: GEMINI_IMAGE_API_BASE_URL,
        model: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
    };
}

export function buildGeminiImageRequest(
    prompt: string,
    resolution: ResolutionTier,
    size?: ImageSize,
    model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL
): Record<string, unknown> {
    return {
        model,
        input: prompt,
        response_format: buildGeminiResponseFormat(resolution, size),
    };
}

export function buildGeminiImageEditRequest(
    prompt: string,
    images: GeminiImageInput[],
    resolution: ResolutionTier,
    size?: ImageSize,
    model = process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL
): Record<string, unknown> {
    return {
        model,
        input: [...images, { type: "text", text: prompt }],
        response_format: buildGeminiResponseFormat(resolution, size),
    };
}

function buildGeminiResponseFormat(
    resolution: ResolutionTier,
    size?: ImageSize
): Record<string, string> {
    const responseFormat: Record<string, string> = {
        type: "image",
        mime_type: "image/png",
        image_size: GEMINI_IMAGE_SIZES[resolution],
    };
    if (size) {
        responseFormat.aspect_ratio = ASPECT_RATIOS[size];
    }

    return responseFormat;
}
