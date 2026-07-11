/**
 * Image Resize Service
 *
 * Fit mode resizing with Sharp (Node.js runtime).
 */

import sharp from "sharp";
import { assertSafeRemoteImageUrl } from "@/lib/server/image-request-guard";

const MAX_SOURCE_IMAGE_BYTES = 15 * 1024 * 1024;

export interface ResizeOptions {
  width: number;
  height: number;
}

export interface ResizeResult {
  buffer: Buffer;
  width: number;
  height: number;
}

async function loadImageBuffer(buffer: Buffer): Promise<sharp.Sharp> {
  const image = sharp(buffer);
  const metadata = await image.metadata();

  if (metadata.space === "cmyk") {
    return sharp(buffer).toColorspace("srgb");
  }

  return image;
}

export async function resizeImage(
  buffer: Buffer,
  options: ResizeOptions
): Promise<ResizeResult> {
  const { width, height } = options;

  const image = await loadImageBuffer(buffer);

  const resized = image.resize(width, height, {
    fit: "fill",
    kernel: sharp.kernel.lanczos3,
  });

  const outputBuffer = await resized
    .png({
      quality: 100,
      compressionLevel: 9,
      adaptiveFiltering: true,
    })
    .toBuffer();

  const outputMetadata = await sharp(outputBuffer).metadata();

  return {
    buffer: outputBuffer,
    width: outputMetadata.width!,
    height: outputMetadata.height!,
  };
}

export async function fetchImageBuffer(url: string): Promise<Buffer> {
  assertSafeRemoteImageUrl(url);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    if (!response.headers.get("content-type")?.startsWith("image/")) {
      throw new Error("The remote URL did not return an image");
    }
    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error("The source image is too large");
    }
    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > MAX_SOURCE_IMAGE_BYTES) {
      throw new Error("The source image is too large");
    }
    return Buffer.from(arrayBuffer);
  } finally {
    clearTimeout(timeoutId);
  }
}
