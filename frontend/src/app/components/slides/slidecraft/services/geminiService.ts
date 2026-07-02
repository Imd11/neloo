import { Slide, Attachment, StyleDimensions } from '../types';
import { buildStyleInstructions } from '../data/styleInstructions';
import { buildPresetPromptContext } from '../data/presets';
import { getConfig } from '@/lib/config';

const BAOYU_OUTLINE_RULES = `## Content & Deck Rules
- Respect reader attention: each slide communicates ONE main idea
- Prioritize clarity over comprehensiveness
- Every slide must be self-contained
- No placeholders, no TBDs, no vague references
- Headlines must be narrative, not labels
- Avoid AI clichés such as "dive into", "explore", "journey", "let's", "in conclusion"
- Keep a consistent visual language across the deck
- Cover slide must create a visual hook
- Back cover must end with a meaningful takeaway or call-to-action
- Use the same language as the user's content
- Match punctuation style to the user's content language`;

const BAOYU_IMAGE_BASE_PROMPT = `## Core Persona: The Architect
You are "The Architect" - a master visual storyteller creating presentation slides.

## Core Principles
- Tell a visual story that complements the narrative
- Use bold, confident visual language
- Balance information density with visual clarity
- Create memorable, impactful visuals
- Each slide conveys ONE clear message
- No slide numbers, page numbers, footers, headers, or logos

## Text Style
- ALL text must match the designated style aesthetic
- Title text must be large, bold, and immediately readable
- Body text must be clear, legible, and intentionally placed
- Max 3-4 text elements unless the provided style explicitly supports dense information
- Font rendering must match the selected style, not generic default slide typography

## Layout Principles
- Establish one clear focal point
- Create strong visual hierarchy through scale and contrast
- Preserve breathing room with generous margins and spacing
- Balance visual weight across the frame
- Follow a natural reading path (Z-pattern for text-heavy slides)
- Use rule-of-thirds placement where helpful

## Prompt Integrity Rules
- Every required detail must appear in this prompt
- Do not rely on previous slides or external references
- Do not invent placeholder text or unspecified numbers
- Keep wording direct and confident, without AI-sounding filler
- Use the same language and punctuation style as the provided slide content`;

function getApiBaseUrl(): string {
    return (getConfig()?.deploymentUrl || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
}

async function generateSlidesText(system: string, prompt: string, signal?: AbortSignal): Promise<string> {
    const baseUrl = getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/slides/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ system, prompt }),
        signal,
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Slides generation failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    return data.text || '';
}
function buildOutlineSystemPrompt(style?: StyleDimensions, presetId?: string): string {
    const styleBlock = style ? buildStyleInstructions(style, presetId) : '';

    return `You are a world-class presentation designer and content strategist.

## Content Analysis
Before generating slides, analyze the input to identify:
- Core message (≤15 words)
- 3-5 supporting arguments
- Call to action or key takeaway

## Content Rules (CRITICAL)
- Each slide communicates ONE core idea only
- Headlines must be NARRATIVE, not labels. 
  ✅ "Revenue doubled in 6 months"  
  ❌ "Key Statistics"
- The last slide is NOT "Thank You" — it's a call-to-action or key takeaway recap
- First slide is a compelling title that hooks the audience
- Keep bullet points to max 3-4 per slide

## Slide Count Guidelines
- Short content (<500 words): 5-8 slides
- Medium content (500-2000 words): 8-12 slides  
- Long content (>2000 words): 10-15 slides
- Maximum: 15 slides

${BAOYU_OUTLINE_RULES}

${styleBlock}

## Output Format
Return a JSON array, each slide object has:
- "title": Narrative headline (not a label)
- "content": 2-4 bullet points or a short paragraph
- "visualDescription": Describe the ideal full-slide visual treatment for this slide image. Be specific about mood, colors, composition, emphasis, and how the content should be visually framed.
- "slideType": "cover" | "content" | "back-cover"
- "layout": one of: "title-hero", "title-left", "split-screen", "big-statement", "top-title", "quote-callout", "bottom-heavy", "closing"
- "narrativeGoal": What this slide accomplishes in the story arc (1 sentence)

First slide must be slideType "cover" with layout "title-hero".
Last slide must be slideType "back-cover" with layout "closing".

Return ONLY the JSON array. No markdown fences, no explanation.`;
}

export async function generateOutlineStream(
    topic: string,
    attachments: Attachment[],
    style: StyleDimensions | undefined,
    onChunk: (text: string) => void,
    signal?: AbortSignal,
    presetId?: string
): Promise<string> {
    const presetContext = buildPresetPromptContext(presetId);
    const attachmentSummary = attachments.length > 0
        ? `\n\nAttached files (names only; file contents are not sent in the DeepSeek text-only path):\n${attachments
            .map(att => `- ${att.name} (${att.mimeType || 'unknown'})`)
            .join('\n')}`
        : '';
    const fullText = await generateSlidesText(
        buildOutlineSystemPrompt(style, presetId),
        `Create a presentation about: ${topic || 'the provided content'}.${attachmentSummary}${presetContext ? `\n\n${presetContext}\n\nUse this preset faithfully in the deck's narrative, visual direction, layout choice, and information density.` : ''}`,
        signal
    );
    onChunk(fullText);

    return fullText;
}

export async function generateSingleSlide(
    topic: string,
    existingSlides: Slide[],
    insertIndex: number,
    style?: StyleDimensions,
    presetId?: string
): Promise<Slide | null> {
    const styleBlock = style ? buildStyleInstructions(style, presetId) : '';
    const presetContext = buildPresetPromptContext(presetId);
    const context = existingSlides.map((s, i) => `Slide ${i + 1}: ${s.title}`).join('\n');

    const text = await generateSlidesText(
        `You are a presentation designer. Generate ONE slide to insert at position ${insertIndex + 1}.
${BAOYU_OUTLINE_RULES}
${styleBlock}
Return a single JSON object with: title, content, visualDescription, slideType ("content"), layout (one of: title-left, split-screen, big-statement, top-title, quote-callout, bottom-heavy), narrativeGoal.
Return ONLY JSON. No markdown.`,
        `Topic: ${topic}\n\nExisting outline:\n${context}\n\nGenerate a new slide for position ${insertIndex + 1}.${presetContext ? `\n\n${presetContext}` : ''}`,
    );
    try {
        const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
        const slide = JSON.parse(cleaned);
        return {
            id: crypto.randomUUID(),
            title: slide.title || 'New Slide',
            content: slide.content || '',
            visualDescription: slide.visualDescription || '',
            slideType: slide.slideType || 'content',
            layout: slide.layout || 'title-left',
            narrativeGoal: slide.narrativeGoal || '',
        };
    } catch { return null; }
}

export async function generateSlideImage(
    slide: Slide,
    style?: StyleDimensions,
    signal?: AbortSignal,
    presetId?: string
): Promise<string> {
    const styleBlock = style ? buildStyleInstructions(style, presetId) : '';
    const presetContext = buildPresetPromptContext(presetId);
    const layoutGuidance = getLayoutGuidance(slide.layout, slide.slideType);

    const prompt = `Create a stunning, high-quality 16:9 presentation slide image.

${BAOYU_IMAGE_BASE_PROMPT}

${presetContext ? `## Selected Preset\n${presetContext}` : ''}

## Slide Content
Slide Type:
${slide.slideType || 'content'}

Title:
${slide.title}

Body Copy:
${slide.content}

${slide.narrativeGoal ? `Narrative Goal:\n${slide.narrativeGoal}\n` : ''}

## Visual Direction
${slide.visualDescription}

## Layout Guidance
${layoutGuidance}

${styleBlock}

## CRITICAL RULES
- Render the ENTIRE slide in one image, including title text, body copy, layout, and decorative elements
- Text must be legible, intentional, and integrated into the composition
- Keep the text concise and exactly aligned with the provided title/body copy
- Make the visual hierarchy obvious at first glance
- Preserve consistency with the deck's style system and layout grammar
- Make the slide self-contained: the viewer should understand it without spoken narration
- Do not add page numbers, logos, watermarks, browser chrome, or unrelated text
- Use the color palette and visual style from the style instructions above
- Aspect ratio MUST be 16:9 (landscape)
- High resolution, professional quality`;

    const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            prompt,
            size: '16x9',
            resolution: '1k',
        }),
        signal,
    });

    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Image API error: ${response.status} - ${errText}`);
    }

    const data = await response.json();

    const image = data.images?.[0];
    if (!image) {
        throw new Error('No image data returned');
    }
    if (image.startsWith('data:image/')) {
        return image.split(',')[1] || '';
    }
    if (image.startsWith('http')) {
        const imageResponse = await fetch(image);
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
    return image;
}

function getLayoutGuidance(layout?: string, slideType?: string): string {
    const layoutMap: Record<string, string> = {
        'title-hero': 'Large centered title plus supporting line below. Best for cover slides and section breaks. Strong hero composition, spacious margins, visual hook first.',
        'title-left': 'Left-aligned title with supporting content below. Best for straightforward narrative slides. Clean editorial hierarchy, comfortable margins, clear reading flow.',
        'split-screen': 'Half text, half visual. Best for feature highlights or comparisons. Keep the split intentional and balanced, not cluttered.',
        'big-statement': 'Single dominant statement with minimal supporting copy. Best for impact moments or key takeaways. Let scale and whitespace carry the message.',
        'top-title': 'Title anchored across the top with organized content below. Best for structured explanatory slides. Keep the body area disciplined and easy to scan.',
        'quote-callout': 'Featured quote or insight with supporting context. Best for memorable statements with strong attribution feel. Use elevated typography and central focus.',
        'bottom-heavy': 'Large visual area above, text concentrated below. Best when the visual should lead and the explanation should land afterward.',
        'closing': 'Memorable ending slide with a clean, confident closing statement. Best for final takeaway or call-to-action. Avoid generic thank-you energy.',
    };

    if (layout && layoutMap[layout]) return layoutMap[layout];
    if (slideType === 'cover') return layoutMap['title-hero'];
    if (slideType === 'back-cover') return layoutMap['closing'];
    return layoutMap['title-left'];
}
