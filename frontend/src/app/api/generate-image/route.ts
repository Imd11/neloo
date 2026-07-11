import { NextRequest, NextResponse } from "next/server";
import { generateImage, ResolutionTier, ImageSize } from "@/lib/services/image-generator";
import { rejectUnsafeImageRequest } from "@/lib/server/image-request-guard";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
    try {
        const rejection = await rejectUnsafeImageRequest(req, Number(process.env.IMAGE_RUNS_PER_10_MINUTES || 20));
        if (rejection) return rejection;

        const body = await req.json();
        const { prompt, resolution = "1k", size, model } = body;

        if (!prompt || typeof prompt !== "string" || prompt.length > 4_000) {
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
            model as string | undefined,
            req.signal
        );

        if (!images || images.length === 0) {
            return NextResponse.json(
                { error: "Failed to generate image" },
                { status: 500 }
            );
        }

        return NextResponse.json({ images });
    } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
            return NextResponse.json({ error: "Image generation cancelled" }, { status: 499 });
        }
        console.error("[API Generate] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
