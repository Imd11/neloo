/**
 * Image Resize Service
 *
 * Fit mode resizing with Sharp (Node.js runtime).
 */

import sharp from "sharp";

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
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
}

