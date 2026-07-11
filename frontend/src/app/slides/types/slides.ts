export interface Slide {
  id: string;
  title: string;
  content: string;
  visualDescription: string;
  imageBase64?: string;
  isGeneratingImage?: boolean;
  generationFailed?: boolean;
  customCanvasJson?: string;
}

export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 string
}

export type SlidesViewState = "GENERATING" | "OUTLINE" | "SLIDESHOW";

export interface PresentationData {
  id: string;
  user_id?: string;
  topic: string;
  title: string;
  slides: Slide[];
  attachments?: Attachment[];
  style?: unknown;
  preset_id?: string;
  presetId?: string;
  created_at?: string;
  updated_at?: string;
}

// Canvas object type for SlideViewer
export interface CanvasObject {
  id: string;
  type: "text" | "rect";
  text?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
  fill: string;
  fontSize?: number;
  fontStyle?: string;
  textDecoration?: string;
  align?: "left" | "center" | "right";
  field?: "title" | "content";
}

// Constants
export const CANVAS_WIDTH = 1280;
export const CANVAS_HEIGHT = 720;
export const LINE_HEIGHT = 1.4;

// Allowed MIME types for attachments
export const ALLOWED_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/heic",
  "image/heif",
  "audio/wav",
  "audio/mp3",
  "audio/aiff",
  "audio/aac",
  "audio/ogg",
  "audio/flac",
  "application/pdf",
];
