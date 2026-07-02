import { NextRequest, NextResponse } from "next/server";
import { generateImage, ResolutionTier, ImageSize } from "@/lib/services/image-generator";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, resolution = "1k", size, model } = body;

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid prompt" },
                { status: 400 }
            );
        }

        const images = await generateImage(
            prompt,
            resolution as ResolutionTier,
            size as ImageSize,
            120000,
            model as string | undefined
        );

        if (!images || images.length === 0) {
            return NextResponse.json(
                { error: "Failed to generate image" },
                { status: 500 }
            );
        }

        return NextResponse.json({ images });
    } catch (error) {
        console.error("[API Generate] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
