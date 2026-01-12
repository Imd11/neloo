const API_BASE_URL = process.env.NEXT_PUBLIC_IMAGE_API_URL || "https://api.tu-zi.com";
const CHAT_ENDPOINT = `${API_BASE_URL}/v1/chat/completions`;
const MODEL = "gemini-3-pro-image-preview";

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
    apiKey: string
): Promise<string[]> {
    const systemPrompt = `你是一个专业的图片编辑AI。用户会给你两张图片：
1. 第一张是原始图片（需要被修改的干净完整图片）
2. 第二张是标记参考图（与第一张相同的原图 + 红色半透明标记层）

第二张图片中的红色半透明区域标注了需要修改的位置。
这些红色标记仅用于指示位置，不是图片的实际内容。

你的任务是：
- 观察第二张图片中的红色半透明标记位置
- 查看该位置的原始内容是什么（第二张图中可以看到）
- 在第一张原图的对应位置进行修改
- 输出一张完整的修改后图片`;

    const userPrompt = `请根据标记图（第二张图片中的红色半透明区域），在原图（第一张图片）的对应位置进行以下修改：

${prompt}

重要约束：
1. 只修改红色标记对应的区域
2. 输出的图片中不能包含任何红色标记或半透明层
3. 其他区域必须保持原样不变
4. 修改要自然融入原图`;

    try {
        console.log("[AI Edit] Sending two-image request to", CHAT_ENDPOINT);
        console.log("[AI Edit] Original image URL:", originalImageUrl.substring(0, 100) + "...");
        console.log("[AI Edit] Marked image Data URL length:", markedImageDataUrl.length);

        const res = await fetch(CHAT_ENDPOINT, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${apiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: MODEL,
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
