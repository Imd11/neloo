/**
 * Additional Step AI Logic - Redesigned
 * Two prompts: optimize existing modules + recommend new modules
 */
import type { ResumeData, Project, Certificate, Award, Publication, Hobby, Volunteer } from '../types/resume';

// ============================================================================
// Types
// ============================================================================

export type ModuleKey = 'projects' | 'certificates' | 'awards' | 'publications' | 'hobbies' | 'volunteer';

// Optimization for existing modules (same as other wizard steps)
export interface ModuleOptimization {
    moduleType: ModuleKey;
    suggestions: {
        itemId: string;
        field: string;
        original: string;
        optimized: string;
        reason: string;
    }[];
    generalTips: string[];
}

// New module recommendation with generated content
export interface NewModuleRecommendation {
    moduleType: ModuleKey;
    moduleName: string;
    reason: string;
    suggestedContent: Project[] | Certificate[] | Award[] | Publication[] | Hobby[] | Volunteer[];
}

export interface RecommendNewModulesResponse {
    recommendations: NewModuleRecommendation[];
}

// ============================================================================
// Module Labels and Icons
// ============================================================================

export const MODULE_LABELS: Record<ModuleKey, string> = {
    projects: '项目经历',
    certificates: '证书资质',
    awards: '获奖荣誉',
    publications: '出版物',
    hobbies: '兴趣爱好',
    volunteer: '志愿者经历',
};

export const MODULE_ICONS: Record<ModuleKey, string> = {
    projects: '💼',
    certificates: '📜',
    awards: '🏆',
    publications: '📚',
    hobbies: '🎯',
    volunteer: '🤝',
};

// ============================================================================
// Prompt 1: Optimize Existing Modules
// ============================================================================

export function buildOptimizeExistingPrompt(
    moduleType: ModuleKey,
    moduleData: any[],
    resumeContext: ResumeData
): string {
    const moduleLabel = MODULE_LABELS[moduleType];

    return `你是一位专业的简历优化师。请帮助优化用户的「${moduleLabel}」内容。

## 用户背景
- 目标职位：${resumeContext.personal.title || '未指定'}
- 工作年限：约 ${resumeContext.experience.length * 2} 年
- 技能关键词：${resumeContext.skills.slice(0, 5).map(s => s.name).join('、') || '无'}

## 当前 ${moduleLabel} 内容
${JSON.stringify(moduleData, null, 2)}

## 优化要求
1. 保持信息真实性，只优化表达方式
2. 使用 STAR 法则（情境-任务-行动-结果）
3. 量化成果（数据、百分比、规模）
4. 使用行业术语和关键词
5. 简洁有力，每条控制在 2-3 句话

## 输出格式
返回 JSON（不要添加其他文字）：
\`\`\`json
{
  "suggestions": [
    {
      "itemId": "条目ID",
      "field": "要优化的字段名（如 description）",
      "original": "原始内容",
      "optimized": "优化后的内容",
      "reason": "优化理由（简短）"
    }
  ],
  "generalTips": ["通用建议1", "通用建议2"]
}
\`\`\``;
}

// ============================================================================
// Prompt 2: Recommend New Modules
// ============================================================================

export function buildRecommendNewModulesPrompt(data: ResumeData): string {
    // Identify which modules user already has
    const existingModules: string[] = [];
    if (data.projects.length > 0) existingModules.push('projects');
    if (data.certificates.length > 0) existingModules.push('certificates');
    if (data.awards.length > 0) existingModules.push('awards');
    if (data.publications.length > 0) existingModules.push('publications');
    if (data.hobbies.length > 0) existingModules.push('hobbies');
    if (data.volunteer.length > 0) existingModules.push('volunteer');

    return `你是一位资深简历顾问。请根据用户已填写的简历信息，分析其职业背景，推荐适合添加的额外模块来增强简历竞争力。

## 用户已填写的信息

### 基本信息
- 姓名：${data.personal.name}
- 目标职位：${data.personal.title || '未指定'}
- 个人简介：${data.personal.summary || '无'}

### 工作经历（${data.experience.length}条）
${data.experience.map(e => `- ${e.position} @ ${e.company}（${e.startDate} - ${e.endDate || '至今'}）\n  ${e.description}`).join('\n')}

### 教育背景（${data.education.length}条）
${data.education.map(e => `- ${e.degree} ${e.field} @ ${e.institution}（${e.startDate} - ${e.endDate}）`).join('\n')}

### 技能（${data.skills.length}项）
${data.skills.map(s => s.name).join('、') || '无'}

## 用户简历中已有的其他模块（无需再推荐）
${existingModules.length > 0 ? existingModules.map(m => MODULE_LABELS[m as ModuleKey]).join('、') : '无'}

## 你的任务
1. 分析用户的职业背景和发展阶段
2. 推荐 2-3 个对用户有价值的额外模块（从以下选择）：
   - projects: 项目经历
   - certificates: 证书资质
   - awards: 获奖荣誉
   - publications: 出版物/论文
   - volunteer: 志愿者经历
   - hobbies: 兴趣爱好
3. 对于每个推荐的模块，基于用户背景合理推断并生成 1-2 条具体内容

## 输出格式
返回 JSON（不要添加其他文字）：
\`\`\`json
{
  "recommendations": [
    {
      "moduleType": "projects",
      "moduleName": "项目经历",
      "reason": "您有5年软件开发经验，展示具体项目能体现技术深度",
      "suggestedContent": [
        {
          "id": "ai_proj_1",
          "name": "项目名称",
          "role": "角色",
          "organization": "所属公司/组织",
          "startDate": "2023.06",
          "endDate": "2023.12",
          "description": "项目描述...",
          "highlights": ["亮点1", "亮点2"],
          "technologies": ["技术1", "技术2"],
          "url": ""
        }
      ]
    }
  ]
}
\`\`\`

## 各模块的 suggestedContent 结构

### projects
{ id, name, role, organization, startDate, endDate, description, highlights[], technologies[], url }

### certificates  
{ id, name, issuer, date, expiryDate, credentialId, url }

### awards
{ id, title, issuer, date, description }

### publications
{ id, title, authors, publisher, date, url, description }

### volunteer
{ id, organization, role, location, startDate, endDate, description, highlights[] }

### hobbies
{ id, name, icon, description }

## 重要提示
- 基于用户的工作经历和技能合理推断，不要凭空编造不相关的内容
- 每个 id 使用 "ai_" 前缀，如 "ai_proj_1"
- 推荐的模块不能与用户已有模块重复`;
}

// ============================================================================
// Parse Responses
// ============================================================================

export function parseOptimizeResponse(response: string): ModuleOptimization | null {
    try {
        let content = response.trim();
        if (content.startsWith('```')) {
            const lines = content.split('\n');
            content = lines.slice(1, -1).join('\n');
        }

        const start = content.indexOf('{');
        const end = content.lastIndexOf('}') + 1;
        if (start >= 0 && end > start) {
            content = content.slice(start, end);
        }

        const parsed = JSON.parse(content);
        return {
            moduleType: 'projects', // Will be set by caller
            suggestions: parsed.suggestions || [],
            generalTips: parsed.generalTips || [],
        };
    } catch (e) {
        console.error('Failed to parse optimize response:', e);
        return null;
    }
}

export function parseRecommendResponse(response: string): RecommendNewModulesResponse | null {
    try {
        let content = response.trim();
        if (content.startsWith('```')) {
            const lines = content.split('\n');
            content = lines.slice(1, -1).join('\n');
        }

        const start = content.indexOf('{');
        const end = content.lastIndexOf('}') + 1;
        if (start >= 0 && end > start) {
            content = content.slice(start, end);
        }

        const parsed = JSON.parse(content);

        if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
            return null;
        }

        // Ensure all suggestedContent items have valid IDs
        const recommendations = parsed.recommendations.map((rec: any) => ({
            ...rec,
            suggestedContent: (rec.suggestedContent || []).map((item: any, idx: number) => ({
                ...item,
                id: item.id || `ai_${rec.moduleType}_${idx + 1}`,
            })),
        }));

        return { recommendations };
    } catch (e) {
        console.error('Failed to parse recommend response:', e);
        return null;
    }
}

// ============================================================================
// Helper: Get existing modules from resume data
// ============================================================================

export function getExistingModules(data: ResumeData): ModuleKey[] {
    const result: ModuleKey[] = [];
    if (data.projects.length > 0) result.push('projects');
    if (data.certificates.length > 0) result.push('certificates');
    if (data.awards.length > 0) result.push('awards');
    if (data.publications.length > 0) result.push('publications');
    if (data.hobbies.length > 0) result.push('hobbies');
    if (data.volunteer.length > 0) result.push('volunteer');
    return result;
}

export function getModuleData(data: ResumeData, moduleType: ModuleKey): any[] {
    switch (moduleType) {
        case 'projects': return data.projects;
        case 'certificates': return data.certificates;
        case 'awards': return data.awards;
        case 'publications': return data.publications;
        case 'hobbies': return data.hobbies;
        case 'volunteer': return data.volunteer;
        default: return [];
    }
}
