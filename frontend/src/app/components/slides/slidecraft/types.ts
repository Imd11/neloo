// ─── Style System Types ───

export interface StyleDimensions {
    texture: 'clean' | 'grid' | 'organic' | 'pixel' | 'paper';
    mood: 'professional' | 'warm' | 'cool' | 'vibrant' | 'dark' | 'neutral';
    typography: 'geometric' | 'humanist' | 'handwritten' | 'editorial' | 'technical';
    density: 'minimal' | 'balanced' | 'dense';
}

export interface ColorPalette {
    background: string;
    primaryText: string;
    secondaryText: string;
    accent1: string;
    accent2: string;
    accent3?: string;
}

export interface StylePreset {
    id: string;
    name: string;
    nameZh: string;
    description: string;
    feel: string;
    dimensions: StyleDimensions;
    autoSelectTriggers: string[];
    colorPalette: ColorPalette;
}

// ─── Layout Types ───

export interface LayoutObjectTemplate {
    field: 'title' | 'content' | 'subtitle';
    x: number; y: number; width: number;
    fontSize: number;
    align: 'left' | 'center' | 'right';
    fontStyle?: string;
}

export interface LayoutTemplate {
    id: string;
    name: string;
    description: string;
    forTypes: Array<'cover' | 'content' | 'back-cover'>;
    objects: LayoutObjectTemplate[];
}

// ─── Slide & Presentation Types ───

export interface Slide {
    id: string;
    title: string;
    content: string;
    visualDescription: string;
    layout?: string;
    narrativeGoal?: string;
    slideType?: 'cover' | 'content' | 'back-cover';
    imageBase64?: string;
    isGeneratingImage?: boolean;
    generationFailed?: boolean;
    customCanvasJson?: string;
}

export interface Attachment {
    name: string;
    mimeType: string;
    data: string; // Base64
}

export type ViewState = 'HOME' | 'STYLE_SELECT' | 'OUTLINE' | 'SLIDESHOW';

export interface PresentationData {
    id: string;
    topic: string;
    slides: Slide[];
    createdAt: number;
    style?: StyleDimensions;
    presetId?: string;
}

// ─── Canvas Object Types ───

export interface CanvasObject {
    id: string;
    type: 'text' | 'rect';
    x: number; y: number;
    width: number; height?: number;
    text?: string;
    fontSize?: number;
    fontStyle?: string;
    fill?: string;
    align?: string;
    textDecoration?: string;
    field?: 'title' | 'content';
    rotation?: number;
}
