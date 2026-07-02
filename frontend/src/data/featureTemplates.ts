export type TemplateCategory = "all" | "portrait" | "product" | "landscape" | "art" | "anime" | "design";

type Translate = (key: string) => string;

export interface Template {
    id: number;
    title: string;
    description: string;
    gradient: string;
    titleKey?: string;
    descriptionKey?: string;
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

function translateWithFallback(t: Translate, key: string | undefined, fallback: string): string {
    if (!key) return fallback;
    const value = t(key);
    return value === key ? fallback : value;
}

export function localizeTemplate(template: Template, t: Translate): Template {
    return {
        ...template,
        title: translateWithFallback(t, template.titleKey, template.title),
        description: translateWithFallback(t, template.descriptionKey, template.description),
    };
}

export function localizeFeature(feature: Feature, t: Translate): Feature {
    return {
        ...feature,
        title: translateWithFallback(t, feature.titleKey, feature.title),
        placeholder: translateWithFallback(t, feature.placeholderKey, feature.placeholder),
        description: feature.description
            ? translateWithFallback(t, feature.descriptionKey, feature.description)
            : undefined,
        templates: feature.templates.map((template) => localizeTemplate(template, t)),
    };
}

export function localizeCategory(category: TemplateCategoryInfo, t: Translate): TemplateCategoryInfo {
    return {
        ...category,
        label: translateWithFallback(t, category.labelKey, category.label),
    };
}

export const imageCategories: TemplateCategoryInfo[] = [
    { id: "all", label: "All", labelKey: "features.categories.all" },
    { id: "portrait", label: "Portrait", labelKey: "features.categories.portrait" },
    { id: "product", label: "Product", labelKey: "features.categories.product" },
    { id: "landscape", label: "Landscape", labelKey: "features.categories.landscape" },
    { id: "art", label: "Art", labelKey: "features.categories.art" },
    { id: "anime", label: "Anime", labelKey: "features.categories.anime" },
    { id: "design", label: "Design", labelKey: "features.categories.design" },
];

export const videoCategories: TemplateCategoryInfo[] = [
    { id: "all", label: "All", labelKey: "features.video_categories.all" },
    { id: "portrait", label: "People", labelKey: "features.video_categories.portrait" },
    { id: "landscape", label: "Scenes", labelKey: "features.video_categories.landscape" },
    { id: "art", label: "Effects", labelKey: "features.video_categories.art" },
    { id: "product", label: "Product", labelKey: "features.video_categories.product" },
    { id: "anime", label: "Anime", labelKey: "features.video_categories.anime" },
    { id: "design", label: "Cinematic", labelKey: "features.video_categories.design" },
];

export const imageTemplates: Template[] = [
    {
        id: 1,
        title: "Movie Poster",
        titleKey: "features.image_templates.movie_poster.title",
        description: "Generate a professional movie poster style image",
        descriptionKey: "features.image_templates.movie_poster.description",
        gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
        category: "design",
    },
    {
        id: 2,
        title: "Product Showcase",
        titleKey: "features.image_templates.product_showcase.title",
        description: "Clean product backgrounds with polished lighting",
        descriptionKey: "features.image_templates.product_showcase.description",
        gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
        category: "product",
    },
    {
        id: 3,
        title: "Natural Landscape",
        titleKey: "features.image_templates.natural_landscape.title",
        description: "Dramatic natural scenery and landscape photos",
        descriptionKey: "features.image_templates.natural_landscape.description",
        gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
        category: "landscape",
    },
    {
        id: 4,
        title: "Abstract Art",
        titleKey: "features.image_templates.abstract_art.title",
        description: "Creative abstract art and geometric patterns",
        descriptionKey: "features.image_templates.abstract_art.description",
        gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
        category: "art",
    },
    {
        id: 5,
        title: "Portrait",
        titleKey: "features.image_templates.portrait.title",
        description: "Professional portraits and profile images",
        descriptionKey: "features.image_templates.portrait.description",
        gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
        category: "portrait",
    },
    {
        id: 6,
        title: "Anime Style",
        titleKey: "features.image_templates.anime_style.title",
        description: "Japanese anime and illustration style",
        descriptionKey: "features.image_templates.anime_style.description",
        gradient: "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
        category: "anime",
    },
    {
        id: 7,
        title: "Architecture",
        titleKey: "features.image_templates.architecture.title",
        description: "Modern architecture and interior design renders",
        descriptionKey: "features.image_templates.architecture.description",
        gradient: "bg-gradient-to-br from-gray-800 via-stone-700 to-neutral-800",
        category: "design",
    },
    {
        id: 8,
        title: "Sci-Fi Scene",
        titleKey: "features.image_templates.scifi_scene.title",
        description: "Future technology and outer-space themes",
        descriptionKey: "features.image_templates.scifi_scene.description",
        gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
        category: "landscape",
    },
    {
        id: 9,
        title: "Vintage",
        titleKey: "features.image_templates.vintage.title",
        description: "Classic retro and film photography style",
        descriptionKey: "features.image_templates.vintage.description",
        gradient: "bg-gradient-to-br from-yellow-900 via-amber-800 to-orange-900",
        category: "art",
    },
    {
        id: 10,
        title: "Watercolor",
        titleKey: "features.image_templates.watercolor.title",
        description: "Soft watercolor art style",
        descriptionKey: "features.image_templates.watercolor.description",
        gradient: "bg-gradient-to-br from-sky-800 via-cyan-700 to-teal-800",
        category: "art",
    },
    {
        id: 11,
        title: "Black and White",
        titleKey: "features.image_templates.black_white.title",
        description: "High-contrast black-and-white art photography",
        descriptionKey: "features.image_templates.black_white.description",
        gradient: "bg-gradient-to-br from-zinc-900 via-neutral-800 to-gray-900",
        category: "portrait",
    },
    {
        id: 12,
        title: "3D Render",
        titleKey: "features.image_templates.render_3d.title",
        description: "Realistic 3D models and scenes",
        descriptionKey: "features.image_templates.render_3d.description",
        gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
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
                descriptionKey: "features.items.web_dev.templates.company_site.description",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 2,
                title: "E-commerce",
                titleKey: "features.items.web_dev.templates.ecommerce.title",
                description: "Product showcase and shopping cart flow",
                descriptionKey: "features.items.web_dev.templates.ecommerce.description",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 3,
                title: "Personal Blog",
                titleKey: "features.items.web_dev.templates.blog.title",
                description: "A clean, elegant blog template",
                descriptionKey: "features.items.web_dev.templates.blog.description",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
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
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
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
                gradient: "bg-gradient-to-br from-fuchsia-900 via-purple-800 to-pink-900",
            },
            {
                id: 6,
                title: "Minimal",
                titleKey: "features.items.slides.templates.minimal.title",
                description: "A clean and spacious presentation template",
                descriptionKey: "features.items.slides.templates.minimal.description",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
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
                descriptionKey: "features.items.resume.templates.professional.description",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
            {
                id: 2,
                title: "Creative Design",
                titleKey: "features.items.resume.templates.creative.title",
                description: "A creative resume for designers",
                descriptionKey: "features.items.resume.templates.creative.description",
                gradient: "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
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
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
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
                descriptionKey: "features.items.prompt_optimize.templates.image.description",
                gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
            },
            {
                id: 2,
                title: "Copywriting",
                titleKey: "features.items.prompt_optimize.templates.copy.title",
                description: "Improve marketing copy prompts",
                descriptionKey: "features.items.prompt_optimize.templates.copy.description",
                gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
            },
            {
                id: 3,
                title: "Code Generation",
                titleKey: "features.items.prompt_optimize.templates.code.title",
                description: "Improve programming-related prompts",
                descriptionKey: "features.items.prompt_optimize.templates.code.description",
                gradient: "bg-gradient-to-br from-cyan-900 via-blue-800 to-indigo-900",
            },
            {
                id: 4,
                title: "Role Play",
                titleKey: "features.items.prompt_optimize.templates.roleplay.title",
                description: "Improve AI persona instructions",
                descriptionKey: "features.items.prompt_optimize.templates.roleplay.description",
                gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-purple-900",
            },
            {
                id: 5,
                title: "Data Analysis",
                titleKey: "features.items.prompt_optimize.templates.data.title",
                description: "Improve data processing prompts",
                descriptionKey: "features.items.prompt_optimize.templates.data.description",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 6,
                title: "General Improve",
                titleKey: "features.items.prompt_optimize.templates.general.title",
                description: "Improve overall prompt quality",
                descriptionKey: "features.items.prompt_optimize.templates.general.description",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
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
                description: "Chart, structure, useful element, and preference analysis",
                descriptionKey: "features.items.fortune.templates.bazi.description",
                gradient: "bg-gradient-to-br from-amber-900 via-yellow-800 to-orange-900",
            },
            {
                id: 2,
                title: "Annual Luck",
                titleKey: "features.items.fortune.templates.annual.title",
                description: "This year's luck and near-term direction",
                descriptionKey: "features.items.fortune.templates.annual.description",
                gradient: "bg-gradient-to-br from-purple-900 via-violet-800 to-indigo-900",
            },
            {
                id: 3,
                title: "Relationship",
                titleKey: "features.items.fortune.templates.relationship.title",
                description: "Romance, marriage, and partner traits",
                descriptionKey: "features.items.fortune.templates.relationship.description",
                gradient: "bg-gradient-to-br from-rose-900 via-pink-800 to-red-900",
            },
            {
                id: 4,
                title: "Career",
                titleKey: "features.items.fortune.templates.career.title",
                description: "Career direction, promotion, and suitable industries",
                descriptionKey: "features.items.fortune.templates.career.description",
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 5,
                title: "Wealth",
                titleKey: "features.items.fortune.templates.wealth.title",
                description: "Income, investment, and money guidance",
                descriptionKey: "features.items.fortune.templates.wealth.description",
                gradient: "bg-gradient-to-br from-yellow-900 via-amber-800 to-orange-900",
            },
            {
                id: 6,
                title: "Health",
                titleKey: "features.items.fortune.templates.health.title",
                description: "Health cautions and wellness suggestions",
                descriptionKey: "features.items.fortune.templates.health.description",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 7,
                title: "Personality",
                titleKey: "features.items.fortune.templates.personality.title",
                description: "Personality traits and natural strengths",
                descriptionKey: "features.items.fortune.templates.personality.description",
                gradient: "bg-gradient-to-br from-sky-900 via-blue-800 to-cyan-900",
            },
            {
                id: 8,
                title: "Family",
                titleKey: "features.items.fortune.templates.family.title",
                description: "Family bonds and child-related luck",
                descriptionKey: "features.items.fortune.templates.family.description",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
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
                gradient: "bg-gradient-to-br from-blue-900 via-indigo-800 to-violet-900",
            },
            {
                id: 2,
                title: "Business Copy",
                titleKey: "features.items.deai.templates.business.title",
                description: "Make marketing copy sound more natural",
                descriptionKey: "features.items.deai.templates.business.description",
                gradient: "bg-gradient-to-br from-emerald-900 via-teal-800 to-cyan-900",
            },
            {
                id: 3,
                title: "News Article",
                titleKey: "features.items.deai.templates.news.title",
                description: "Convert text into a newsroom style",
                descriptionKey: "features.items.deai.templates.news.description",
                gradient: "bg-gradient-to-br from-slate-800 via-zinc-700 to-neutral-800",
            },
            {
                id: 4,
                title: "Social Post",
                titleKey: "features.items.deai.templates.social.title",
                description: "Make posts sound more human-written",
                descriptionKey: "features.items.deai.templates.social.description",
                gradient: "bg-gradient-to-br from-pink-800 via-fuchsia-700 to-purple-800",
            },
            {
                id: 5,
                title: "Email",
                titleKey: "features.items.deai.templates.email.title",
                description: "Humanize business email conversations",
                descriptionKey: "features.items.deai.templates.email.description",
                gradient: "bg-gradient-to-br from-amber-900 via-orange-800 to-red-900",
            },
            {
                id: 6,
                title: "Creative Writing",
                titleKey: "features.items.deai.templates.creative.title",
                description: "Polish literary writing style",
                descriptionKey: "features.items.deai.templates.creative.description",
                gradient: "bg-gradient-to-br from-violet-900 via-purple-800 to-indigo-900",
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
