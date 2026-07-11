import { NextRequest, NextResponse } from "next/server";
import { editImage } from "@/lib/services/image-editor";
import {
  assertSafeRemoteImageUrl,
  rejectUnsafeImageRequest,
  runWithImageConcurrency,
} from "@/lib/server/image-request-guard";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const rejection = await rejectUnsafeImageRequest(
      req,
      Number(process.env.IMAGE_RUNS_PER_10_MINUTES || 20)
    );
    if (rejection) return rejection;

    const formData = await req.formData();
    const originalImageUrl = formData.get("originalImageUrl") as string | null;
    const markedImageDataUrl = formData.get("markedImageDataUrl") as
      | string
      | null;
    const prompt = formData.get("prompt") as string | null;
    const model = formData.get("model");
    const resolution = formData.get("resolution");
    const size = formData.get("size");

    if (
      !originalImageUrl ||
      !markedImageDataUrl ||
      !prompt ||
      prompt.length > 4_000
    ) {
      return NextResponse.json(
        {
          error:
            "Missing required fields: originalImageUrl, markedImageDataUrl, prompt",
        },
        { status: 400 }
      );
    }

    assertSafeRemoteImageUrl(originalImageUrl);
    if (
      !markedImageDataUrl.startsWith("data:image/") ||
      markedImageDataUrl.length > 15_000_000
    ) {
      return NextResponse.json(
        { error: "Invalid marked image input" },
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

    const urls = await runWithImageConcurrency(req, () =>
      editImage(originalImageUrl, markedImageDataUrl, prompt, {
        model: typeof model === "string" ? model : undefined,
        resolution: typeof resolution === "string" ? resolution : undefined,
        size: typeof size === "string" ? size : undefined,
      })
    );

    return NextResponse.json({ urls });
  } catch (error) {
    console.error("[API Edit] Error:", error);
    return NextResponse.json(
      {
        error: "Image editing failed",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
