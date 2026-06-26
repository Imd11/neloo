import { Slide, Attachment } from "../types/slides";

// Tu-Zi API 配置（文本生成）
const TUZI_CHAT_URL = 'https://api.tu-zi.com/v1/chat/completions';
const TUZI_API_KEY = process.env.NEXT_PUBLIC_TUZI_API_KEY?.trim();
const TUZI_CHAT_MODEL = 'gemini-3-flash-preview';

// 图片生成 API 配置
const IMAGE_API_URL = 'https://api.tu-zi.com/v1/images/generations';
const IMAGE_MODEL = 'gemini-2.5-flash-image-preview-nt';

const OUTLINE_SYSTEM_INSTRUCTION = `
You are a world-class presentation designer. 
Your goal is to create a JSON array of slides based on the user's input.
Each slide must have a 'title', 'content', and a 'visualDescription'.

Rules for 'content':
- Use bullet points for key takeaways.
- CRITICAL: SEPARATE EACH POINT WITH A NEWLINE CHARACTER (\\n).
- Do not use markdown hyphens or asterisks at the start of lines, just the text separated by newlines.
- Keep text concise, impactful, and easy to read.

Rules for 'visualDescription':
- Detailed prompt for an image generator (no text in image).
- Describe style, colors, lighting, and subject.

Limit the output to a maximum of 12 slides unless requested otherwise.

IMPORTANT: Your response must be a valid JSON array only. Do not include any markdown code blocks or extra text.
`;

function getTuziApiKey(): string {
    if (!TUZI_API_KEY) {
        throw new Error("Missing NEXT_PUBLIC_TUZI_API_KEY");
    }
    return TUZI_API_KEY;
}

export const generateOutlineStream = async (
    topic: string,
    attachments: Attachment[] = [],
    onChunk: (text: string) => void
): Promise<string> => {
    try {
        const apiKey = getTuziApiKey();

        // 构建多模态消息内容（OpenAI 格式）
        const userContent: any[] = [];

        // 添加附件（文档/图片）
        attachments.forEach(file => {
            if (file.mimeType.startsWith('image/') || file.mimeType === 'application/pdf') {
                userContent.push({
                    type: 'image_url',
                    image_url: {
                        url: `data:${file.mimeType};base64,${file.data}`
                    }
                });
            }
        });

        // 添加文本提示
        userContent.push({
            type: 'text',
            text: `Create a slide deck outline for: ${topic || 'the provided content'}.${attachments.length > 0 ? ' Please analyze the uploaded documents/images and incorporate relevant information.' : ''}`
        });

        const response = await fetch(TUZI_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: TUZI_CHAT_MODEL,
                messages: [
                    { role: 'system', content: OUTLINE_SYSTEM_INSTRUCTION },
                    { role: 'user', content: userContent }
                ],
                stream: true,
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tu-Zi API error: ${response.status} - ${errorText}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response body");

        const decoder = new TextDecoder();
        let fullText = "";

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n').filter(line => line.trim() !== '');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        const content = parsed.choices?.[0]?.delta?.content;
                        if (content) {
                            fullText += content;
                            onChunk(fullText);
                        }
                    } catch {
                        // 忽略解析错误
                    }
                }
            }
        }

        return fullText;
    } catch (error) {
        console.error("Error generating outline:", error);
        throw error;
    }
};

export const generateSingleSlide = async (
    presentationTopic: string,
    slideDescription: string,
    existingSlides: Slide[] = [],
    insertIndex: number = -1
): Promise<Omit<Slide, 'id'>> => {
    try {
        const apiKey = getTuziApiKey();

        // 构建上下文
        let contextOutline = "";

        if (existingSlides.length > 0) {
            contextOutline = "\nCurrent Presentation Outline:\n";
            for (let i = 0; i <= existingSlides.length; i++) {
                if (i === insertIndex) {
                    contextOutline += `>>> [INSERT NEW SLIDE HERE] <<<\n`;
                }

                if (i < existingSlides.length) {
                    const s = existingSlides[i];
                    contextOutline += `Slide ${i + 1}: ${s.title} (${s.content.replace(/\n/g, '; ').substring(0, 100)}...)\n`;
                }
            }
        }

        const userMessage = `
Presentation Topic: ${presentationTopic}
${contextOutline}

New Slide Request: ${slideDescription}

Create a single slide that fits perfectly into the flow of this presentation at the marked position.
Ensure the content flows logically from the previous slide and leads into the next slide.
Match the tone and style of the existing deck.

Return a JSON object with keys: title, content, visualDescription
`;

        const response = await fetch(TUZI_CHAT_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: TUZI_CHAT_MODEL,
                messages: [
                    { role: 'system', content: OUTLINE_SYSTEM_INSTRUCTION },
                    { role: 'user', content: userMessage }
                ],
                temperature: 0.7
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Tu-Zi API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();
        const text = data.choices?.[0]?.message?.content;

        if (!text) throw new Error("No response text");

        return JSON.parse(text);
    } catch (error) {
        console.error("Error generating single slide:", error);
        throw error;
    }
};

export const generateSlideImage = async (slide: Slide): Promise<string> => {
    try {
        const apiKey = getTuziApiKey();

        const prompt = `
      Create a high-quality, 16:9 aspect ratio background image for a presentation slide.
      
      Visual Concept: ${slide.visualDescription}
      Context: ${slide.title}
      
      Style Guidelines:
      - Professional, Cinematic, Minimalist, Dark Mode aesthetic.
      - Ensure the center area is not too busy to allow for text overlay.
      
      CRITICAL: 
      - This image must contain NO TEXT, NO WORDS, and NO CHARACTERS. 
      - It is a background only.
    `;

        const response = await fetch(IMAGE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: IMAGE_MODEL,
                prompt: prompt.trim(),
                size: '16x9',
                n: 1,
                response_format: 'b64_json'
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Image API error: ${response.status} - ${errorText}`);
        }

        const data = await response.json();

        if (data.data && data.data[0]) {
            if (data.data[0].b64_json) {
                return data.data[0].b64_json;
            }
            if (data.data[0].url) {
                const imageResponse = await fetch(data.data[0].url);
                const imageBlob = await imageResponse.blob();
                return new Promise((resolve, reject) => {
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const base64 = (reader.result as string).split(',')[1];
                        resolve(base64);
                    };
                    reader.onerror = reject;
                    reader.readAsDataURL(imageBlob);
                });
            }
        }

        throw new Error("No image data found in response");
    } catch (error) {
        console.error("Error generating slide image:", error);
        return "";
    }
};
