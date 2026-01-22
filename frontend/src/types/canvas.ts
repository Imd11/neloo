export interface CanvasImage {
    id: string;
    url: string;
    x: number;
    y: number;
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
