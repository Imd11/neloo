/**
 * 简历内容多语言标签
 * Resume Section Labels for Multiple Languages
 */
import type { ResumeLanguage } from '../../types/resume';

// 所有需要翻译的模块标签
type LabelKey =
    | 'education'
    | 'experience'
    | 'skills'
    | 'languages'
    | 'projects'
    | 'certificates'
    | 'awards'
    | 'publications'
    | 'hobbies'
    | 'volunteer'
    | 'summary'
    | 'contact'
    | 'references'
    | 'interests';

// 语言显示名称（用于UI选择器）
export const languageNames: Record<ResumeLanguage, string> = {
    'en': 'English',
    'zh-CN': '简体中文',
    'zh-TW': '繁體中文',
    'es': 'Español',
    'fr': 'Français',
    'de': 'Deutsch',
    'ja': '日本語',
    'ko': '한국어',
    'pt': 'Português',
    'ru': 'Русский',
    'ar': 'العربية',
};

// 多语言标签映射
const labels: Record<LabelKey, Record<ResumeLanguage, string>> = {
    education: {
        'en': 'Education',
        'zh-CN': '教育背景',
        'zh-TW': '教育背景',
        'es': 'Educación',
        'fr': 'Formation',
        'de': 'Ausbildung',
        'ja': '学歴',
        'ko': '학력',
        'pt': 'Educação',
        'ru': 'Образование',
        'ar': 'التعليم',
    },
    experience: {
        'en': 'Work Experience',
        'zh-CN': '工作经历',
        'zh-TW': '工作經歷',
        'es': 'Experiencia Laboral',
        'fr': 'Expérience Professionnelle',
        'de': 'Berufserfahrung',
        'ja': '職歴',
        'ko': '경력',
        'pt': 'Experiência Profissional',
        'ru': 'Опыт работы',
        'ar': 'الخبرة العملية',
    },
    skills: {
        'en': 'Skills',
        'zh-CN': '技能',
        'zh-TW': '技能',
        'es': 'Habilidades',
        'fr': 'Compétences',
        'de': 'Fähigkeiten',
        'ja': 'スキル',
        'ko': '기술',
        'pt': 'Habilidades',
        'ru': 'Навыки',
        'ar': 'المهارات',
    },
    languages: {
        'en': 'Languages',
        'zh-CN': '语言能力',
        'zh-TW': '語言能力',
        'es': 'Idiomas',
        'fr': 'Langues',
        'de': 'Sprachen',
        'ja': '言語',
        'ko': '언어',
        'pt': 'Idiomas',
        'ru': 'Языки',
        'ar': 'اللغات',
    },
    projects: {
        'en': 'Projects',
        'zh-CN': '项目经历',
        'zh-TW': '專案經歷',
        'es': 'Proyectos',
        'fr': 'Projets',
        'de': 'Projekte',
        'ja': 'プロジェクト',
        'ko': '프로젝트',
        'pt': 'Projetos',
        'ru': 'Проекты',
        'ar': 'المشاريع',
    },
    certificates: {
        'en': 'Certifications',
        'zh-CN': '证书资质',
        'zh-TW': '證書資質',
        'es': 'Certificaciones',
        'fr': 'Certifications',
        'de': 'Zertifizierungen',
        'ja': '資格',
        'ko': '자격증',
        'pt': 'Certificações',
        'ru': 'Сертификаты',
        'ar': 'الشهادات',
    },
    awards: {
        'en': 'Awards & Honors',
        'zh-CN': '获奖荣誉',
        'zh-TW': '獲獎榮譽',
        'es': 'Premios y Honores',
        'fr': 'Prix et Distinctions',
        'de': 'Auszeichnungen',
        'ja': '受賞歴',
        'ko': '수상 경력',
        'pt': 'Prêmios e Honras',
        'ru': 'Награды',
        'ar': 'الجوائز والتكريمات',
    },
    publications: {
        'en': 'Publications',
        'zh-CN': '出版物',
        'zh-TW': '出版物',
        'es': 'Publicaciones',
        'fr': 'Publications',
        'de': 'Publikationen',
        'ja': '出版物',
        'ko': '출판물',
        'pt': 'Publicações',
        'ru': 'Публикации',
        'ar': 'المنشورات',
    },
    hobbies: {
        'en': 'Hobbies & Interests',
        'zh-CN': '兴趣爱好',
        'zh-TW': '興趣愛好',
        'es': 'Pasatiempos e Intereses',
        'fr': 'Loisirs et Intérêts',
        'de': 'Hobbys und Interessen',
        'ja': '趣味',
        'ko': '취미 및 관심사',
        'pt': 'Hobbies e Interesses',
        'ru': 'Хобби и интересы',
        'ar': 'الهوايات والاهتمامات',
    },
    volunteer: {
        'en': 'Volunteer Experience',
        'zh-CN': '志愿者经历',
        'zh-TW': '志願服務經歷',
        'es': 'Experiencia de Voluntariado',
        'fr': 'Bénévolat',
        'de': 'Ehrenamtliche Tätigkeiten',
        'ja': 'ボランティア経験',
        'ko': '봉사 활동',
        'pt': 'Experiência Voluntária',
        'ru': 'Волонтерство',
        'ar': 'الأعمال التطوعية',
    },
    summary: {
        'en': 'About Me',
        'zh-CN': '个人简介',
        'zh-TW': '個人簡介',
        'es': 'Sobre Mí',
        'fr': 'À Propos',
        'de': 'Über Mich',
        'ja': '自己紹介',
        'ko': '자기소개',
        'pt': 'Sobre Mim',
        'ru': 'Обо мне',
        'ar': 'نبذة عني',
    },
    contact: {
        'en': 'Contact',
        'zh-CN': '联系方式',
        'zh-TW': '聯絡方式',
        'es': 'Contacto',
        'fr': 'Contact',
        'de': 'Kontakt',
        'ja': '連絡先',
        'ko': '연락처',
        'pt': 'Contato',
        'ru': 'Контакты',
        'ar': 'التواصل',
    },
    references: {
        'en': 'References',
        'zh-CN': '推荐人',
        'zh-TW': '推薦人',
        'es': 'Referencias',
        'fr': 'Références',
        'de': 'Referenzen',
        'ja': '推薦者',
        'ko': '추천인',
        'pt': 'Referências',
        'ru': 'Рекомендации',
        'ar': 'المراجع',
    },
    interests: {
        'en': 'Interests',
        'zh-CN': '兴趣爱好',
        'zh-TW': '興趣愛好',
        'es': 'Intereses',
        'fr': 'Centres d\'intérêt',
        'de': 'Interessen',
        'ja': '興味・関心',
        'ko': '관심사',
        'pt': 'Interesses',
        'ru': 'Интересы',
        'ar': 'الاهتمامات',
    },
};

/**
 * 获取指定语言的标签
 * @param key 标签键名
 * @param lang 语言代码
 * @returns 翻译后的标签文本
 */
export function getLabel(key: LabelKey, lang: ResumeLanguage = 'en'): string {
    return labels[key]?.[lang] || labels[key]?.['en'] || key;
}

/**
 * 获取指定语言的大写标签（用于某些模板）
 */
export function getLabelUpper(key: LabelKey, lang: ResumeLanguage = 'en'): string {
    return getLabel(key, lang).toUpperCase();
}

export type { LabelKey };
