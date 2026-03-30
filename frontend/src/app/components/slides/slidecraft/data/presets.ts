import { StylePreset } from '../types';

export const PRESETS: StylePreset[] = [
    {
        id: 'blueprint',
        name: 'Blueprint',
        nameZh: '蓝图',
        description: 'Engineering precision, analytical clarity',
        feel: '工程精确、分析清晰',
        dimensions: { texture: 'grid', mood: 'cool', typography: 'technical', density: 'balanced' },
        autoSelectTriggers: ['architecture', 'system', 'data', 'analysis', 'technical', '架构', '系统', '数据', '分析', '技术'],
        colorPalette: { background: '#FAF8F5', primaryText: '#334155', secondaryText: '#64748B', accent1: '#2563EB', accent2: '#1E3A5F' }
    },
    {
        id: 'chalkboard',
        name: 'Chalkboard',
        nameZh: '黑板',
        description: 'Classroom warmth, educational',
        feel: '课堂温暖、教育性',
        dimensions: { texture: 'organic', mood: 'warm', typography: 'handwritten', density: 'balanced' },
        autoSelectTriggers: ['classroom', 'teaching', 'school', 'chalkboard', '教学', '课堂', '学校'],
        colorPalette: { background: '#2C3E50', primaryText: '#ECF0F1', secondaryText: '#BDC3C7', accent1: '#F4A261', accent2: '#E9C46A' }
    },
    {
        id: 'corporate',
        name: 'Corporate',
        nameZh: '商务',
        description: 'Business credibility, institutional trust',
        feel: '商业可信、机构感',
        dimensions: { texture: 'clean', mood: 'professional', typography: 'geometric', density: 'balanced' },
        autoSelectTriggers: ['investor', 'quarterly', 'business', 'corporate', '投资', '商务', '季度', '融资'],
        colorPalette: { background: '#FFFFFF', primaryText: '#1E3A5F', secondaryText: '#4A5568', accent1: '#C9A227', accent2: '#3D5A80' }
    },
    {
        id: 'minimal',
        name: 'Minimal',
        nameZh: '极简',
        description: 'Maximum sophistication, executive focus',
        feel: '极致简约、高管聚焦',
        dimensions: { texture: 'clean', mood: 'neutral', typography: 'geometric', density: 'minimal' },
        autoSelectTriggers: ['executive', 'minimal', 'clean', 'simple', '极简', '高端', '简约'],
        colorPalette: { background: '#FFFFFF', primaryText: '#18181B', secondaryText: '#71717A', accent1: '#18181B', accent2: '#A1A1AA' }
    },
    {
        id: 'sketch-notes',
        name: 'Sketch Notes',
        nameZh: '手绘笔记',
        description: 'Friendly learning, approachable education',
        feel: '友好学习、平易近人',
        dimensions: { texture: 'organic', mood: 'warm', typography: 'handwritten', density: 'balanced' },
        autoSelectTriggers: ['tutorial', 'learn', 'education', 'guide', 'beginner', '教程', '学习', '入门'],
        colorPalette: { background: '#FAF8F0', primaryText: '#2C3E50', secondaryText: '#4A4A4A', accent1: '#F4A261', accent2: '#E9C46A', accent3: '#87A96B' }
    },
    {
        id: 'watercolor',
        name: 'Watercolor',
        nameZh: '水彩',
        description: 'Artistic, natural, lifestyle',
        feel: '艺术、自然、生活化',
        dimensions: { texture: 'organic', mood: 'warm', typography: 'humanist', density: 'minimal' },
        autoSelectTriggers: ['lifestyle', 'wellness', 'travel', 'artistic', '生活', '旅行', '艺术'],
        colorPalette: { background: '#FAF8F0', primaryText: '#2C3E50', secondaryText: '#4A4A4A', accent1: '#F4A261', accent2: '#E9C46A', accent3: '#87A96B' }
    },
    {
        id: 'dark-atmospheric',
        name: 'Dark Atmospheric',
        nameZh: '暗色氛围',
        description: 'Cinematic, entertainment',
        feel: '电影感、娱乐',
        dimensions: { texture: 'clean', mood: 'dark', typography: 'editorial', density: 'balanced' },
        autoSelectTriggers: ['entertainment', 'music', 'gaming', 'atmospheric', '娱乐', '音乐', '游戏', '电影'],
        colorPalette: { background: '#0D1117', primaryText: '#E6EDF3', secondaryText: '#8B949E', accent1: '#58A6FF', accent2: '#7EE787', accent3: '#FF7B72' }
    },
    {
        id: 'notion',
        name: 'Notion',
        nameZh: 'Notion 风',
        description: 'SaaS professional, data-forward',
        feel: 'SaaS 专业、数据驱动',
        dimensions: { texture: 'clean', mood: 'neutral', typography: 'geometric', density: 'dense' },
        autoSelectTriggers: ['saas', 'product', 'dashboard', 'metrics', '产品', '指标', '仪表板'],
        colorPalette: { background: '#FFFFFF', primaryText: '#18181B', secondaryText: '#71717A', accent1: '#18181B', accent2: '#A1A1AA' }
    },
    {
        id: 'bold-editorial',
        name: 'Bold Editorial',
        nameZh: '大胆排版',
        description: 'Magazine impact, keynote drama',
        feel: '杂志冲击力、演讲戏剧感',
        dimensions: { texture: 'clean', mood: 'vibrant', typography: 'editorial', density: 'balanced' },
        autoSelectTriggers: ['launch', 'marketing', 'keynote', 'magazine', '发布', '营销', '演讲'],
        colorPalette: { background: '#FFFFFF', primaryText: '#1A1A2E', secondaryText: '#4A5568', accent1: '#E94560', accent2: '#0F3460', accent3: '#16C79A' }
    },
    {
        id: 'editorial-infographic',
        name: 'Editorial Infographic',
        nameZh: '编辑信息图',
        description: 'Publication quality, informative',
        feel: '出版品质、信息丰富',
        dimensions: { texture: 'clean', mood: 'cool', typography: 'editorial', density: 'dense' },
        autoSelectTriggers: ['explainer', 'journalism', 'science communication', '科普', '解释', '新闻'],
        colorPalette: { background: '#FAF8F5', primaryText: '#334155', secondaryText: '#64748B', accent1: '#2563EB', accent2: '#1E3A5F', accent3: '#BFDBFE' }
    },
    {
        id: 'fantasy-animation',
        name: 'Fantasy Animation',
        nameZh: '奇幻动画',
        description: 'Magical, storytelling',
        feel: '魔幻、讲故事',
        dimensions: { texture: 'organic', mood: 'vibrant', typography: 'handwritten', density: 'minimal' },
        autoSelectTriggers: ['story', 'fantasy', 'animation', 'magical', '故事', '动画', '奇幻'],
        colorPalette: { background: '#1A1A2E', primaryText: '#FFFFFF', secondaryText: '#B4B4C0', accent1: '#E94560', accent2: '#F9B208', accent3: '#16C79A' }
    },
    {
        id: 'intuition-machine',
        name: 'Intuition Machine',
        nameZh: '直觉机器',
        description: 'Technical briefing, bilingual documentation',
        feel: '技术简报、双语文档',
        dimensions: { texture: 'clean', mood: 'cool', typography: 'technical', density: 'dense' },
        autoSelectTriggers: ['briefing', 'academic', 'research', 'bilingual', '学术', '研究', '简报'],
        colorPalette: { background: '#FAF8F5', primaryText: '#334155', secondaryText: '#64748B', accent1: '#2563EB', accent2: '#1E3A5F' }
    },
    {
        id: 'pixel-art',
        name: 'Pixel Art',
        nameZh: '像素风',
        description: 'Retro gaming, developer culture',
        feel: '复古游戏、开发者文化',
        dimensions: { texture: 'pixel', mood: 'vibrant', typography: 'technical', density: 'balanced' },
        autoSelectTriggers: ['gaming', 'retro', 'pixel', 'developer', '像素', '复古', '开发'],
        colorPalette: { background: '#1A1A2E', primaryText: '#FFFFFF', secondaryText: '#B4B4C0', accent1: '#E94560', accent2: '#F9B208', accent3: '#16C79A' }
    },
    {
        id: 'scientific',
        name: 'Scientific',
        nameZh: '学术科研',
        description: 'Academic precision, research quality',
        feel: '学术精确、研究品质',
        dimensions: { texture: 'clean', mood: 'cool', typography: 'technical', density: 'dense' },
        autoSelectTriggers: ['biology', 'chemistry', 'medical', 'scientific', '生物', '化学', '医学', '科学'],
        colorPalette: { background: '#FAF8F5', primaryText: '#334155', secondaryText: '#64748B', accent1: '#2563EB', accent2: '#1E3A5F' }
    },
    {
        id: 'vector-illustration',
        name: 'Vector Illustration',
        nameZh: '矢量插画',
        description: 'Flat design, friendly creative',
        feel: '扁平设计、友好创意',
        dimensions: { texture: 'clean', mood: 'vibrant', typography: 'humanist', density: 'balanced' },
        autoSelectTriggers: ['creative', 'children', 'kids', 'cute', '创意', '儿童', '可爱'],
        colorPalette: { background: '#FFFFFF', primaryText: '#1A1A2E', secondaryText: '#4A5568', accent1: '#E94560', accent2: '#0F3460', accent3: '#16C79A' }
    },
    {
        id: 'vintage',
        name: 'Vintage',
        nameZh: '复古',
        description: 'Historical, heritage storytelling',
        feel: '历史、传承、故事感',
        dimensions: { texture: 'paper', mood: 'warm', typography: 'editorial', density: 'balanced' },
        autoSelectTriggers: ['history', 'heritage', 'vintage', 'expedition', '历史', '复古', '探险'],
        colorPalette: { background: '#FAF3E0', primaryText: '#3E2723', secondaryText: '#5D4037', accent1: '#D4A574', accent2: '#8D6E63', accent3: '#A1887F' }
    },
];

export function recommendPreset(topic: string): string {
    const lower = topic.toLowerCase();
    for (const preset of PRESETS) {
        if (preset.autoSelectTriggers.some(t => lower.includes(t))) {
            return preset.id;
        }
    }
    return 'dark-atmospheric'; // default
}

export function getPresetById(id: string): StylePreset | undefined {
    return PRESETS.find(p => p.id === id);
}

export function buildPresetPromptContext(id?: string): string {
    if (!id) return '';

    const preset = getPresetById(id);
    if (!preset) return '';

    return `Selected preset:
- Name: ${preset.name} (${preset.nameZh})
- Description: ${preset.description}
- Feel: ${preset.feel}
- Texture: ${preset.dimensions.texture}
- Mood: ${preset.dimensions.mood}
- Typography: ${preset.dimensions.typography}
- Density: ${preset.dimensions.density}`;
}
