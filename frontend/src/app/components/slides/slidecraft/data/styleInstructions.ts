import { StyleDimensions, ColorPalette } from "../types";
import { getPresetById } from "./presets";
import { getStyleDefinition } from "./styleDefinitions";

/** Build STYLE_INSTRUCTIONS text block from dimensions, using full preset definition when available */
export function buildStyleInstructions(
  dimensions: StyleDimensions,
  presetId?: string
): string {
  // If a preset is selected, use the full detailed style definition
  if (presetId) {
    const fullDef = getStyleDefinition(presetId);
    if (fullDef) {
      return `<STYLE_INSTRUCTIONS>
${fullDef}

## Core Principles
- Each slide communicates ONE key idea
- Headlines tell the story (narrative, not labels)
- No page numbers, no logos, no footers
- Create visual hierarchy through scale and contrast
- Leave breathing room — don't fill every inch
</STYLE_INSTRUCTIONS>`;
    }
  }

  // Fallback: build from dimension descriptions (for custom combinations)
  const { texture, mood, typography, density } = dimensions;
  const palette = getPaletteForMood(mood);

  return `<STYLE_INSTRUCTIONS>
## Design Aesthetic
${getTextureDescription(texture)} combined with ${getMoodDescription(
    mood
  )} mood.
Typography style: ${getTypographyDescription(typography)}.
Information density: ${getDensityDescription(density)}.

## Background Treatment
${getTextureBackground(texture)}

## Color Palette
- Background: ${palette.background}
- Primary Text: ${palette.primaryText}
- Secondary Text: ${palette.secondaryText}
- Accent 1: ${palette.accent1}
- Accent 2: ${palette.accent2}
${palette.accent3 ? `- Accent 3: ${palette.accent3}` : ""}

## Visual Elements
${getTextureVisualElements(texture)}

## Typography Guidelines
${getTypographyGuidelines(typography)}

## Density Guidelines
${getDensityGuidelines(density)}

## Core Principles
- Each slide communicates ONE key idea
- Headlines tell the story (narrative, not labels)
- No page numbers, no logos, no footers
- Create visual hierarchy through scale and contrast
- Leave breathing room — don't fill every inch
</STYLE_INSTRUCTIONS>`;
}

function getTextureDescription(t: StyleDimensions["texture"]): string {
  const map = {
    clean: "Clean, crisp digital precision with sharp edges and solid colors",
    grid: "Subtle grid overlay with engineering paper feel and technical drawing aesthetic",
    organic:
      "Soft textures with hand-drawn feel, paper grain, and natural variations",
    pixel:
      "Chunky pixel grid with 8-bit aesthetic, aliased edges, retro game UI",
    paper:
      "Aged paper texture with vintage printing artifacts and warm sepia tones",
  };
  return map[t];
}

function getTextureBackground(t: StyleDimensions["texture"]): string {
  const map = {
    clean:
      "Solid color background, no visible texture. Maximum contrast for readability.",
    grid: "Light grid overlay (5-10% opacity). Engineering paper or blueprint feel.",
    organic:
      "Paper grain or canvas texture. Imperfect edges, natural variations.",
    pixel:
      "Visible pixel grid (chunky, not fine). 8-bit color palette aesthetic.",
    paper:
      "Aged paper texture (subtle creases, discoloration). Historical document feel.",
  };
  return map[t];
}

function getTextureVisualElements(t: StyleDimensions["texture"]): string {
  const map = {
    clean:
      "Clean lines, geometric shapes, crisp edges. Digital precision throughout.",
    grid: "Technical schematics, straight or 90-degree connection lines, dimension indicators.",
    organic:
      "Brush strokes, watercolor washes, sketchy lines, natural imperfections.",
    pixel: "Pixel art elements, retro game UI, aliased graphics, chunky icons.",
    paper:
      "Vintage stamps, aged typography, weathered borders, old-world decorations.",
  };
  return map[t];
}

function getMoodDescription(m: StyleDimensions["mood"]): string {
  const map = {
    professional:
      "Cool-neutral business credibility with navy, gold, structured grays",
    warm: "Warm earth tones, oranges, natural colors — welcoming and approachable",
    cool: "Blues, grays, cyan, teal — technical, analytical, and trustworthy",
    vibrant:
      "High saturation, bold colors — energetic, dynamic, attention-grabbing",
    dark: "Deep backgrounds with bright accents — cinematic, atmospheric, dramatic",
    neutral:
      "Minimal color, grayscale focus — maximum sophistication and executive feel",
  };
  return map[m];
}

function getTypographyDescription(t: StyleDimensions["typography"]): string {
  const map = {
    geometric:
      "Clean sans-serif (like Helvetica, Inter). Precise, modern, universal.",
    humanist: "Rounded, friendly sans-serif. Approachable, warm, readable.",
    handwritten:
      "Hand-lettered or script style. Casual, personal, educational.",
    editorial:
      "Magazine/newspaper serif + sans-serif pairing. Sophisticated, dramatic.",
    technical:
      "Monospace or technical sans-serif. Data-forward, code-like precision.",
  };
  return map[t];
}

function getTypographyGuidelines(t: StyleDimensions["typography"]): string {
  const map = {
    geometric:
      "Use clean sans-serif fonts. Titles: bold 36-48pt. Body: regular 18-22pt. Consistent letter-spacing.",
    humanist:
      "Use rounded, warm fonts. Titles: semi-bold 36-44pt. Body: regular 18-20pt. Generous line height.",
    handwritten:
      "Use hand-lettered style. Titles: bold 40-52pt. Body: regular 18-22pt. Allow slight irregularity.",
    editorial:
      "Pair serif headers with sans-serif body. Titles: bold serif 36-48pt. Body: sans-serif 16-20pt.",
    technical:
      "Use monospace or technical fonts. Titles: bold 32-44pt. Body: regular 16-20pt. Dense, code-like feel.",
  };
  return map[t];
}

function getDensityDescription(d: StyleDimensions["density"]): string {
  const map = {
    minimal:
      "Maximum whitespace, 2-3 elements per slide, bold single statements",
    balanced:
      "Moderate content with clear hierarchy, 3-5 elements, structured layout",
    dense:
      "Information-rich, 5-8 elements, data tables, multiple columns, detailed",
  };
  return map[d];
}

function getDensityGuidelines(d: StyleDimensions["density"]): string {
  const map = {
    minimal:
      "Max 2-3 elements per slide. One key stat or statement per page. Generous margins (>15% of slide). Large type, bold statements.",
    balanced:
      "Max 4-5 elements per slide. Clear visual hierarchy. Structured layout with consistent spacing. Mix of text and visual elements.",
    dense:
      "Up to 8 elements allowed. Multi-column layouts encouraged. Smaller body text OK (14-16pt). Data tables and detailed infographics welcome.",
  };
  return map[d];
}

function getPaletteForMood(m: StyleDimensions["mood"]): ColorPalette {
  const palettes: Record<string, ColorPalette> = {
    professional: {
      background: "#FFFFFF",
      primaryText: "#1E3A5F",
      secondaryText: "#4A5568",
      accent1: "#C9A227",
      accent2: "#3D5A80",
    },
    warm: {
      background: "#FAF8F0",
      primaryText: "#2C3E50",
      secondaryText: "#4A4A4A",
      accent1: "#F4A261",
      accent2: "#E9C46A",
      accent3: "#87A96B",
    },
    cool: {
      background: "#FAF8F5",
      primaryText: "#334155",
      secondaryText: "#64748B",
      accent1: "#2563EB",
      accent2: "#1E3A5F",
      accent3: "#BFDBFE",
    },
    vibrant: {
      background: "#FFFFFF",
      primaryText: "#1A1A2E",
      secondaryText: "#4A5568",
      accent1: "#E94560",
      accent2: "#0F3460",
      accent3: "#16C79A",
    },
    dark: {
      background: "#0D1117",
      primaryText: "#E6EDF3",
      secondaryText: "#8B949E",
      accent1: "#58A6FF",
      accent2: "#7EE787",
      accent3: "#FF7B72",
    },
    neutral: {
      background: "#FFFFFF",
      primaryText: "#18181B",
      secondaryText: "#71717A",
      accent1: "#18181B",
      accent2: "#A1A1AA",
    },
  };
  return palettes[m] || palettes.dark;
}

/** Get palette for a preset ID or dimensions */
export function getActivePalette(
  presetId?: string,
  dimensions?: StyleDimensions
): ColorPalette {
  if (presetId) {
    const preset = getPresetById(presetId);
    if (preset) return preset.colorPalette;
  }
  if (dimensions) return getPaletteForMood(dimensions.mood);
  return getPaletteForMood("dark");
}
