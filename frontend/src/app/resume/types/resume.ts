// ============================================================================
// 统一简历数据模型 - Unified Resume Data Model
// ============================================================================

// ─── 基础信息 ────────────────────────────────────────────────────────────────

export interface PersonalInfo {
    name: string;
    title: string;
    email: string;
    phone: string;
    address: string;
    city: string;
    country: string;
    postalCode: string;
    website: string;
    photo: string;
    nationality: string;
    birthday: string;
    summary: string;           // 个人简介/自我介绍
    philosophy: string;        // 人生哲学/座右铭
}

export interface SocialLink {
    platform: string;          // linkedin, github, twitter, wechat, etc.
    icon: string;
    url: string;
    username: string;
}

// ─── 工作经历 ────────────────────────────────────────────────────────────────

export interface Experience {
    id: string;
    company: string;
    position: string;
    location: string;
    startDate: string;
    endDate: string;
    current: boolean;
    description: string;
    highlights: string[];      // 主要成就，用于模板中的 bullet points
}

// ─── 教育背景 ────────────────────────────────────────────────────────────────

export interface Education {
    id: string;
    institution: string;
    degree: string;            // 学位：本科、硕士、博士等
    field: string;             // 专业
    location: string;
    startDate: string;
    endDate: string;
    gpa: string;
    description: string;
    courses: string[];         // 相关课程
}

// ─── 技能能力 ────────────────────────────────────────────────────────────────

export interface Skill {
    id: string;
    name: string;
    level: number;             // 1-5 或 1-100
    category: string;          // hard/soft/technical/language
    icon: string;
    years: number;             // 经验年限
    subSkills: string[];       // 子技能
}

export interface Language {
    id: string;
    name: string;
    level: 'native' | 'fluent' | 'advanced' | 'intermediate' | 'basic';
    levelNumber: number;       // 1-5 for visual dots
    flag: string;
}

// ─── 项目经历 ────────────────────────────────────────────────────────────────

export interface Project {
    id: string;
    name: string;
    role: string;
    organization: string;
    startDate: string;
    endDate: string;
    description: string;
    highlights: string[];
    technologies: string[];
    url: string;
}

// ─── 证书资质 ────────────────────────────────────────────────────────────────

export interface Certificate {
    id: string;
    name: string;
    issuer: string;
    date: string;
    expiryDate: string;
    credentialId: string;
    url: string;
}

// ─── 获奖荣誉 ────────────────────────────────────────────────────────────────

export interface Award {
    id: string;
    title: string;
    issuer: string;
    date: string;
    description: string;
}

// ─── 出版物 ──────────────────────────────────────────────────────────────────

export interface Publication {
    id: string;
    title: string;
    authors: string;
    publisher: string;
    date: string;
    url: string;
    description: string;
}

// ─── 演讲/Talks ──────────────────────────────────────────────────────────────

export interface Talk {
    id: string;
    title: string;
    event: string;
    location: string;
    date: string;
    url: string;
    description: string;
}

// ─── 志愿者经历 ──────────────────────────────────────────────────────────────

export interface Volunteer {
    id: string;
    organization: string;
    role: string;
    location: string;
    startDate: string;
    endDate: string;
    description: string;
    highlights: string[];
}

// ─── 推荐人 ──────────────────────────────────────────────────────────────────

export interface Reference {
    id: string;
    name: string;
    title: string;
    company: string;
    email: string;
    phone: string;
    relationship: string;
}

// ─── 兴趣爱好 ────────────────────────────────────────────────────────────────

export interface Hobby {
    id: string;
    name: string;
    icon: string;
    description: string;
}

// ─── 自定义字段 ──────────────────────────────────────────────────────────────

export interface CustomSection {
    id: string;
    title: string;
    items: {
        id: string;
        title: string;
        subtitle: string;
        date: string;
        description: string;
    }[];
}

export interface SectionVisibility {
    projects: boolean;
    certificates: boolean;
    awards: boolean;
    publications: boolean;
    hobbies: boolean;
}

// ============================================================================
// 完整简历数据结构
// ============================================================================

export interface ResumeData {
    // 必填字段
    personal: PersonalInfo;

    // 核心字段
    experience: Experience[];
    education: Education[];
    skills: Skill[];
    languages: Language[];

    // 可选字段
    socialLinks: SocialLink[];
    projects: Project[];
    certificates: Certificate[];
    awards: Award[];
    publications: Publication[];
    talks: Talk[];
    volunteer: Volunteer[];
    references: Reference[];
    hobbies: Hobby[];

    // 自定义
    customSections: CustomSection[];

    // 可选模块显示控制（隐藏不删除数据）
    sectionVisibility: SectionVisibility;
}

// ============================================================================
// 样式设置
// ============================================================================

export type PageSize = 'A4' | 'Letter';

// ─── 简历语言类型 ─────────────────────────────────────────────────────────────
export type ResumeLanguage =
    | 'en'      // English
    | 'zh-CN'   // 简体中文
    | 'zh-TW'   // 繁體中文
    | 'es'      // Español
    | 'fr'      // Français
    | 'de'      // Deutsch
    | 'ja'      // 日本語
    | 'ko'      // 한국어
    | 'pt'      // Português
    | 'ru'      // Русский
    | 'ar';     // العربية

export interface StyleSettings {
    pageSize: PageSize;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    fontSize: number;
    lineHeight: number;
    sidebarWidth: number;
    fontFamily: string;
    headingFont: string;
    resumeLanguage: ResumeLanguage;
}

// ============================================================================
// 默认值
// ============================================================================

export const defaultPersonalInfo: PersonalInfo = {
    name: '',
    title: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    country: '',
    postalCode: '',
    website: '',
    photo: '',
    nationality: '',
    birthday: '',
    summary: '',
    philosophy: '',
};

export const defaultStyleSettings: StyleSettings = {
    pageSize: 'A4',
    primaryColor: '#0e5484',
    secondaryColor: '#374151',
    accentColor: '#6366f1',
    fontSize: 10,
    lineHeight: 1.4,
    sidebarWidth: 35,
    fontFamily: 'Inter, sans-serif',
    headingFont: 'Inter, sans-serif',
    resumeLanguage: 'en',
};

export const defaultResumeData: ResumeData = {
    personal: {
        ...defaultPersonalInfo,
        name: 'Panda Bear',
        title: 'Panda Scientist, Panda of the Year',
        email: 'panda@bamboo.cn',
        phone: '+86 555 555 555',
        address: 'Park Ave. 1, 555 555 B-Woods',
        city: 'Bamboo Forest',
        country: 'China',
        website: 'https://pandascience.net',
        nationality: 'Chinese',
        birthday: 'February 9, 2020',
        photo: 'https://images.unsplash.com/photo-1564349683136-77e08dba1ef7?w=200&h=200&fit=crop',
        summary: 'Passionate panda scientist with expertise in bamboo research and conservation.',
    },
    socialLinks: [
        { platform: 'github', icon: '💻', url: '#', username: 'pandabear' },
        { platform: 'linkedin', icon: '📄', url: '#', username: 'pandabear' },
    ],
    experience: [
        {
            id: '1',
            company: 'The Panda Way',
            position: 'CEO',
            location: 'Chengdu',
            startDate: 'Currently',
            endDate: '',
            current: true,
            description: 'Chief executive officer, Head developer of yoga and meditation apps.',
            highlights: [],
        },
        {
            id: '2',
            company: 'Panda Social Ltd',
            position: 'Founder',
            location: 'Sichuan',
            startDate: '2013',
            endDate: '2018',
            current: false,
            description: 'Founded the first social network for pandas.',
            highlights: [],
        },
    ],
    education: [
        {
            id: '1',
            institution: 'Panda Academy',
            degree: 'Master',
            field: 'Panda Science',
            location: 'Chengdu',
            startDate: '2005',
            endDate: '2010',
            gpa: '',
            description: 'Specialized in sustainable bamboo cultivation.',
            courses: [],
        },
    ],
    skills: [
        { id: '1', name: 'Sleeping almost all day', level: 5, category: 'soft', icon: '😴', years: 0, subSkills: [] },
        { id: '2', name: 'Eating bamboo sprouts', level: 4, category: 'hard', icon: '🎋', years: 0, subSkills: [] },
        { id: '3', name: 'Relaxing', level: 5, category: 'soft', icon: '🧘', years: 0, subSkills: [] },
    ],
    languages: [
        { id: '1', name: 'Chinese', level: 'native', levelNumber: 5, flag: '🇨🇳' },
        { id: '2', name: 'German', level: 'intermediate', levelNumber: 3, flag: '🇩🇪' },
        { id: '3', name: 'English', level: 'intermediate', levelNumber: 3, flag: '🇬🇧' },
    ],
    projects: [],
    certificates: [],
    awards: [
        { id: '1', title: 'Panda of the Year', issuer: 'Panda World Forum', date: '2019', description: '' },
    ],
    publications: [
        { id: '1', title: 'Cooking: 100 recipes for lazy Pandas', authors: 'Me and My Panda Friends', publisher: 'Panda Culinary', date: '2010', url: '', description: '' },
    ],
    talks: [],
    volunteer: [],
    references: [],
    hobbies: [],
    customSections: [],
    sectionVisibility: {
        projects: false,
        certificates: false,
        awards: true,
        publications: true,
        hobbies: false,
    },
};

// ============================================================================
// 工具函数
// ============================================================================

export function createId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}
