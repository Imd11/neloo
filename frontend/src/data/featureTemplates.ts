export type TemplateCategory =
  | "all"
  | "portrait"
  | "product"
  | "landscape"
  | "art"
  | "anime"
  | "design"
  | "city"
  | "infographic";

type Translate = (key: string) => string;

export interface Template {
  id: number;
  title: string;
  description: string;
  gradient: string;
  prompt?: string;
  previewImage?: string;
  titleKey?: string;
  descriptionKey?: string;
  effectKey?: string;
  exampleInputKey?: string;
  exampleOutputKey?: string;
  userFacingEffect?: string;
  exampleInput?: string;
  exampleOutput?: string;
  /**
   * Backend-facing instruction. Keep this stable and English.
   * Do not localize it through UI locale files.
   */
  promptInstruction?: string;
  model?: string;
  category?: TemplateCategory;
}

export interface Feature {
  id: string;
  title: string;
  titleKey?: string;
  icon: string;
  placeholder: string;
  placeholderKey?: string;
  templates: Template[];
  description?: string;
  descriptionKey?: string;
}

export interface TemplateCategoryInfo {
  id: TemplateCategory;
  label: string;
  labelKey: string;
}

function translateWithFallback(
  t: Translate,
  key: string | undefined,
  fallback: string
): string {
  if (!key) return fallback;
  const value = t(key);
  return value === key ? fallback : value;
}

export function localizeTemplate(template: Template, t: Translate): Template {
  return {
    ...template,
    title: translateWithFallback(t, template.titleKey, template.title),
    description: translateWithFallback(
      t,
      template.descriptionKey,
      template.description
    ),
    userFacingEffect: template.userFacingEffect
      ? translateWithFallback(t, template.effectKey, template.userFacingEffect)
      : undefined,
    exampleInput: template.exampleInput
      ? translateWithFallback(
          t,
          template.exampleInputKey,
          template.exampleInput
        )
      : undefined,
    exampleOutput: template.exampleOutput
      ? translateWithFallback(
          t,
          template.exampleOutputKey,
          template.exampleOutput
        )
      : undefined,
    promptInstruction: template.promptInstruction,
  };
}

export function localizeFeature(feature: Feature, t: Translate): Feature {
  return {
    ...feature,
    title: translateWithFallback(t, feature.titleKey, feature.title),
    placeholder: translateWithFallback(
      t,
      feature.placeholderKey,
      feature.placeholder
    ),
    description: feature.description
      ? translateWithFallback(t, feature.descriptionKey, feature.description)
      : undefined,
    templates: feature.templates.map((template) =>
      localizeTemplate(template, t)
    ),
  };
}

export function localizeCategory(
  category: TemplateCategoryInfo,
  t: Translate
): TemplateCategoryInfo {
  return {
    ...category,
    label: translateWithFallback(t, category.labelKey, category.label),
  };
}

export const imageCategories: TemplateCategoryInfo[] = [
  { id: "all", label: "All", labelKey: "features.categories.all" },
  { id: "product", label: "Product", labelKey: "features.categories.product" },
  { id: "city", label: "City", labelKey: "features.categories.city" },
  { id: "design", label: "Design", labelKey: "features.categories.design" },
];

export const videoCategories: TemplateCategoryInfo[] = [
  { id: "all", label: "All", labelKey: "features.video_categories.all" },
  {
    id: "portrait",
    label: "People",
    labelKey: "features.video_categories.portrait",
  },
  {
    id: "landscape",
    label: "Scenes",
    labelKey: "features.video_categories.landscape",
  },
  { id: "art", label: "Effects", labelKey: "features.video_categories.art" },
  {
    id: "product",
    label: "Product",
    labelKey: "features.video_categories.product",
  },
  { id: "anime", label: "Anime", labelKey: "features.video_categories.anime" },
  {
    id: "design",
    label: "Cinematic",
    labelKey: "features.video_categories.design",
  },
];

export const imageTemplates: Template[] = [
  {
    id: 1,
    title: "Giant Landmark Object",
    titleKey: "features.image_templates.giant_landmark.title",
    description: "Turn an everyday object into a massive real-world monument",
    descriptionKey: "features.image_templates.giant_landmark.description",
    gradient: "bg-gradient-to-br from-zinc-900 via-stone-800 to-yellow-800",
    previewImage: "/templates/image/giant-landmark-object.png",
    prompt: `Transform [EVERYDAY OBJECT] into a massive real-world monument. Surface materials are physically accurate, with visible wear, scratches, dust, and scale references like people and vehicles. Shot from a low-angle cinematic perspective, realistic daylight, ultra-detailed textures.`,
    category: "city",
  },
  {
    id: 2,
    title: "Product Macro Showcase",
    titleKey: "features.image_templates.product_macro.title",
    description: "Hyper-real product shot with floating splash details",
    descriptionKey: "features.image_templates.product_macro.description",
    gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
    previewImage: "/templates/image/product-macro-showcase.png",
    prompt: `Create a hyper-realistic macro product photograph of [PRODUCT]. The product is tilted in the center, with splashes and small dynamic elements floating around it. Use a black background to highlight texture and details. Add dramatic backlighting, crisp reflections, sharp focus, high resolution, and an ultra-clean commercial photography style.`,
    category: "product",
  },
  {
    id: 3,
    title: "Ultra-real City Poster",
    titleKey: "features.image_templates.city_promo.title",
    description: "Floating miniature city island for travel and city branding",
    descriptionKey: "features.image_templates.city_promo.description",
    gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
    previewImage: "/templates/image/city-promo-island.png",
    prompt: `Create an ultra-HD, hyper-realistic digital poster of a floating miniature island shaped like [CITY], resting on white clouds in the sky. Blend iconic landmarks, natural landscapes, and cultural elements unique to [COUNTRY]. Carve "[COUNTRY]" into the terrain using large white 3D letters. Add native birds, cinematic lighting, vivid colors, aerial perspective, sun reflections, and polished 4K travel-poster realism. Square 1080x1080 composition.`,
    category: "city",
  },
  {
    id: 4,
    title: "Sports Graphic Poster",
    titleKey: "features.image_templates.sports_poster.title",
    description: "Editorial mixed-media poster for athletes and public figures",
    descriptionKey: "features.image_templates.sports_poster.description",
    gradient: "bg-gradient-to-br from-neutral-900 via-zinc-700 to-slate-500",
    previewImage: "/templates/image/sports-poster-grid.png",
    prompt: `[PERSON NAME].
Act as a high-end sports graphic designer creating a conceptual tribute poster. The style is a complex "dual exposure photo-grid composite" with mixed-media textures.
CENTRAL STRUCTURE (THE VESSEL):
The central focus is a large-scale, high-contrast black and white portrait silhouette of [PERSON NAME]. This main portrait acts as the container.
THE GRID FILL & TEXTURES (MIXED MEDIA):
The interior of the silhouette is populated by a dense "photo mosaic grid" of action shots from the person's career.
CRITICAL TEXTURE INSTRUCTION: Do not just paste flat photos. Apply artistic textures to various grid cells to create a tactile, collage feel. Use effects like halftone dots, subtle fabric or embroidery texture, and film grain on selected high-contrast action shots.
COLOR STRATEGY:
The base is monochrome black and white. Use selective color overlays relevant to the team, brand, or flag only on specific grid cells to create rhythm.
TYPOGRAPHY & BRANDING:
Top left: write "[PERSON NAME]" in a small, discreet Inter Semibold style. It must occupy maximum 20% of the canvas width. Top right: place a small primary logo, team mark, brand symbol, or flag occupying maximum 10% of the canvas width.
COMPOSITION & BACKGROUND:
Use an off-white or light grey background with high-quality paper or concrete texture. Center the figure perfectly and keep wide negative space around the subject.`,
    category: "design",
  },
];

export const videoTemplates: Template[] = [
  {
    id: 1,
    title: "Talking Portrait",
    titleKey: "features.video_templates.talking_portrait.title",
    description: "Animate a static person with lip sync",
    descriptionKey: "features.video_templates.talking_portrait.description",
    gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
    model: "Kling",
    category: "portrait",
  },
  {
    id: 2,
    title: "Dance Motion",
    titleKey: "features.video_templates.dance_motion.title",
    description: "Generate smooth character dance videos",
    descriptionKey: "features.video_templates.dance_motion.description",
    gradient: "bg-gradient-to-br from-fuchsia-900 via-purple-800 to-pink-900",
    model: "Pika",
    category: "portrait",
  },
  {
    id: 3,
    title: "Landscape Timelapse",
    titleKey: "features.video_templates.landscape_timelapse.title",
    description: "Clouds, sunrise, and sunset timelapse footage",
    descriptionKey: "features.video_templates.landscape_timelapse.description",
    gradient: "bg-gradient-to-br from-sky-900 via-blue-800 to-cyan-900",
    model: "Runway Gen-3",
    category: "landscape",
  },
  {
    id: 4,
    title: "Water Animation",
    titleKey: "features.video_templates.water_animation.title",
    description: "Dynamic rivers, waterfalls, waves, and other water scenes",
    descriptionKey: "features.video_templates.water_animation.description",
    gradient: "bg-gradient-to-br from-cyan-900 via-teal-800 to-emerald-900",
    model: "Sora",
    category: "landscape",
  },
  {
    id: 5,
    title: "Morph Transition",
    titleKey: "features.video_templates.morph_transition.title",
    description: "Smooth morphing transitions between objects",
    descriptionKey: "features.video_templates.morph_transition.description",
    gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
    model: "Runway Gen-3",
    category: "art",
  },
  {
    id: 6,
    title: "Particle Effects",
    titleKey: "features.video_templates.particle_effects.title",
    description: "Smoke, fire, stardust, and particle effects",
    descriptionKey: "features.video_templates.particle_effects.description",
    gradient: "bg-gradient-to-br from-orange-900 via-amber-800 to-yellow-900",
    model: "Kling",
    category: "art",
  },
  {
    id: 7,
    title: "Product 360",
    titleKey: "features.video_templates.product_360.title",
    description: "360-degree product rotation animation",
    descriptionKey: "features.video_templates.product_360.description",
    gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
    model: "Pika",
    category: "product",
  },
  {
    id: 8,
    title: "Unboxing",
    titleKey: "features.video_templates.unboxing.title",
    description: "Product unboxing and showcase motion",
    descriptionKey: "features.video_templates.unboxing.description",
    gradient: "bg-gradient-to-br from-emerald-900 via-green-800 to-teal-900",
    model: "Minimax",
    category: "product",
  },
  {
    id: 9,
    title: "Anime Character",
    titleKey: "features.video_templates.anime_character.title",
    description: "Generate motion for two-dimensional characters",
    descriptionKey: "features.video_templates.anime_character.description",
    gradient: "bg-gradient-to-br from-pink-800 via-rose-700 to-red-800",
    model: "AnimateDiff",
    category: "anime",
  },
  {
    id: 10,
    title: "Comic Panels",
    titleKey: "features.video_templates.comic_panels.title",
    description: "Turn static comic panels into animated shots",
    descriptionKey: "features.video_templates.comic_panels.description",
    gradient: "bg-gradient-to-br from-indigo-900 via-blue-800 to-purple-900",
    model: "Kling",
    category: "anime",
  },
  {
    id: 11,
    title: "Cinematic Shot",
    titleKey: "features.video_templates.cinematic_shot.title",
    description: "Professional cinematic camera motion and visuals",
    descriptionKey: "features.video_templates.cinematic_shot.description",
    gradient: "bg-gradient-to-br from-gray-900 via-neutral-800 to-zinc-900",
    model: "Sora",
    category: "design",
  },
  {
    id: 12,
    title: "Slow Motion",
    titleKey: "features.video_templates.slow_motion.title",
    description: "Smooth high-frame-rate slow-motion effects",
    descriptionKey: "features.video_templates.slow_motion.description",
    gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
    model: "Runway Gen-3",
    category: "design",
  },
];

export const features: Feature[] = [
  {
    id: "web-dev",
    title: "Web Dev",
    titleKey: "features.items.web_dev.title",
    icon: "Globe",
    placeholder: "Describe the web page you want to build...",
    placeholderKey: "features.items.web_dev.placeholder",
    templates: [
      {
        id: 1,
        title: "Company Website",
        titleKey: "features.items.web_dev.templates.company_site.title",
        description: "A professional corporate presence website",
        descriptionKey:
          "features.items.web_dev.templates.company_site.description",
        gradient:
          "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
      },
      {
        id: 2,
        title: "E-commerce",
        titleKey: "features.items.web_dev.templates.ecommerce.title",
        description: "Product showcase and shopping cart flow",
        descriptionKey:
          "features.items.web_dev.templates.ecommerce.description",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
      },
      {
        id: 3,
        title: "Personal Blog",
        titleKey: "features.items.web_dev.templates.blog.title",
        description: "A clean, elegant blog template",
        descriptionKey: "features.items.web_dev.templates.blog.description",
        gradient:
          "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
      },
      {
        id: 4,
        title: "Landing Page",
        titleKey: "features.items.web_dev.templates.landing.title",
        description: "A high-converting marketing landing page",
        descriptionKey: "features.items.web_dev.templates.landing.description",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
      },
      {
        id: 5,
        title: "Admin Dashboard",
        titleKey: "features.items.web_dev.templates.admin.title",
        description: "A data dashboard and management system",
        descriptionKey: "features.items.web_dev.templates.admin.description",
        gradient: "bg-gradient-to-br from-gray-900 via-neutral-800 to-zinc-900",
      },
      {
        id: 6,
        title: "SaaS Product",
        titleKey: "features.items.web_dev.templates.saas.title",
        description: "A software-as-a-service product interface",
        descriptionKey: "features.items.web_dev.templates.saas.description",
        gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
      },
    ],
  },
  {
    id: "image",
    title: "AI Image",
    titleKey: "features.items.image.title",
    icon: "Image",
    placeholder: "Describe the image you want to generate...",
    placeholderKey: "features.items.image.placeholder",
    templates: imageTemplates,
    description: "Generate images with AI and edit them on the canvas",
    descriptionKey: "features.items.image.description",
  },
  {
    id: "slides",
    title: "Slides",
    titleKey: "features.items.slides.title",
    icon: "Presentation",
    placeholder: "Describe the topic of your presentation...",
    placeholderKey: "features.items.slides.placeholder",
    templates: [
      {
        id: 1,
        title: "Business Proposal",
        titleKey: "features.items.slides.templates.business.title",
        description: "A professional business plan deck",
        descriptionKey: "features.items.slides.templates.business.description",
        gradient:
          "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
      },
      {
        id: 2,
        title: "Product Launch",
        titleKey: "features.items.slides.templates.product.title",
        description: "A presentation for launching a new product",
        descriptionKey: "features.items.slides.templates.product.description",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
      },
      {
        id: 3,
        title: "Education",
        titleKey: "features.items.slides.templates.education.title",
        description: "Course and training presentation materials",
        descriptionKey: "features.items.slides.templates.education.description",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
      },
      {
        id: 4,
        title: "Annual Report",
        titleKey: "features.items.slides.templates.report.title",
        description: "A company annual summary report",
        descriptionKey: "features.items.slides.templates.report.description",
        gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
      },
      {
        id: 5,
        title: "Creative Showcase",
        titleKey: "features.items.slides.templates.creative.title",
        description: "A visually striking creative presentation",
        descriptionKey: "features.items.slides.templates.creative.description",
        gradient:
          "bg-gradient-to-br from-fuchsia-900 via-purple-800 to-pink-900",
      },
      {
        id: 6,
        title: "Minimal",
        titleKey: "features.items.slides.templates.minimal.title",
        description: "A clean and spacious presentation template",
        descriptionKey: "features.items.slides.templates.minimal.description",
        gradient:
          "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
      },
    ],
  },
  {
    id: "resume",
    title: "Resume",
    titleKey: "features.items.resume.title",
    icon: "FileUser",
    placeholder: "Upload a resume with +, or describe what you need",
    placeholderKey: "features.items.resume.placeholder",
    templates: [
      {
        id: 1,
        title: "Professional Minimal",
        titleKey: "features.items.resume.templates.professional.title",
        description: "A classic template for professionals",
        descriptionKey:
          "features.items.resume.templates.professional.description",
        gradient:
          "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
      },
      {
        id: 2,
        title: "Creative Design",
        titleKey: "features.items.resume.templates.creative.title",
        description: "A creative resume for designers",
        descriptionKey: "features.items.resume.templates.creative.description",
        gradient:
          "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
      },
      {
        id: 3,
        title: "Technical",
        titleKey: "features.items.resume.templates.technical.title",
        description: "Built for programmers and engineers",
        descriptionKey: "features.items.resume.templates.technical.description",
        gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
      },
      {
        id: 4,
        title: "Business Executive",
        titleKey: "features.items.resume.templates.executive.title",
        description: "A template for executives and business roles",
        descriptionKey: "features.items.resume.templates.executive.description",
        gradient:
          "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
      },
      {
        id: 5,
        title: "Academic",
        titleKey: "features.items.resume.templates.academic.title",
        description: "A resume for researchers and scholars",
        descriptionKey: "features.items.resume.templates.academic.description",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
      },
      {
        id: 6,
        title: "Graduate",
        titleKey: "features.items.resume.templates.graduate.title",
        description: "A fresh template for recent graduates",
        descriptionKey: "features.items.resume.templates.graduate.description",
        gradient: "bg-gradient-to-br from-sky-800 via-cyan-700 to-teal-800",
      },
    ],
  },
  {
    id: "prompt-optimize",
    title: "Prompt Optimize",
    titleKey: "features.items.prompt_optimize.title",
    icon: "Sparkles",
    placeholder: "Enter the prompt you want to improve...",
    placeholderKey: "features.items.prompt_optimize.placeholder",
    templates: [
      {
        id: 1,
        title: "Image Generation",
        titleKey: "features.items.prompt_optimize.templates.image.title",
        description: "Improve prompts for AI drawing",
        descriptionKey:
          "features.items.prompt_optimize.templates.image.description",
        userFacingEffect:
          "Turns rough image ideas into detailed prompts with subject, composition, lighting, style, camera, aspect ratio, and constraints.",
        effectKey: "features.items.prompt_optimize.templates.image.effect",
        promptInstruction:
          "Optimize the user's prompt specifically for image generation. Include subject, scene, style, camera angle, composition, lighting, color palette, texture, aspect ratio, and constraints. Return only the improved prompt.",
        previewImage: "/templates/prompt-optimize/image-generation.webp",
        gradient:
          "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
      },
      {
        id: 2,
        title: "Copywriting",
        titleKey: "features.items.prompt_optimize.templates.copy.title",
        description: "Improve marketing copy prompts",
        descriptionKey:
          "features.items.prompt_optimize.templates.copy.description",
        userFacingEffect:
          "Turns a vague copy request into a clear brief with audience, offer, tone, proof points, objections, and output format.",
        effectKey: "features.items.prompt_optimize.templates.copy.effect",
        promptInstruction:
          "Optimize the user's prompt for copywriting. Clarify audience, offer, channel, tone, proof points, objections, constraints, and output format. Return only the improved prompt.",
        previewImage: "/templates/prompt-optimize/copywriting.webp",
        gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
      },
      {
        id: 3,
        title: "Code Generation",
        titleKey: "features.items.prompt_optimize.templates.code.title",
        description: "Improve programming-related prompts",
        descriptionKey:
          "features.items.prompt_optimize.templates.code.description",
        userFacingEffect:
          "Turns programming requests into implementation-ready prompts with context, constraints, edge cases, files, and verification steps.",
        effectKey: "features.items.prompt_optimize.templates.code.effect",
        promptInstruction:
          "Optimize the user's prompt for code generation. Include relevant context, target behavior, constraints, edge cases, file or API boundaries, and verification criteria. Return only the improved prompt.",
        previewImage: "/templates/prompt-optimize/code-generation.webp",
        gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
      },
      {
        id: 4,
        title: "Role Play",
        titleKey: "features.items.prompt_optimize.templates.roleplay.title",
        description: "Improve AI persona instructions",
        descriptionKey:
          "features.items.prompt_optimize.templates.roleplay.description",
        userFacingEffect:
          "Turns persona ideas into reliable role instructions with scope, behavior rules, boundaries, and response style.",
        effectKey: "features.items.prompt_optimize.templates.roleplay.effect",
        promptInstruction:
          "Optimize the user's prompt for role play or AI persona design. Define role, objective, expertise, behavior rules, boundaries, tone, interaction pattern, and output constraints. Return only the improved prompt.",
        previewImage: "/templates/prompt-optimize/role-play.webp",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
      },
      {
        id: 5,
        title: "Data Analysis",
        titleKey: "features.items.prompt_optimize.templates.data.title",
        description: "Improve data processing prompts",
        descriptionKey:
          "features.items.prompt_optimize.templates.data.description",
        userFacingEffect:
          "Turns analysis ideas into structured prompts with data context, assumptions, methods, outputs, and quality checks.",
        effectKey: "features.items.prompt_optimize.templates.data.effect",
        promptInstruction:
          "Optimize the user's prompt for data analysis. Clarify dataset context, analysis goal, assumptions, methods, metrics, expected tables or charts, and validation checks. Return only the improved prompt.",
        previewImage: "/templates/prompt-optimize/data-analysis.webp",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
      },
      {
        id: 6,
        title: "General Improve",
        titleKey: "features.items.prompt_optimize.templates.general.title",
        description: "Improve overall prompt quality",
        descriptionKey:
          "features.items.prompt_optimize.templates.general.description",
        userFacingEffect:
          "Turns a rough instruction into a clearer prompt with role, task, context, constraints, and output format.",
        effectKey: "features.items.prompt_optimize.templates.general.effect",
        promptInstruction:
          "Optimize the user's prompt for general-purpose AI use. Preserve intent, add useful structure, clarify context and constraints, and define a practical output format. Return only the improved prompt.",
        previewImage: "/templates/prompt-optimize/general-improve.webp",
        gradient:
          "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
      },
    ],
  },
  {
    id: "fortune",
    title: "Fortune Telling",
    titleKey: "features.items.fortune.title",
    icon: "Moon",
    placeholder: "Enter your birth date and time...",
    placeholderKey: "features.items.fortune.placeholder",
    templates: [
      {
        id: 1,
        title: "Full Bazi Reading",
        titleKey: "features.items.fortune.templates.bazi.title",
        description:
          "Chart, structure, useful element, and preference analysis",
        descriptionKey: "features.items.fortune.templates.bazi.description",
        userFacingEffect:
          "Gives a broad BaZi reading across chart structure, useful elements, ten gods, major luck cycles, and overall direction.",
        effectKey: "features.items.fortune.templates.bazi.effect",
        previewImage: "/templates/fortune/full-bazi-reading.webp",
        gradient:
          "bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900",
      },
      {
        id: 2,
        title: "Annual Luck",
        titleKey: "features.items.fortune.templates.annual.title",
        description: "This year's luck and near-term direction",
        descriptionKey: "features.items.fortune.templates.annual.description",
        userFacingEffect:
          "Focuses the reading on this year's flow, key months, near-term opportunities, and periods that need caution.",
        effectKey: "features.items.fortune.templates.annual.effect",
        previewImage: "/templates/fortune/annual-luck.webp",
        gradient:
          "bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900",
      },
      {
        id: 3,
        title: "Relationship",
        titleKey: "features.items.fortune.templates.relationship.title",
        description: "Romance, marriage, and partner traits",
        descriptionKey:
          "features.items.fortune.templates.relationship.description",
        userFacingEffect:
          "Focuses the reading on romance timing, marriage tendencies, partner traits, and relationship risks.",
        effectKey: "features.items.fortune.templates.relationship.effect",
        previewImage: "/templates/fortune/relationship.webp",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
      },
      {
        id: 4,
        title: "Career",
        titleKey: "features.items.fortune.templates.career.title",
        description: "Career direction, promotion, and suitable industries",
        descriptionKey: "features.items.fortune.templates.career.description",
        userFacingEffect:
          "Focuses the reading on career direction, suitable industries, promotion timing, and workplace risks.",
        effectKey: "features.items.fortune.templates.career.effect",
        previewImage: "/templates/fortune/career.webp",
        gradient:
          "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
      },
      {
        id: 5,
        title: "Wealth",
        titleKey: "features.items.fortune.templates.wealth.title",
        description: "Income, investment, and money guidance",
        descriptionKey: "features.items.fortune.templates.wealth.description",
        userFacingEffect:
          "Focuses the reading on income, windfall tendencies, investment caution, money timing, and wealth retention.",
        effectKey: "features.items.fortune.templates.wealth.effect",
        previewImage: "/templates/fortune/wealth.webp",
        gradient:
          "bg-gradient-to-br from-yellow-900 via-amber-800 to-orange-900",
      },
      {
        id: 6,
        title: "Health",
        titleKey: "features.items.fortune.templates.health.title",
        description: "Health cautions and wellness suggestions",
        descriptionKey: "features.items.fortune.templates.health.description",
        userFacingEffect:
          "Focuses the reading on elemental balance, health cautions, wellness direction, and years that need extra care.",
        effectKey: "features.items.fortune.templates.health.effect",
        previewImage: "/templates/fortune/health.webp",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
      },
      {
        id: 7,
        title: "Personality",
        titleKey: "features.items.fortune.templates.personality.title",
        description: "Personality traits and natural strengths",
        descriptionKey:
          "features.items.fortune.templates.personality.description",
        userFacingEffect:
          "Focuses the reading on personality traits, natural strengths, blind spots, talents, and interpersonal patterns.",
        effectKey: "features.items.fortune.templates.personality.effect",
        previewImage: "/templates/fortune/personality.webp",
        gradient: "bg-gradient-to-br from-sky-900 via-blue-800 to-cyan-900",
      },
      {
        id: 8,
        title: "Family",
        titleKey: "features.items.fortune.templates.family.title",
        description: "Family bonds and child-related luck",
        descriptionKey: "features.items.fortune.templates.family.description",
        userFacingEffect:
          "Focuses the reading on family relationships, parent and sibling affinity, child-related luck, and household harmony.",
        effectKey: "features.items.fortune.templates.family.effect",
        previewImage: "/templates/fortune/family.webp",
        gradient:
          "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
      },
    ],
  },
  {
    id: "deai",
    title: "Humanize",
    titleKey: "features.items.deai.title",
    icon: "Eraser",
    placeholder: "Paste text that should sound less AI-generated...",
    placeholderKey: "features.items.deai.placeholder",
    templates: [
      {
        id: 1,
        title: "Academic Paper",
        titleKey: "features.items.deai.templates.academic.title",
        description: "Reduce repetition and make academic writing more natural",
        descriptionKey: "features.items.deai.templates.academic.description",
        userFacingEffect:
          "Makes academic writing more natural while preserving rigor, terminology, citations, and logical structure.",
        effectKey: "features.items.deai.templates.academic.effect",
        promptInstruction:
          "Rewrite the user's text for academic writing. Preserve rigor, terminology, citations, and logical structure. Reduce mechanical repetition and inflated phrasing while keeping the final text clear and grounded.",
        previewImage: "/templates/humanize/academic-paper.webp",
        gradient:
          "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
      },
      {
        id: 2,
        title: "Business Copy",
        titleKey: "features.items.deai.templates.business.title",
        description: "Make marketing copy sound more natural",
        descriptionKey: "features.items.deai.templates.business.description",
        userFacingEffect:
          "Makes business copy sound more credible, direct, and specific without hype or generic marketing language.",
        effectKey: "features.items.deai.templates.business.effect",
        promptInstruction:
          "Rewrite the user's text as business copy. Keep it credible, specific, and direct. Remove hype, generic marketing claims, and artificial friendliness while preserving the core message.",
        previewImage: "/templates/humanize/business-copy.webp",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
      },
      {
        id: 3,
        title: "News Article",
        titleKey: "features.items.deai.templates.news.title",
        description: "Convert text into a newsroom style",
        descriptionKey: "features.items.deai.templates.news.description",
        userFacingEffect:
          "Makes article-style writing more factual, concise, and editorial while avoiding robotic phrasing.",
        effectKey: "features.items.deai.templates.news.effect",
        promptInstruction:
          "Rewrite the user's text in a newsroom style. Keep it factual, concise, and editorial. Avoid opinionated hype, vague transitions, and AI-sounding filler.",
        previewImage: "/templates/humanize/news-article.webp",
        gradient:
          "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
      },
      {
        id: 4,
        title: "Social Post",
        titleKey: "features.items.deai.templates.social.title",
        description: "Make posts sound more human-written",
        descriptionKey: "features.items.deai.templates.social.description",
        userFacingEffect:
          "Makes social posts feel conversational, clear, and natural while keeping the user's point intact.",
        effectKey: "features.items.deai.templates.social.effect",
        promptInstruction:
          "Rewrite the user's text as a natural social post. Keep it conversational and easy to read. Preserve the user's point, remove generic AI phrasing, and avoid forced enthusiasm.",
        previewImage: "/templates/humanize/social-post.webp",
        gradient:
          "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
      },
      {
        id: 5,
        title: "Email",
        titleKey: "features.items.deai.templates.email.title",
        description: "Humanize business email conversations",
        descriptionKey: "features.items.deai.templates.email.description",
        userFacingEffect:
          "Makes emails clearer, warmer, and more respectful without sounding overly formal or robotic.",
        effectKey: "features.items.deai.templates.email.effect",
        promptInstruction:
          "Rewrite the user's text as an email. Keep it clear, respectful, and natural. Avoid stiff corporate phrasing, over-apologies, and unnecessary filler.",
        previewImage: "/templates/humanize/email.webp",
        gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
      },
      {
        id: 6,
        title: "Creative Writing",
        titleKey: "features.items.deai.templates.creative.title",
        description: "Polish literary writing style",
        descriptionKey: "features.items.deai.templates.creative.description",
        userFacingEffect:
          "Makes creative writing more vivid and human while preserving voice, rhythm, and emotional intent.",
        effectKey: "features.items.deai.templates.creative.effect",
        promptInstruction:
          "Rewrite the user's text as creative writing. Preserve voice, rhythm, and emotional intent. Improve natural flow and imagery without making the prose overwritten or generic.",
        previewImage: "/templates/humanize/creative-writing.webp",
        gradient:
          "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
      },
    ],
  },
  {
    id: "translate",
    title: "AI Translate",
    titleKey: "features.items.translate.title",
    icon: "Languages",
    placeholder: "Enter text to translate...",
    placeholderKey: "features.items.translate.placeholder",
    templates: [],
    description: "Professional AI translation across multiple languages",
    descriptionKey: "features.items.translate.description",
  },
];
