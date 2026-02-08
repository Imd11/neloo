export interface CanvasImage {
    id: string;
    url: string;
    x: number;
    y: number;
    displayHeight?: number;
    parentId?: string;
    status?: "loading" | "success" | "failed";
    error?: string;
    loadingType?: "generate" | "edit";
    generationParams?: {
        prompt: string;
        resolution: "1k" | "2k" | "4k";
        size?: string;
    };
}

export const CANVAS_IMAGE_CARD_WIDTH = 300;

const SIZE_TO_ASPECT_RATIO: Record<string, number> = {
    "1x1": 1,
    "16x9": 16 / 9,
    "9x16": 9 / 16,
    "4x3": 4 / 3,
    "3x4": 3 / 4,
};

export function getCanvasImageAspectRatio(size?: string): number {
    if (!size) return 1;
    return SIZE_TO_ASPECT_RATIO[size] ?? 1;
}

export function getCanvasImageHeight(size?: string): number {
    return Math.round(CANVAS_IMAGE_CARD_WIDTH / getCanvasImageAspectRatio(size));
}

export function getCanvasImagePlaceholderHeight(size?: string): number {
    return getCanvasImageHeight(size);
}

export interface ViewState {
    offsetX: number;
    offsetY: number;
    scale: number;
}

export type CanvasTool = 'select' | 'hand' | 'brush' | 'eraser';

export interface BrushSettings {
    size: number;
    color: string;
    opacity: number;
}
