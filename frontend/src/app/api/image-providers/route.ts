import { NextResponse } from "next/server";
import { DEFAULT_GEMINI_IMAGE_MODEL, DEFAULT_OPENAI_IMAGE_MODEL } from "@/lib/services/image-provider";

function hasValue(value: string | undefined): boolean {
    return Boolean(value && value.trim());
}

export async function GET() {
    const geminiConfigured =
        hasValue(process.env.GEMINI_IMAGE_API_KEY) || hasValue(process.env.GEMINI_API_KEY);
    const gptImageConfigured = hasValue(process.env.OPENAI_API_KEY);

    return NextResponse.json({
        models: [
            {
                id: "gemini",
                model_name: process.env.GEMINI_IMAGE_MODEL?.trim() || DEFAULT_GEMINI_IMAGE_MODEL,
                available: geminiConfigured,
            },
            {
                id: "gpt-image-2",
                model_name: process.env.OPENAI_IMAGE_MODEL?.trim() || DEFAULT_OPENAI_IMAGE_MODEL,
                available: gptImageConfigured,
            },
        ],
    });
}
