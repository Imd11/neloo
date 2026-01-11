export interface CanvasImage {
    id: string;
    src: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation: number;
    isSelected: boolean;
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
