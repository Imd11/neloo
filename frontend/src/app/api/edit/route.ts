import { NextRequest, NextResponse } from "next/server";
import { editImage } from "@/lib/services/image-editor";

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const originalImageUrl = formData.get("originalImageUrl") as string | null;
        const markedImageDataUrl = formData.get("markedImageDataUrl") as string | null;
        const prompt = formData.get("prompt") as string | null;
        const model = formData.get("model");
        const resolution = formData.get("resolution");
        const size = formData.get("size");

        if (!originalImageUrl || !markedImageDataUrl || !prompt) {
            return NextResponse.json(
                { error: "Missing required fields: originalImageUrl, markedImageDataUrl, prompt" },
                { status: 400 }
            );
        }

        console.log("[API Edit] Received two-image request", {
            originalImageUrlLength: originalImageUrl.length,
            markedImageDataUrlLength: markedImageDataUrl.length,
            prompt,
            model,
            resolution,
            size,
        });

        const apiKey = process.env.NANOBANANA_IMAGE_API_KEY;
        if (!apiKey) {
            console.error("[API Edit] Missing NANOBANANA_IMAGE_API_KEY");
            return NextResponse.json(
                { error: "Server configuration error" },
                { status: 500 }
            );
        }

        const urls = await editImage(originalImageUrl, markedImageDataUrl, prompt, apiKey, {
            model: typeof model === "string" ? model : undefined,
            resolution: typeof resolution === "string" ? resolution : undefined,
            size: typeof size === "string" ? size : undefined,
        });

        return NextResponse.json({ urls });
    } catch (error) {
        console.error("[API Edit] Error:", error);
        return NextResponse.json(
            { error: "Image editing failed", details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
