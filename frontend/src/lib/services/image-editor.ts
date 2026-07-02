import { resolveImageProvider } from "./image-generator";

interface EditImageOptions {
    model?: string;
    resolution?: string;
    size?: string;
}

/**
 * Edit image using two-image approach:
 * - originalImageUrl: The clean original image (HTTP URL)
 * - markedImageDataUrl: The marking layer showing where to edit (Data URL with red marks)
 * 
 * AI sees both images and modifies the original based on the marking layer.
 */
export async function editImage(
    originalImageUrl: string,
    markedImageDataUrl: string,
    prompt: string,
    options: EditImageOptions = {}
): Promise<string[]> {
    const provider = resolveImageProvider(options.model);
    const systemPrompt = `You are a professional image-editing AI. The user will provide two images:
1. The first image is the clean original image that needs to be edited.
2. The second image is a marked reference image: the same original image with a semi-transparent red marking layer.

The semi-transparent red regions in the second image mark the locations that need editing.
These red marks are only positional indicators and are not part of the actual image content.

Your task:
- Observe the positions of the semi-transparent red marks in the second image.
- Inspect the original content at those positions, which is still visible in the second image.
- Apply the requested edit to the corresponding positions in the first original image.
- Output one complete edited image.`;

    const userPrompt = `Use the marked reference image, specifically the semi-transparent red regions in the second image, to edit the corresponding positions in the original image, which is the first image.

${prompt}

Important constraints:
1. Modify only the areas corresponding to the red marks.
2. The output image must not contain any red marks or semi-transparent overlay.
3. All other areas must remain unchanged.
4. The edit must blend naturally into the original image.`;

    try {
        console.log("[AI Edit] Sending two-image request to", provider.baseUrl);
        console.log("[AI Edit] Original image URL:", originalImageUrl.substring(0, 100) + "...");
        console.log("[AI Edit] Marked image Data URL length:", markedImageDataUrl.length);
        console.log("[AI Edit] Using model:", provider.model, "resolution:", options.resolution, "size:", options.size);

        const res = await fetch(`${provider.baseUrl}/v1/chat/completions`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${provider.apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: provider.model,
                messages: [
                    {
                        role: "system",
                        content: systemPrompt
                    },
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: userPrompt
                            },
                            {
                                type: "image_url",
                                image_url: { url: originalImageUrl }
                            },
                            {
                                type: "image_url",
                                image_url: { url: markedImageDataUrl }
                            }
                        ]
                    }
                ],
                max_tokens: 4096
            })
        });

        if (!res.ok) {
            const text = await res.text();
            throw new Error(`API request failed: ${res.status} ${res.statusText}\n${text}`);
        }

        const raw = await res.json();
        console.log("[AI Edit] Raw response:", JSON.stringify(raw).substring(0, 500));

        const images: string[] = [];

        if (raw?.choices?.[0]?.message?.content) {
            const content = raw.choices[0].message.content;

            if (Array.isArray(content)) {
                for (const part of content) {
                    if (part?.type === "image_url" && part?.image_url?.url) {
                        images.push(part.image_url.url);
                    }
                    if (typeof part === "string") {
                        const urlMatches = part.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|gif|webp)/gi);
                        if (urlMatches) images.push(...urlMatches);
                    }
                }
            }

            if (typeof content === "string") {
                const urlMatches = content.match(/https?:\/\/[^\s"'<>]+\.(png|jpg|jpeg|gif|webp)/gi);
                if (urlMatches) images.push(...urlMatches);

                const base64Matches = content.match(/data:image\/[^;]+;base64,[A-Za-z0-9+/=]+/g);
                if (base64Matches) images.push(...base64Matches);
            }
        }

        if (Array.isArray(raw?.data)) {
            raw.data.forEach((item: { url?: string }) => {
                if (item?.url) images.push(item.url);
            });
        }

        if (!images.length) {
            console.warn("[AI Edit] No images found in response", raw);
            throw new Error("No images returned from API");
        }

        console.log("[AI Edit] Found", images.length, "images");
        return images;
    } catch (error) {
        console.error("[AI Edit] Request failed:", error);
        throw error;
    }
}
