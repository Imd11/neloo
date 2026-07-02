import { NextResponse } from "next/server";

function hasValue(value: string | undefined): boolean {
    return Boolean(value && value.trim());
}

export async function GET() {
    const nanoBananaConfigured =
        hasValue(process.env.NANOBANANA_IMAGE_API_KEY) &&
        hasValue(process.env.NANOBANANA_IMAGE_BASE_URL);
    const gptImageConfigured = hasValue(process.env.OPENAI_API_KEY);

    return NextResponse.json({
        models: [
            {
                id: "nano-banana",
                available: nanoBananaConfigured,
            },
            {
                id: "gpt-image-2",
                available: gptImageConfigured,
            },
        ],
    });
}
