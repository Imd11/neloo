export interface ImageMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
    imageUrl?: string;
    isLoading?: boolean;
    autoFly?: boolean; // Flag to trigger automatic fly animation
    timestamp: Date;
}

export interface GeneratedImage {
    id: string;
    url: string;
    prompt: string;
    timestamp: Date;
}
