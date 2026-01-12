import { NextRequest, NextResponse } from "next/server";
import { generateImage, ResolutionTier, ImageSize } from "@/lib/services/image-generator";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { prompt, resolution = "1k", size } = body;

        if (!prompt || typeof prompt !== "string") {
            return NextResponse.json(
                { error: "Missing or invalid prompt" },
                { status: 400 }
            );
        }

        const apiKey = process.env.NANOBANANA_IMAGE_API_KEY;
        if (!apiKey) {
            console.error("[API Generate] Missing NANOBANANA_IMAGE_API_KEY");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const result = await generateImage(
            prompt,
            apiKey,
            resolution as ResolutionTier,
            size as ImageSize
        );

        if (!result || result.images.length === 0) {
            return NextResponse.json(
                { error: "Failed to generate image" },
                { status: 500 }
            );
        }

        // 返回文字和图片
        return NextResponse.json({
            text: result.text,
            images: result.images
        });
    } catch (error) {
        console.error("[API Generate] Error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}
