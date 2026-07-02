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

const MODULE_PROMPT_LABELS: Record<ModuleKey, string> = {
    projects: 'projects',
    certificates: 'certifications',
    awards: 'awards',
    publications: 'publications',
    hobbies: 'hobbies',
    volunteer: 'volunteer experience',
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
    const promptModuleLabel = MODULE_PROMPT_LABELS[moduleType];

    return `You are a professional resume optimization specialist. Help optimize the user's ${promptModuleLabel} content.

## User Background
- Target role: ${resumeContext.personal.title || 'not specified'}
- Approximate years of experience: ${resumeContext.experience.length * 2}
- Skill keywords: ${resumeContext.skills.slice(0, 5).map(s => s.name).join(', ') || 'none'}

## Current ${promptModuleLabel} Content
${JSON.stringify(moduleData, null, 2)}

## Optimization Requirements
1. Keep the information truthful; improve wording only.
2. Use the STAR method: situation, task, action, result.
3. Quantify outcomes using numbers, percentages, or scale where possible.
4. Use industry terms and relevant keywords.
5. Keep each item concise and strong, ideally 2-3 sentences.

## Output Format
Return JSON only, with no extra text:
\`\`\`json
{
  "suggestions": [
    {
      "itemId": "item id",
      "field": "field name to optimize, such as description",
      "original": "original content",
      "optimized": "optimized content",
      "reason": "short reason for the optimization"
    }
  ],
  "generalTips": ["general tip 1", "general tip 2"]
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

    return `You are a senior resume consultant. Based on the user's existing resume information, analyze their career background and recommend additional resume modules that can improve competitiveness.

## Existing Resume Information

### Personal Information
- Name: ${data.personal.name}
- Target role: ${data.personal.title || 'not specified'}
- Summary: ${data.personal.summary || 'none'}

### Work Experience (${data.experience.length} items)
${data.experience.map(e => `- ${e.position} @ ${e.company} (${e.startDate} - ${e.endDate || 'current'})\n  ${e.description}`).join('\n')}

### Education (${data.education.length} items)
${data.education.map(e => `- ${e.degree} ${e.field} @ ${e.institution} (${e.startDate} - ${e.endDate})`).join('\n')}

### Skills (${data.skills.length} items)
${data.skills.map(s => s.name).join(', ') || 'none'}

## Other Modules Already Present in the Resume
${existingModules.length > 0 ? existingModules.map(m => MODULE_PROMPT_LABELS[m as ModuleKey]).join(', ') : 'none'}

## Task
1. Analyze the user's career background and development stage.
2. Recommend 2-3 valuable additional modules from this list:
   - projects
   - certificates
   - awards
   - publications
   - volunteer
   - hobbies
3. For each recommended module, reasonably infer and generate 1-2 concrete entries based on the user's background.

## Output Format
Return JSON only, with no extra text:
\`\`\`json
{
  "recommendations": [
    {
      "moduleType": "projects",
      "moduleName": "Projects",
      "reason": "The user has 5 years of software development experience, and concrete projects can demonstrate technical depth.",
      "suggestedContent": [
        {
          "id": "ai_proj_1",
          "name": "Project name",
          "role": "Role",
          "organization": "Company or organization",
          "startDate": "2023.06",
          "endDate": "2023.12",
          "description": "Project description...",
          "highlights": ["Highlight 1", "Highlight 2"],
          "technologies": ["Technology 1", "Technology 2"],
          "url": ""
        }
      ]
    }
  ]
}
\`\`\`

## suggestedContent Schemas by Module

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

## Important Notes
- Make reasonable inferences from the user's work experience and skills; do not fabricate unrelated content.
- Every id must use the "ai_" prefix, such as "ai_proj_1".
- Do not recommend modules that already exist in the user's resume.`;
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
