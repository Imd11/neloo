import { getConfig } from "@/lib/config";
import type { PresentationData, Slide } from "../types/slides";

function getApiBaseUrl(): string {
    return (getConfig()?.deploymentUrl || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
        ...init,
        headers: {
            "Content-Type": "application/json",
            ...init?.headers,
        },
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slides persistence failed: ${response.status} - ${errorText}`);
    }
    return response.json();
}

export const savePresentation = async (
    data: Omit<PresentationData, "created_at" | "updated_at">,
    _accessToken?: string
): Promise<PresentationData> => {
    return request<PresentationData>("/api/slides/presentations", {
        method: "POST",
        body: JSON.stringify({
            id: data.id,
            title: data.title || data.topic || "Untitled",
            topic: data.topic,
            slides: data.slides,
            attachments: data.attachments || [],
            style: data.style,
            preset_id: data.preset_id || data.presetId,
        }),
    });
};

export const getPresentation = async (
    id: string,
    _accessToken?: string
): Promise<PresentationData | null> => {
    try {
        return await request<PresentationData>(`/api/slides/presentations/${encodeURIComponent(id)}`);
    } catch (error) {
        if (error instanceof Error && error.message.includes("404")) return null;
        throw error;
    }
};

export const getAllPresentations = async (
    _userId: string,
    _accessToken?: string
): Promise<PresentationData[]> => {
    return request<PresentationData[]>("/api/slides/presentations");
};

export const deletePresentation = async (
    id: string,
    _accessToken?: string
): Promise<void> => {
    await request(`/api/slides/presentations/${encodeURIComponent(id)}`, {
        method: "DELETE",
    });
};

export const updateSlideImage = async (
    presentationId: string,
    slideId: string,
    imageBase64: string,
    _accessToken?: string
): Promise<void> => {
    const presentation = await getPresentation(presentationId);
    if (!presentation) return;
    const slides = updateSlide(presentation.slides, slideId, {
        imageBase64,
        isGeneratingImage: false,
    });
    await savePresentation({ ...presentation, slides });
};

export const updateSlideContent = async (
    presentationId: string,
    slideId: string,
    updates: { title?: string; content?: string; customCanvasJson?: string },
    _accessToken?: string
): Promise<void> => {
    const presentation = await getPresentation(presentationId);
    if (!presentation) return;
    const slides = updateSlide(presentation.slides, slideId, updates);
    await savePresentation({ ...presentation, slides });
};

function updateSlide(slides: Slide[], slideId: string, updates: Partial<Slide>): Slide[] {
    return slides.map((slide) =>
        slide.id === slideId ? { ...slide, ...updates } : slide
    );
}
