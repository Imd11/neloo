import { NextRequest, NextResponse } from "next/server";
import { fetchImageBuffer, resizeImage } from "@/lib/resize-service";
import {
  rejectUnsafeImageRequest,
  runWithImageConcurrency,
} from "@/lib/server/image-request-guard";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const rejection = await rejectUnsafeImageRequest(
      request,
      Number(process.env.IMAGE_RUNS_PER_10_MINUTES || 40)
    );
    if (rejection) return rejection;

    const body = await request.json();
    const { imageUrl, width, height } = body;

    if (!imageUrl || !width || !height) {
      return NextResponse.json(
        { error: "Missing required parameters: imageUrl, width, height" },
        { status: 400 }
      );
    }

    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      width <= 0 ||
      height <= 0 ||
      width > 8192 ||
      height > 8192 ||
      width * height > 40_000_000
    ) {
      return NextResponse.json(
        { error: "Invalid dimensions" },
        { status: 400 }
      );
    }

    const result = await runWithImageConcurrency(request, async () => {
      const imageBuffer = await fetchImageBuffer(imageUrl);
      return resizeImage(imageBuffer, { width, height });
    });

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `image_${width}x${height}_${timestamp}.png`;

    return new NextResponse(new Uint8Array(result.buffer), {
      headers: {
        "Content-Type": "image/png",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": result.buffer.length.toString(),
      },
    });
  } catch (error) {
    console.error("Error resizing image:", error);
    return NextResponse.json(
      { error: "Failed to resize image. Please try again." },
      { status: 500 }
    );
  }
}
