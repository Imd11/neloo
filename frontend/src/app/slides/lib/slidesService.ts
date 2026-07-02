import { getConfig } from "@/lib/config";
import { Slide, Attachment } from "../types/slides";

const OUTLINE_SYSTEM_INSTRUCTION = `
You are a world-class presentation designer.
Your goal is to create a JSON array of slides based on the user's input.
Each slide must have a 'title', 'content', and a 'visualDescription'.

Rules for 'content':
- Use bullet points for key takeaways.
- Separate each point with a newline character.
- Keep text concise, impactful, and easy to read.

Rules for 'visualDescription':
- Write a detailed prompt for an image generator.
- Describe style, colors, lighting, and subject.

Limit the output to a maximum of 12 slides unless requested otherwise.
Return a valid JSON array only. Do not include markdown fences or extra text.
`;

function getApiBaseUrl(): string {
    return (getConfig()?.deploymentUrl || process.env.NEXT_PUBLIC_API_URL || "").replace(/\/+$/, "");
}

async function generateSlidesText(system: string, prompt: string, modelId?: string | null): Promise<string> {
    const response = await fetch(`${getApiBaseUrl()}/api/slides/generate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ system, prompt, model_id: modelId }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slides generation failed: ${response.status} - ${errorText}`);
    }
    const data = await response.json();
    return data.text || "";
}

export const generateOutlineStream = async (
    topic: string,
    attachments: Attachment[] = [],
    onChunk: (text: string) => void,
    modelId?: string | null
): Promise<string> => {
    const attachmentSummary = attachments.length
        ? `\n\nAttached files:\n${attachments.map((file) => `- ${file.name} (${file.mimeType})`).join("\n")}`
        : "";
    const text = await generateSlidesText(
        OUTLINE_SYSTEM_INSTRUCTION,
        `Create a slide deck outline for: ${topic || "the provided content"}.${attachmentSummary}`,
        modelId
    );
    onChunk(text);
    return text;
};

export const generateSingleSlide = async (
    presentationTopic: string,
    slideDescription: string,
    existingSlides: Slide[] = [],
    insertIndex: number = -1,
    modelId?: string | null
): Promise<Omit<Slide, "id">> => {
    const context = existingSlides
        .map((slide, index) => `Slide ${index + 1}: ${slide.title} - ${slide.content}`)
        .join("\n");
    const text = await generateSlidesText(
        OUTLINE_SYSTEM_INSTRUCTION,
        `Presentation topic: ${presentationTopic}

Existing slides:
${context || "No existing slides."}

Insert index: ${insertIndex}
New slide request: ${slideDescription}

Return one JSON object with title, content, and visualDescription.`,
        modelId
    );
    return JSON.parse(text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim());
};

export const generateSlideImage = async (slide: Slide): Promise<string> => {
    const prompt = `Create a high-quality 16:9 presentation background image.

Visual concept: ${slide.visualDescription}
Context: ${slide.title}

Rules:
- No text, words, or characters in the image.
- Professional, cinematic, clean composition.
- Keep the center area readable for slide text.`;

    const response = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, size: "16x9", resolution: "1k" }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Image generation failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const image = data.images?.[0];
    if (!image) throw new Error("No image data found in response");
    if (image.startsWith("data:image/")) return image.split(",")[1] || "";
    if (!image.startsWith("http")) return image;

    const imageResponse = await fetch(image);
    const imageBlob = await imageResponse.blob();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve((reader.result as string).split(",")[1] || "");
        reader.onerror = reject;
        reader.readAsDataURL(imageBlob);
    });
};
