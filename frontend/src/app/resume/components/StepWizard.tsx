import { useEffect, useMemo, useRef, useState } from 'react';
import type { ResumeData } from '../types/resume';
import { sendMessage } from '../lib/deepseek';
import { PhotoUpload } from './PhotoUpload';
import { AdditionalStep } from './AdditionalStep';
import {
    buildRecommendNewModulesPrompt,
    parseRecommendResponse,
    getExistingModules,
    type NewModuleRecommendation,
} from '../lib/additionalStepAI';

interface StepWizardProps {
    data: ResumeData;
    onChange: (data: ResumeData) => void;
    onComplete: () => void;
    active?: boolean;
}

interface Step {
    id: string;
    label: string;
    icon: string;
}

type StepId = 'personal' | 'experience' | 'education' | 'skills' | 'additional' | 'finalize';

const steps: Step[] = [
    { id: 'personal', label: '基本信息', icon: '👤' },
    { id: 'experience', label: '工作经历', icon: '💼' },
    { id: 'education', label: '教育背景', icon: '🎓' },
    { id: 'skills', label: '技能能力', icon: '⚡' },
    { id: 'additional', label: '其他信息', icon: '📋' },
    { id: 'finalize', label: '完成', icon: '✨' },
];

type SuggestionStatus = 'idle' | 'loading' | 'ready' | 'error';

interface SuggestionCard {
    status: SuggestionStatus;
    message?: string;
    field?: string;
    fieldLabel?: string;
    before?: unknown;
    after?: unknown;
    reason?: string;
    error?: string;
    applied?: boolean;
    ignored?: boolean;
    sourceHash?: string;
    requestId?: number;
}

// Skills recommendation: AI suggests new skills to add based on resume analysis
interface SkillRecommendation {
    name: string;
    level: number;
    reason: string;
    relevance: string;
    added?: boolean;
    ignored?: boolean;
}

interface SkillsRecommendationState {
    status: SuggestionStatus;
    message?: string;
    recommendations: SkillRecommendation[];
    error?: string;
    sourceHash?: string;
    requestId?: number;
}

function safeJSONStringify(value: unknown): string {
    if (typeof value === 'string') return value;
    try {
        return JSON.stringify(value, null, 2);
    } catch {
        return String(value);
    }
}

function hasMeaningfulContent(value: unknown): boolean {
    if (value == null) return false;
    if (typeof value === 'string') return value.trim().length > 0;
    if (typeof value === 'number') return true;
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) return value.some((v) => hasMeaningfulContent(v));
    if (typeof value === 'object') {
        return Object.values(value as Record<string, unknown>).some((v) => hasMeaningfulContent(v));
    }
    return false;
}

function getValueAtPath(obj: unknown, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;
    for (const part of parts) {
        if (current == null) return undefined;
        if (!isNaN(Number(part))) {
            if (!Array.isArray(current)) return undefined;
            current = current[Number(part)];
        } else {
            if (typeof current !== 'object') return undefined;
            current = (current as Record<string, unknown>)[part];
        }
    }
    return current;
}

function applyValueAtPath<T>(obj: T, path: string, value: unknown): T {
    const cloned = JSON.parse(JSON.stringify(obj)) as unknown;
    const parts = path.split('.');
    let current: unknown = cloned;
    for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!isNaN(Number(part))) {
            if (!Array.isArray(current)) return obj;
            current = current[Number(part)];
        } else {
            if (typeof current !== 'object' || current == null) return obj;
            current = (current as Record<string, unknown>)[part];
        }
    }
    const last = parts[parts.length - 1];
    if (!isNaN(Number(last))) {
        if (!Array.isArray(current)) return obj;
        (current as unknown[])[Number(last)] = value;
    } else {
        if (typeof current !== 'object' || current == null) return obj;
        (current as Record<string, unknown>)[last] = value;
    }
    return cloned as T;
}

function parseStructuredSuggestion(content: string): {
    message: string;
    suggestion?: { field: string; fieldLabel?: string; after: unknown; reason?: string };
} {
    const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
        try {
            const parsed = JSON.parse(jsonMatch[1]);
            if (parsed?.suggestion?.field && parsed?.suggestion?.after !== undefined) {
                return {
                    message: parsed.message || '',
                    suggestion: {
                        field: parsed.suggestion.field,
                        fieldLabel: parsed.suggestion.fieldLabel,
                        after: parsed.suggestion.after,
                        reason: parsed.suggestion.reason,
                    },
                };
            }
        } catch {
            // ignore
        }
    }
    return { message: content };
}

export function StepWizard({ data, onChange, onComplete, active = true }: StepWizardProps) {
    const [currentStep, setCurrentStep] = useState(0);
    const [aiWidth, setAiWidth] = useState(420);
    const [resizingPanel, setResizingPanel] = useState<'ai' | null>(null);
    const mainRef = useRef<HTMLElement>(null);
    const debounceTimerRef = useRef<number | null>(null);
    const globalRequestIdRef = useRef(0);
    const hasPrefetchedRef = useRef(false);
    const prefetchInFlightRef = useRef(false);
    const experienceSuggestionsRef = useRef<Record<string, SuggestionCard>>({});
    const educationSuggestionsRef = useRef<Record<string, SuggestionCard>>({});
    const singleStepSuggestionsRef = useRef<Record<StepId, SuggestionCard>>({} as Record<StepId, SuggestionCard>);
    const [autoOptimizePausedByStep, setAutoOptimizePausedByStep] = useState<Record<StepId, boolean>>(
        {} as Record<StepId, boolean>
    );
    const autoOptimizePausedByStepRef = useRef<Record<StepId, boolean>>({} as Record<StepId, boolean>);

    const stepId = steps[currentStep].id as StepId;

    const [singleStepSuggestions, setSingleStepSuggestions] = useState<Record<StepId, SuggestionCard>>(
        {} as Record<StepId, SuggestionCard>
    );
    const [experienceSuggestions, setExperienceSuggestions] = useState<Record<string, SuggestionCard>>({});
    const [educationSuggestions, setEducationSuggestions] = useState<Record<string, SuggestionCard>>({});
    // Additional step: key format is "moduleType_itemId" e.g. "projects_abc123"
    const [additionalSuggestions, setAdditionalSuggestions] = useState<Record<string, SuggestionCard>>({});
    const additionalSuggestionsRef = useRef<Record<string, SuggestionCard>>({});
    // Skills step: AI recommends new skills to add based on resume analysis
    const [skillsRecommendations, setSkillsRecommendations] = useState<SkillsRecommendationState>({
        status: 'idle',
        recommendations: [],
    });
    const skillsRecommendationsRef = useRef<SkillsRecommendationState>({ status: 'idle', recommendations: [] });
    // Additional step: AI recommends new modules (projects/certificates/etc) to add
    const [moduleRecommendations, setModuleRecommendations] = useState<{
        status: SuggestionStatus;
        recommendations: NewModuleRecommendation[];
        error?: string;
    }>({ status: 'idle', recommendations: [] });
    const moduleRecommendationsRef = useRef<{ status: SuggestionStatus; recommendations: NewModuleRecommendation[]; error?: string }>({ status: 'idle', recommendations: [] });

    useEffect(() => {
        experienceSuggestionsRef.current = experienceSuggestions;
    }, [experienceSuggestions]);
    useEffect(() => {
        educationSuggestionsRef.current = educationSuggestions;
    }, [educationSuggestions]);
    useEffect(() => {
        singleStepSuggestionsRef.current = singleStepSuggestions;
    }, [singleStepSuggestions]);
    useEffect(() => {
        additionalSuggestionsRef.current = additionalSuggestions;
    }, [additionalSuggestions]);
    useEffect(() => {
        skillsRecommendationsRef.current = skillsRecommendations;
    }, [skillsRecommendations]);
    useEffect(() => {
        moduleRecommendationsRef.current = moduleRecommendations;
    }, [moduleRecommendations]);
    useEffect(() => {
        autoOptimizePausedByStepRef.current = autoOptimizePausedByStep;
    }, [autoOptimizePausedByStep]);

    const goNext = () => {
        if (currentStep < steps.length - 1) {
            setCurrentStep(currentStep + 1);
        } else {
            onComplete();
        }
    };

    const goPrev = () => {
        if (currentStep > 0) {
            setCurrentStep(currentStep - 1);
        }
    };

    const goToStep = (index: number) => {
        if (index <= currentStep) {
            setCurrentStep(index);
        }
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingPanel !== 'ai') return;
            if (!mainRef.current) return;

            const rect = mainRef.current.getBoundingClientRect();
            const newWidth = rect.right - e.clientX;
            setAiWidth(Math.max(280, Math.min(600, newWidth)));
        };

        const handleMouseUp = () => {
            setResizingPanel(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (resizingPanel) {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingPanel]);

    const listCards = useMemo(() => {
        if (stepId === 'experience') return experienceSuggestions;
        if (stepId === 'education') return educationSuggestions;
        return {};
    }, [educationSuggestions, experienceSuggestions, stepId]);

    const singleCard = singleStepSuggestions[stepId];

    function buildPromptForSingle(step: StepId, payload: unknown): string {
        const stepLabel = steps.find((s) => s.id === step)?.label || '简历';
        return `请帮我优化简历的${stepLabel}部分。当前内容：
\`\`\`json
${safeJSONStringify(payload)}
\`\`\`

请返回 JSON 格式的优化建议：
\`\`\`json
{
  "message": "简短说明为什么这样优化",
  "suggestion": {
    "field": "字段路径，如 personal.summary 或 experience.0.description",
    "fieldLabel": "字段中文名，如 个人简介",
    "after": "优化后的内容",
    "reason": "修改理由"
  }
}
\`\`\`
请选择最值得优化的一个字段给出建议。`;
    }

    function buildPromptForListItem(step: 'experience' | 'education', index: number, item: unknown): string {
        const label = step === 'experience' ? '工作经历' : '教育背景';
        const prefix = `${step}.${index}`;
        const allowed =
            step === 'experience'
                ? ['company', 'position', 'location', 'startDate', 'endDate', 'description', 'highlights']
                : ['institution', 'degree', 'field', 'location', 'startDate', 'endDate', 'gpa', 'description', 'courses'];
        return `请帮我优化简历的${label}第 ${index + 1} 条记录。当前记录：
\`\`\`json
${safeJSONStringify(item)}
\`\`\`

请返回 JSON 格式的优化建议：
\`\`\`json
{
  "message": "简短说明为什么这样优化",
  "suggestion": {
    "field": "字段路径，必须以 ${prefix}. 开头，例如 ${prefix}.description",
    "fieldLabel": "字段中文名，如 工作描述",
    "after": "优化后的内容",
    "reason": "修改理由"
  }
}
\`\`\`
请选择最值得优化的一个字段给出建议（允许字段：${allowed.join(', ')}）。`;
    }

    type AdditionalModuleType = 'projects' | 'certificates' | 'awards' | 'publications' | 'hobbies';
    const ADDITIONAL_MODULE_LABELS: Record<AdditionalModuleType, string> = {
        projects: '项目经历',
        certificates: '证书资质',
        awards: '获奖荣誉',
        publications: '出版物',
        hobbies: '兴趣爱好',
    };
    const ADDITIONAL_MODULE_FIELDS: Record<AdditionalModuleType, string[]> = {
        projects: ['name', 'role', 'organization', 'startDate', 'endDate', 'description', 'highlights', 'technologies'],
        certificates: ['name', 'issuer', 'date', 'expiryDate', 'credentialId'],
        awards: ['title', 'issuer', 'date', 'description'],
        publications: ['title', 'authors', 'publisher', 'date', 'description'],
        hobbies: ['name', 'description'],
    };

    function buildPromptForAdditionalItem(moduleType: AdditionalModuleType, index: number, item: unknown): string {
        const label = ADDITIONAL_MODULE_LABELS[moduleType];
        const prefix = `${moduleType}.${index}`;
        const allowed = ADDITIONAL_MODULE_FIELDS[moduleType];
        return `请帮我优化简历的${label}第 ${index + 1} 条记录。当前记录：
\`\`\`json
${safeJSONStringify(item)}
\`\`\`

请返回 JSON 格式的优化建议：
\`\`\`json
{
  "message": "简短说明为什么这样优化",
  "suggestion": {
    "field": "字段路径，必须以 ${prefix}. 开头，例如 ${prefix}.description",
    "fieldLabel": "字段中文名，如 项目描述",
    "after": "优化后的内容",
    "reason": "修改理由"
  }
}
\`\`\`
请选择最值得优化的一个字段给出建议（允许字段：${allowed.join(', ')}）。`;
    }

    function rewriteListFieldPath(step: 'experience' | 'education', itemId: string, field: string): string | null {
        const match = field.match(new RegExp(`^${step}\\.(\\d+)\\.(.+)$`));
        if (!match) return null;
        const rest = match[2];
        const index =
            step === 'experience'
                ? data.experience.findIndex((e) => e.id === itemId)
                : data.education.findIndex((e) => e.id === itemId);
        if (index < 0) return null;
        return `${step}.${index}.${rest}`;
    }

    function rewriteAdditionalFieldPath(moduleType: AdditionalModuleType, itemId: string, field: string): string | null {
        const match = field.match(new RegExp(`^${moduleType}\\.(\\d+)\\.(.+)$`));
        if (!match) return null;
        const rest = match[2];
        const items = data[moduleType] as { id: string }[];
        const index = items.findIndex((e) => e.id === itemId);
        if (index < 0) return null;
        return `${moduleType}.${index}.${rest}`;
    }

    function getSinglePayload(step: StepId): unknown {
        if (step === 'personal') {
            // Exclude photo to avoid sending base64 image data to AI (causes token overflow)
            const { photo, ...rest } = data.personal;
            return rest;
        }
        if (step === 'skills') return { skills: data.skills, languages: data.languages };
        if (step === 'additional') return { projects: data.projects, awards: data.awards, certificates: data.certificates };
        if (step === 'finalize') {
            // Exclude photo from finalize payload as well
            const { photo, ...personalRest } = data.personal;
            return { ...data, personal: personalRest };
        }
        return null;
    }

    async function generateSingleSuggestion(step: StepId, force = false) {
        const payload = getSinglePayload(step);
        if (!payload) return;
        if (!hasMeaningfulContent(payload)) return;

        const hash = safeJSONStringify(payload);
        const prev = singleStepSuggestionsRef.current[step];
        if (!force && prev?.ignored) return;
        if (!force && prev?.status === 'loading' && prev.sourceHash === hash) return;
        if (!force && prev?.status === 'ready' && prev.sourceHash === hash && !prev.applied) return;

        const requestId = ++globalRequestIdRef.current;
        setSingleStepSuggestions((s) => ({
            ...s,
            [step]: { status: 'loading', sourceHash: hash, requestId },
        }));

        try {
            const response = await sendMessage([{ role: 'user', content: buildPromptForSingle(step, payload) }]);
            const parsed = parseStructuredSuggestion(response);
            if (!parsed.suggestion) {
                setSingleStepSuggestions((s) => {
                    if (s[step]?.requestId !== requestId) return s;
                    return {
                        ...s,
                        [step]: { status: 'error', error: parsed.message || 'AI 未返回可应用的建议。', sourceHash: hash, requestId },
                    };
                });
                return;
            }

            const suggestion = parsed.suggestion;
            const before = getValueAtPath(data, suggestion.field);
            setSingleStepSuggestions((s) => {
                if (s[step]?.requestId !== requestId) return s;
                return {
                    ...s,
                    [step]: {
                        status: 'ready',
                        message: parsed.message,
                        field: suggestion.field,
                        fieldLabel: suggestion.fieldLabel || suggestion.field,
                        before,
                        after: suggestion.after,
                        reason: suggestion.reason,
                        sourceHash: hash,
                        requestId,
                    },
                };
            });
        } catch (error) {
            setSingleStepSuggestions((s) => {
                if (s[step]?.requestId !== requestId) return s;
                return {
                    ...s,
                    [step]: {
                        status: 'error',
                        error: error instanceof Error ? error.message : 'AI 请求失败',
                        sourceHash: hash,
                        requestId,
                    },
                };
            });
        }
    }

    // Skills recommendation: analyze resume and suggest new skills
    async function generateSkillsRecommendations(force = false) {
        // Build comprehensive resume context for AI analysis
        const { photo, ...personalRest } = data.personal;
        const resumeContext = {
            personal: personalRest,
            experience: data.experience,
            education: data.education,
            currentSkills: data.skills.map(s => s.name),
            projects: data.projects,
        };

        const hash = safeJSONStringify(resumeContext);
        const prev = skillsRecommendationsRef.current;
        // Only regenerate when: force=true OR status is idle/error
        // This prevents re-triggering when user enters skills page after editing other pages
        if (!force && prev.status === 'loading') return;
        if (!force && prev.status === 'ready') return;

        const requestId = ++globalRequestIdRef.current;
        setSkillsRecommendations({
            status: 'loading',
            recommendations: [],
            sourceHash: hash,
            requestId,
        });

        const prompt = `基于用户的完整简历，分析其职业背景和已有技能，推荐 3-5 个能帮助其获得更多面试机会的技能。

【用户简历】
个人信息：${safeJSONStringify(personalRest)}
工作经历：${safeJSONStringify(data.experience)}
教育背景：${safeJSONStringify(data.education)}
现有技能：${data.skills.map(s => s.name).join(', ') || '暂无'}
项目经历：${safeJSONStringify(data.projects)}

请以 JSON 格式返回推荐：
\`\`\`json
{
  "message": "总体分析（一句话）",
  "recommendations": [
    {
      "name": "技能名称",
      "level": 3,
      "reason": "为什么这个技能能帮助获得面试（简短）",
      "relevance": "与用户背景的关联（简短）"
    }
  ]
}
\`\`\`

推荐原则：
1. 与用户职业方向高度相关
2. 当前就业市场需求高
3. 能补充现有技能组合的短板
4. 不要重复推荐用户已有的技能`;

        try {
            const response = await sendMessage([{ role: 'user', content: prompt }]);

            // Parse response
            const jsonMatch = response.match(/```json\s*([\s\S]*?)\s*```/);
            if (!jsonMatch) {
                setSkillsRecommendations(prev => {
                    if (prev.requestId !== requestId) return prev;
                    return { status: 'error', recommendations: [], error: 'AI 未返回有效的推荐格式', sourceHash: hash, requestId };
                });
                return;
            }

            const parsed = JSON.parse(jsonMatch[1]);
            if (!parsed.recommendations || !Array.isArray(parsed.recommendations)) {
                setSkillsRecommendations(prev => {
                    if (prev.requestId !== requestId) return prev;
                    return { status: 'error', recommendations: [], error: 'AI 返回的推荐格式不正确', sourceHash: hash, requestId };
                });
                return;
            }

            setSkillsRecommendations(prev => {
                if (prev.requestId !== requestId) return prev;
                return {
                    status: 'ready',
                    message: parsed.message || '',
                    recommendations: parsed.recommendations.map((r: SkillRecommendation) => ({
                        name: r.name || '',
                        level: r.level || 3,
                        reason: r.reason || '',
                        relevance: r.relevance || '',
                        added: false,
                        ignored: false,
                    })),
                    sourceHash: hash,
                    requestId,
                };
            });
        } catch (error) {
            setSkillsRecommendations(prev => {
                if (prev.requestId !== requestId) return prev;
                return {
                    status: 'error',
                    recommendations: [],
                    error: error instanceof Error ? error.message : 'AI 请求失败',
                    sourceHash: hash,
                    requestId,
                };
            });
        }
    }

    // Generate recommended new modules (for "其他信息" step's "AI 推荐添加")
    async function generateModuleRecommendations() {
        // Skip if already loading or ready
        if (moduleRecommendationsRef.current.status === 'loading' ||
            moduleRecommendationsRef.current.status === 'ready') {
            return;
        }

        setModuleRecommendations({ status: 'loading', recommendations: [] });

        try {
            const prompt = buildRecommendNewModulesPrompt(data);
            const response = await sendMessage([{ role: 'user', content: prompt }]);
            const parsed = parseRecommendResponse(response);

            if (parsed) {
                const existingModules = getExistingModules(data);
                const filtered = parsed.recommendations.filter(
                    r => !existingModules.includes(r.moduleType)
                );
                setModuleRecommendations({ status: 'ready', recommendations: filtered });
            } else {
                setModuleRecommendations({ status: 'error', recommendations: [], error: 'AI 返回格式错误' });
            }
        } catch (err) {
            setModuleRecommendations({
                status: 'error',
                recommendations: [],
                error: err instanceof Error ? err.message : '请求失败',
            });
        }
    }

    async function generateListSuggestions(step: 'experience' | 'education', force = false) {
        const items = step === 'experience' ? data.experience : data.education;
        const setCards = step === 'experience' ? setExperienceSuggestions : setEducationSuggestions;

        setCards((prev) => {
            const next: Record<string, SuggestionCard> = {};
            for (const item of items) {
                next[item.id] = prev[item.id] || { status: 'idle' };
            }
            return next;
        });

        const tasks: Array<() => Promise<void>> = items.map((item, index) => async () => {
            const itemId = item.id;
            if (!hasMeaningfulContent(item)) return;

            const hash = safeJSONStringify(item);
            const existing =
                step === 'experience'
                    ? experienceSuggestionsRef.current[itemId]
                    : educationSuggestionsRef.current[itemId];

            if (!force) {
                if (existing?.status === 'loading' && existing.sourceHash === hash) return;
                if (existing?.ignored) return;
                if (existing?.status === 'ready' && existing.sourceHash === hash && !existing.applied) return;
            }

            const requestId = ++globalRequestIdRef.current;
            setCards((prev) => ({
                ...prev,
                [itemId]: { status: 'loading', sourceHash: hash, requestId },
            }));

            try {
                const response = await sendMessage([{ role: 'user', content: buildPromptForListItem(step, index, item) }]);
                const parsed = parseStructuredSuggestion(response);
                if (!parsed.suggestion) {
                    setCards((prev) => {
                        if (prev[itemId]?.requestId !== requestId) return prev;
                        return {
                            ...prev,
                            [itemId]: {
                                status: 'error',
                                error: parsed.message || 'AI 未返回可应用的建议。',
                                sourceHash: hash,
                                requestId,
                            },
                        };
                    });
                    return;
                }

                const suggestion = parsed.suggestion;
                const rewritten = rewriteListFieldPath(step, itemId, suggestion.field);
                if (!rewritten) {
                    setCards((prev) => {
                        if (prev[itemId]?.requestId !== requestId) return prev;
                        return {
                            ...prev,
                            [itemId]: {
                                status: 'error',
                                error: `AI 返回的字段路径无效：${suggestion.field}`,
                                sourceHash: hash,
                                requestId,
                            },
                        };
                    });
                    return;
                }

                const before = getValueAtPath(data, rewritten);
                setCards((prev) => {
                    if (prev[itemId]?.requestId !== requestId) return prev;
                    return {
                        ...prev,
                        [itemId]: {
                            status: 'ready',
                            message: parsed.message,
                            field: rewritten,
                            fieldLabel: suggestion.fieldLabel || rewritten,
                            before,
                            after: suggestion.after,
                            reason: suggestion.reason,
                            sourceHash: hash,
                            requestId,
                        },
                    };
                });
            } catch (error) {
                setCards((prev) => {
                    if (prev[itemId]?.requestId !== requestId) return prev;
                    return {
                        ...prev,
                        [itemId]: {
                            status: 'error',
                            error: error instanceof Error ? error.message : 'AI 请求失败',
                            sourceHash: hash,
                            requestId,
                        },
                    };
                });
            }
        });

        await runWithConcurrency(tasks, 3);
    }

    // Generate suggestions for all items in additional step modules
    async function generateAdditionalSuggestions(force = false) {
        const moduleTypes: AdditionalModuleType[] = ['projects', 'certificates', 'awards', 'publications', 'hobbies'];

        // Collect all items from all modules
        const allItems: { moduleType: AdditionalModuleType; item: { id: string }; index: number }[] = [];
        for (const moduleType of moduleTypes) {
            const items = data[moduleType] as { id: string }[];
            items.forEach((item, index) => {
                allItems.push({ moduleType, item, index });
            });
        }

        // Initialize suggestions state
        setAdditionalSuggestions((prev) => {
            const next: Record<string, SuggestionCard> = {};
            for (const { moduleType, item } of allItems) {
                const key = `${moduleType}_${item.id}`;
                next[key] = prev[key] || { status: 'idle' };
            }
            return next;
        });

        // Build tasks for each item
        const tasks: Array<() => Promise<void>> = allItems.map(({ moduleType, item, index }) => async () => {
            const itemId = item.id;
            const key = `${moduleType}_${itemId}`;
            if (!hasMeaningfulContent(item)) return;

            const hash = safeJSONStringify(item);
            const existing = additionalSuggestionsRef.current[key];

            if (!force) {
                if (existing?.status === 'loading' && existing.sourceHash === hash) return;
                if (existing?.ignored) return;
                if (existing?.status === 'ready' && existing.sourceHash === hash && !existing.applied) return;
            }

            const requestId = ++globalRequestIdRef.current;
            setAdditionalSuggestions((prev) => ({
                ...prev,
                [key]: { status: 'loading', sourceHash: hash, requestId },
            }));

            try {
                const response = await sendMessage([{ role: 'user', content: buildPromptForAdditionalItem(moduleType, index, item) }]);
                const parsed = parseStructuredSuggestion(response);
                if (!parsed.suggestion) {
                    setAdditionalSuggestions((prev) => {
                        if (prev[key]?.requestId !== requestId) return prev;
                        return {
                            ...prev,
                            [key]: {
                                status: 'error',
                                error: parsed.message || 'AI 未返回可应用的建议。',
                                sourceHash: hash,
                                requestId,
                            },
                        };
                    });
                    return;
                }

                const suggestion = parsed.suggestion;
                const rewritten = rewriteAdditionalFieldPath(moduleType, itemId, suggestion.field);
                if (!rewritten) {
                    setAdditionalSuggestions((prev) => {
                        if (prev[key]?.requestId !== requestId) return prev;
                        return {
                            ...prev,
                            [key]: {
                                status: 'error',
                                error: `AI 返回的字段路径无效：${suggestion.field}`,
                                sourceHash: hash,
                                requestId,
                            },
                        };
                    });
                    return;
                }

                const before = getValueAtPath(data, rewritten);
                setAdditionalSuggestions((prev) => {
                    if (prev[key]?.requestId !== requestId) return prev;
                    return {
                        ...prev,
                        [key]: {
                            status: 'ready',
                            message: parsed.message,
                            field: rewritten,
                            fieldLabel: suggestion.fieldLabel || rewritten,
                            before,
                            after: suggestion.after,
                            reason: suggestion.reason,
                            sourceHash: hash,
                            requestId,
                        },
                    };
                });
            } catch (error) {
                setAdditionalSuggestions((prev) => {
                    if (prev[key]?.requestId !== requestId) return prev;
                    return {
                        ...prev,
                        [key]: {
                            status: 'error',
                            error: error instanceof Error ? error.message : 'AI 请求失败',
                            sourceHash: hash,
                            requestId,
                        },
                    };
                });
            }
        });

        await runWithConcurrency(tasks, 3);
    }

    async function runWithConcurrency<T>(tasks: Array<() => Promise<T>>, concurrency: number): Promise<void> {
        let index = 0;
        const workers = Array.from({ length: Math.max(1, concurrency) }, async () => {
            while (index < tasks.length) {
                const currentIndex = index++;
                try {
                    await tasks[currentIndex]();
                } catch {
                    // Individual tasks handle their own errors/state.
                }
            }
        });
        await Promise.all(workers);
    }

    function regenerateCurrentStep(force = true) {
        if (!force && autoOptimizePausedByStepRef.current[stepId]) return;
        if (stepId === 'finalize') return;
        if (stepId === 'experience') void generateListSuggestions('experience', force);
        else if (stepId === 'education') void generateListSuggestions('education', force);
        else if (stepId === 'additional') void generateAdditionalSuggestions(force);
        else if (stepId === 'skills') void generateSkillsRecommendations(force);
        else void generateSingleSuggestion(stepId, force);
    }

    function resetCurrentStepSuggestionState() {
        if (stepId === 'experience') {
            setExperienceSuggestions((prev) => {
                const next: Record<string, SuggestionCard> = {};
                for (const [id, card] of Object.entries(prev)) {
                    next[id] = { ...card, applied: false, ignored: false };
                }
                return next;
            });
            return;
        }
        if (stepId === 'education') {
            setEducationSuggestions((prev) => {
                const next: Record<string, SuggestionCard> = {};
                for (const [id, card] of Object.entries(prev)) {
                    next[id] = { ...card, applied: false, ignored: false };
                }
                return next;
            });
            return;
        }
        if (stepId === 'additional') {
            setAdditionalSuggestions((prev) => {
                const next: Record<string, SuggestionCard> = {};
                for (const [id, card] of Object.entries(prev)) {
                    next[id] = { ...card, applied: false, ignored: false };
                }
                return next;
            });
            return;
        }
        if (stepId === 'skills') {
            resetSkillsRecommendations();
            return;
        }

        setSingleStepSuggestions((prev) => ({
            ...prev,
            [stepId]: { ...prev[stepId], applied: false, ignored: false },
        }));
    }

    function acceptSuggestion(field: string, after: unknown) {
        onChange(applyValueAtPath(data, field, after));
    }

    function acceptSingleStepSuggestion(step: StepId) {
        const card = singleStepSuggestions[step];
        if (!card?.field || card.after === undefined) return;
        acceptSuggestion(card.field, card.after);
        setSingleStepSuggestions((prev) => ({ ...prev, [step]: { ...prev[step], applied: true } }));
        setAutoOptimizePausedByStep((prev) => ({ ...prev, [step]: true }));
    }

    function ignoreSingleStepSuggestion(step: StepId) {
        setSingleStepSuggestions((prev) => ({ ...prev, [step]: { ...prev[step], ignored: true } }));
    }

    function acceptListSuggestion(step: 'experience' | 'education', itemId: string) {
        const cards = step === 'experience' ? experienceSuggestions : educationSuggestions;
        const card = cards[itemId];
        if (!card?.field || card.after === undefined) return;
        acceptSuggestion(card.field, card.after);
        const setCards = step === 'experience' ? setExperienceSuggestions : setEducationSuggestions;
        setCards((prev) => ({ ...prev, [itemId]: { ...prev[itemId], applied: true } }));
        setAutoOptimizePausedByStep((prev) => ({ ...prev, [step]: true }));
    }

    function ignoreListSuggestion(step: 'experience' | 'education', itemId: string) {
        const setCards = step === 'experience' ? setExperienceSuggestions : setEducationSuggestions;
        setCards((prev) => ({ ...prev, [itemId]: { ...prev[itemId], ignored: true } }));
    }

    function acceptAdditionalSuggestion(key: string) {
        const card = additionalSuggestions[key];
        if (!card?.field || card.after === undefined) return;
        acceptSuggestion(card.field, card.after);
        setAdditionalSuggestions((prev) => ({ ...prev, [key]: { ...prev[key], applied: true } }));
        setAutoOptimizePausedByStep((prev) => ({ ...prev, additional: true }));
    }

    function ignoreAdditionalSuggestion(key: string) {
        setAdditionalSuggestions((prev) => ({ ...prev, [key]: { ...prev[key], ignored: true } }));
    }

    // Skills recommendation handlers
    function addRecommendedSkill(index: number) {
        const rec = skillsRecommendations.recommendations[index];
        if (!rec || rec.added) return;

        // Add the skill to data
        const newSkill = {
            id: Date.now().toString(),
            name: rec.name,
            level: rec.level,
            category: 'technical',
            icon: '',
            years: 0,
            subSkills: [],
        };
        onChange({ ...data, skills: [...data.skills, newSkill] });

        // Mark as added
        setSkillsRecommendations(prev => ({
            ...prev,
            recommendations: prev.recommendations.map((r, i) =>
                i === index ? { ...r, added: true } : r
            ),
        }));
        // Pause auto-refresh to prevent re-triggering AI when data changes
        setAutoOptimizePausedByStep(prev => ({ ...prev, skills: true }));
    }

    function ignoreSkillRecommendation(index: number) {
        setSkillsRecommendations(prev => ({
            ...prev,
            recommendations: prev.recommendations.map((r, i) =>
                i === index ? { ...r, ignored: true } : r
            ),
        }));
    }

    function resetSkillsRecommendations() {
        setSkillsRecommendations(prev => ({
            ...prev,
            recommendations: prev.recommendations.map(r => ({ ...r, added: false, ignored: false })),
        }));
    }

    useEffect(() => {
        if (!active) return;
        regenerateCurrentStep(false);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentStep]);

    useEffect(() => {
        // Prefetch all steps once, as soon as parsed data is available, to avoid waiting when entering each step.
        if (!active) return;
        if (hasPrefetchedRef.current) return;
        if (!hasMeaningfulContent(data)) return;

        const run = async () => {
            if (prefetchInFlightRef.current || hasPrefetchedRef.current) return;
            prefetchInFlightRef.current = true;
            try {
                const tasks: Array<() => Promise<void>> = [];
                // Personal info uses single suggestion
                tasks.push(() => generateSingleSuggestion('personal', false));
                // Skills uses dedicated recommendation function
                tasks.push(() => generateSkillsRecommendations(false));
                tasks.push(() => generateListSuggestions('experience', false));
                tasks.push(() => generateListSuggestions('education', false));
                tasks.push(() => generateAdditionalSuggestions(false));
                tasks.push(() => generateModuleRecommendations());
                await runWithConcurrency(tasks, 2);
                hasPrefetchedRef.current = true;
            } finally {
                prefetchInFlightRef.current = false;
            }
        };

        void run();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data]);

    useEffect(() => {
        if (!active) return;
        if (autoOptimizePausedByStepRef.current[stepId]) return;
        if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = window.setTimeout(() => {
            regenerateCurrentStep(false);
        }, 900);
        return () => {
            if (debounceTimerRef.current) window.clearTimeout(debounceTimerRef.current);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [data, currentStep]);

    return (
        <div className="step-wizard">
            {/* Left Sidebar - Progress */}
            <aside className="step-sidebar">
                <div className="step-sidebar-header">
                    <span className="step-logo">📄</span>
                    <span className="step-logo-text">简历优化</span>
                </div>

                <nav className="step-nav">
                    {steps.map((step, index) => {
                        const isCompleted = index < currentStep;
                        const isCurrent = index === currentStep;
                        const isLocked = index > currentStep;

                        return (
                            <button
                                key={step.id}
                                onClick={() => goToStep(index)}
                                disabled={isLocked}
                                className={`step-nav-item ${isCompleted ? 'completed' : ''} ${isCurrent ? 'current' : ''} ${isLocked ? 'locked' : ''}`}
                            >
                                <span className="step-indicator">
                                    {isCompleted ? (
                                        <svg className="step-check" viewBox="0 0 20 20" fill="currentColor">
                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                    ) : (
                                        <span className="step-number">{index + 1}</span>
                                    )}
                                </span>
                                <span className="step-label">{step.label}</span>

                                {/* Connector line */}
                                {index < steps.length - 1 && (
                                    <span className={`step-connector ${isCompleted ? 'completed' : ''}`} />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </aside>

            {/* Main Content */}
            <main ref={mainRef} className="step-main">
                {/* Header */}
                <header className="step-header">
                    <button onClick={goPrev} disabled={currentStep === 0} className="step-back-btn">
                        ← 返回
                    </button>
                    <div className="step-title-area">
                        <span className="step-icon-large">{steps[currentStep].icon}</span>
                        <h1 className="step-title">{steps[currentStep].label}</h1>
                    </div>
                </header>

                {/* Content Area */}
                <div className="step-content-wrapper">
                    {/* Form Area */}
                    <div className="step-form-area">
                        {currentStep === 0 && <PersonalInfoStep data={data} onChange={onChange} />}
                        {currentStep === 1 && <ExperienceStep data={data} onChange={onChange} />}
                        {currentStep === 2 && <EducationStep data={data} onChange={onChange} />}
                        {currentStep === 3 && <SkillsStep data={data} onChange={onChange} />}
                        {currentStep === 4 && <AdditionalStep data={data} onChange={onChange} prefetchedModuleRecommendations={moduleRecommendations} />}
                        {currentStep === 5 && <FinalizeStep data={data} />}
                    </div>

                    {/* AI Panel - not shown for finalize (additional now uses unified AI panel) */}
                    {stepId !== 'finalize' && (
                        <>
                            {/* Resize Handle */}
                            <div
                                onMouseDown={() => setResizingPanel('ai')}
                                className={`step-resize-handle ${resizingPanel === 'ai' ? 'active' : ''}`}
                            />

                            {/* AI Suggestions */}
                            <aside className="step-ai-area" style={{ width: aiWidth }}>
                                <div className="ai-card">
                                    <div className="ai-card-header">
                                        <span className="ai-icon">✨</span>
                                        <span className="ai-title">AI 建议</span>
                                    </div>
                                    <div className="ai-card-content">
                                        {stepId === 'experience' || stepId === 'education' ? (
                                            <div className="ai-suggestion-list">
                                                {(stepId === 'experience' ? data.experience : data.education).length === 0 ? (
                                                    <p className="ai-suggestion">添加记录后，会自动生成对应的优化建议。</p>
                                                ) : (
                                                    (stepId === 'experience' ? data.experience : data.education).map((item, i) => {
                                                        const card = listCards[item.id] || { status: 'idle' };
                                                        const itemTitle =
                                                            stepId === 'experience'
                                                                ? `工作经历 ${i + 1}${((item as any).company || (item as any).position) ? ` · ${(item as any).company || (item as any).position}` : ''}`
                                                                : `教育背景 ${i + 1}${((item as any).institution) ? ` · ${(item as any).institution}` : ''}`;

                                                        if (card.applied) {
                                                            return (
                                                                <div key={item.id} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>✅ {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion">已应用修改。</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (card.ignored) {
                                                            return (
                                                                <div key={item.id} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>🙈 {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion">已忽略该条建议。</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (card.status === 'loading' || card.status === 'idle') {
                                                            return (
                                                                <div key={item.id} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>📝 {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion">⏳ 正在生成建议...</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (card.status === 'error') {
                                                            return (
                                                                <div key={item.id} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>⚠️ {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion" style={{ whiteSpace: 'pre-wrap' }}>
                                                                        {card.error || '生成失败'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div key={item.id} className="ai-suggestion-card">
                                                                <div className="suggestion-header">
                                                                    <strong>📝 {itemTitle} · {card.fieldLabel || ''}</strong>
                                                                </div>
                                                                <div className="suggestion-before">
                                                                    <span className="label">修改前：</span>
                                                                    <span className="content">{safeJSONStringify(card.before || '(空)')}</span>
                                                                </div>
                                                                <div className="suggestion-after">
                                                                    <span className="label">修改后：</span>
                                                                    <span className="content">{safeJSONStringify(card.after || '')}</span>
                                                                </div>
                                                                <div className="suggestion-reason">
                                                                    <span className="label">理由：</span>
                                                                    <span className="content">{card.reason || card.message || ''}</span>
                                                                </div>
                                                                <div className="suggestion-actions">
                                                                    <button
                                                                        className="btn-accept"
                                                                        onClick={() => acceptListSuggestion(stepId as 'experience' | 'education', item.id)}
                                                                    >
                                                                        ✅ 接受修改
                                                                    </button>
                                                                    <button
                                                                        className="btn-ignore"
                                                                        onClick={() => ignoreListSuggestion(stepId as 'experience' | 'education', item.id)}
                                                                    >
                                                                        忽略
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })
                                                )}
                                            </div>
                                        ) : stepId === 'skills' ? (
                                            /* Skills Recommendations UI */
                                            <div className="ai-suggestion-list">
                                                {skillsRecommendations.status === 'loading' ? (
                                                    <div className="ai-suggestion-card">
                                                        <p className="ai-suggestion">⏳ 正在分析简历并生成技能推荐...</p>
                                                    </div>
                                                ) : skillsRecommendations.status === 'error' ? (
                                                    <div className="ai-suggestion-card">
                                                        <p className="ai-suggestion" style={{ color: '#ef4444' }}>
                                                            ⚠️ {skillsRecommendations.error || '生成推荐失败'}
                                                        </p>
                                                    </div>
                                                ) : skillsRecommendations.recommendations.length === 0 ? (
                                                    <p className="ai-suggestion">暂无推荐。完善简历内容后，AI 会分析您的背景并推荐相关技能。</p>
                                                ) : (
                                                    <>
                                                        {skillsRecommendations.message && (
                                                            <p className="ai-suggestion" style={{ marginBottom: '16px', fontStyle: 'italic' }}>
                                                                💡 {skillsRecommendations.message}
                                                            </p>
                                                        )}
                                                        {skillsRecommendations.recommendations.map((rec, index) => {
                                                            if (rec.added) {
                                                                return (
                                                                    <div key={index} className="ai-suggestion-card">
                                                                        <div className="suggestion-header">
                                                                            <strong>✅ {rec.name}</strong>
                                                                        </div>
                                                                        <p className="ai-suggestion">已添加到技能列表。</p>
                                                                    </div>
                                                                );
                                                            }
                                                            if (rec.ignored) {
                                                                return (
                                                                    <div key={index} className="ai-suggestion-card" style={{ opacity: 0.5 }}>
                                                                        <div className="suggestion-header">
                                                                            <strong>🙈 {rec.name}</strong>
                                                                        </div>
                                                                        <p className="ai-suggestion">已忽略该推荐。</p>
                                                                    </div>
                                                                );
                                                            }
                                                            return (
                                                                <div key={index} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>🎯 推荐添加：{rec.name}</strong>
                                                                        <span style={{ marginLeft: '8px', color: '#6b7280', fontSize: '12px' }}>
                                                                            熟练度 {rec.level}/5
                                                                        </span>
                                                                    </div>
                                                                    <div className="suggestion-reason">
                                                                        <span className="label">推荐理由：</span>
                                                                        <span className="content">{rec.reason}</span>
                                                                    </div>
                                                                    <div className="suggestion-after">
                                                                        <span className="label">关联性：</span>
                                                                        <span className="content">{rec.relevance}</span>
                                                                    </div>
                                                                    <div className="suggestion-actions">
                                                                        <button
                                                                            className="btn-accept"
                                                                            onClick={() => addRecommendedSkill(index)}
                                                                        >
                                                                            + 添加到列表
                                                                        </button>
                                                                        <button
                                                                            className="btn-ignore"
                                                                            onClick={() => ignoreSkillRecommendation(index)}
                                                                        >
                                                                            忽略
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            );
                                                        })}
                                                    </>
                                                )}
                                            </div>
                                        ) : stepId === 'additional' ? (
                                            <div className="ai-suggestion-list">
                                                {(() => {
                                                    const moduleTypes: AdditionalModuleType[] = ['projects', 'certificates', 'awards', 'publications', 'hobbies'];
                                                    const allItems = moduleTypes.flatMap(moduleType =>
                                                        (data[moduleType] as { id: string }[]).map((item, index) => ({
                                                            moduleType,
                                                            item,
                                                            index,
                                                            key: `${moduleType}_${item.id}`,
                                                        }))
                                                    );

                                                    if (allItems.length === 0) {
                                                        return <p className="ai-suggestion">添加内容后，会自动生成对应的优化建议。</p>;
                                                    }

                                                    return allItems.map(({ moduleType, item, index, key }) => {
                                                        const card = additionalSuggestions[key] || { status: 'idle' };
                                                        const moduleLabel = ADDITIONAL_MODULE_LABELS[moduleType];
                                                        const itemTitle = `${moduleLabel} ${index + 1}`;

                                                        if (card.applied) {
                                                            return (
                                                                <div key={key} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>✅ {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion">已应用修改。</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (card.ignored) {
                                                            return (
                                                                <div key={key} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>🙈 {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion">已忽略该条建议。</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (card.status === 'loading' || card.status === 'idle') {
                                                            return (
                                                                <div key={key} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>📝 {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion">⏳ 正在生成建议...</p>
                                                                </div>
                                                            );
                                                        }

                                                        if (card.status === 'error') {
                                                            return (
                                                                <div key={key} className="ai-suggestion-card">
                                                                    <div className="suggestion-header">
                                                                        <strong>⚠️ {itemTitle}</strong>
                                                                    </div>
                                                                    <p className="ai-suggestion" style={{ whiteSpace: 'pre-wrap' }}>
                                                                        {card.error || '生成失败'}
                                                                    </p>
                                                                </div>
                                                            );
                                                        }

                                                        return (
                                                            <div key={key} className="ai-suggestion-card">
                                                                <div className="suggestion-header">
                                                                    <strong>📝 {itemTitle} · {card.fieldLabel || ''}</strong>
                                                                </div>
                                                                <div className="suggestion-before">
                                                                    <span className="label">修改前：</span>
                                                                    <span className="content">{safeJSONStringify(card.before || '(空)')}</span>
                                                                </div>
                                                                <div className="suggestion-after">
                                                                    <span className="label">修改后：</span>
                                                                    <span className="content">{safeJSONStringify(card.after || '')}</span>
                                                                </div>
                                                                <div className="suggestion-reason">
                                                                    <span className="label">理由：</span>
                                                                    <span className="content">{card.reason || card.message || ''}</span>
                                                                </div>
                                                                <div className="suggestion-actions">
                                                                    <button
                                                                        className="btn-accept"
                                                                        onClick={() => acceptAdditionalSuggestion(key)}
                                                                    >
                                                                        ✅ 接受修改
                                                                    </button>
                                                                    <button
                                                                        className="btn-ignore"
                                                                        onClick={() => ignoreAdditionalSuggestion(key)}
                                                                    >
                                                                        忽略
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    });
                                                })()}
                                            </div>
                                        ) : singleCard?.applied ? (
                                            <div className="ai-suggestion-applied">
                                                <p>✅ 已应用修改到表单！</p>
                                            </div>
                                        ) : singleCard?.ignored ? (
                                            <p className="ai-suggestion">已忽略该条建议。</p>
                                        ) : singleCard?.status === 'error' ? (
                                            <p className="ai-suggestion" style={{ whiteSpace: 'pre-wrap' }}>
                                                {singleCard.error || '生成失败'}
                                            </p>
                                        ) : singleCard?.status === 'ready' ? (
                                            <div className="ai-suggestion-card">
                                                <div className="suggestion-header">
                                                    <strong>📝 {singleCard.fieldLabel}</strong>
                                                </div>
                                                <div className="suggestion-before">
                                                    <span className="label">修改前：</span>
                                                    <span className="content">{safeJSONStringify(singleCard.before || '(空)')}</span>
                                                </div>
                                                <div className="suggestion-after">
                                                    <span className="label">修改后：</span>
                                                    <span className="content">{safeJSONStringify(singleCard.after || '')}</span>
                                                </div>
                                                <div className="suggestion-reason">
                                                    <span className="label">理由：</span>
                                                    <span className="content">{singleCard.reason || singleCard.message || ''}</span>
                                                </div>
                                                <div className="suggestion-actions">
                                                    <button className="btn-accept" onClick={() => acceptSingleStepSuggestion(stepId)}>
                                                        ✅ 接受修改
                                                    </button>
                                                    <button className="btn-ignore" onClick={() => ignoreSingleStepSuggestion(stepId)}>
                                                        忽略
                                                    </button>
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="ai-suggestion">⏳ 正在生成建议...</p>
                                        )}
                                    </div>
                                    <button
                                        className="ai-action-btn"
                                        onClick={() => {
                                            setAutoOptimizePausedByStep((prev) => ({ ...prev, [stepId]: false }));
                                            resetCurrentStepSuggestionState();
                                            regenerateCurrentStep(true);
                                        }}
                                        disabled={
                                            stepId === 'experience'
                                                ? Object.values(experienceSuggestions).some((c) => c.status === 'loading')
                                                : stepId === 'education'
                                                    ? Object.values(educationSuggestions).some((c) => c.status === 'loading')
                                                    : stepId === 'additional'
                                                        ? Object.values(additionalSuggestions).some((c) => c.status === 'loading')
                                                        : stepId === 'skills'
                                                            ? skillsRecommendations.status === 'loading'
                                                            : singleCard?.status === 'loading'
                                        }
                                    >
                                        {stepId === 'experience'
                                            ? Object.values(experienceSuggestions).some((c) => c.status === 'loading')
                                                ? '⏳ 生成中...'
                                                : '🔄 重新生成'
                                            : stepId === 'education'
                                                ? Object.values(educationSuggestions).some((c) => c.status === 'loading')
                                                    ? '⏳ 生成中...'
                                                    : '🔄 重新生成'
                                                : stepId === 'additional'
                                                    ? Object.values(additionalSuggestions).some((c) => c.status === 'loading')
                                                        ? '⏳ 生成中...'
                                                        : '🔄 重新生成'
                                                    : stepId === 'skills'
                                                        ? skillsRecommendations.status === 'loading'
                                                            ? '⏳ 生成中...'
                                                            : '🔄 重新分析'
                                                        : singleCard?.status === 'loading'
                                                            ? '⏳ 生成中...'
                                                            : '🔄 重新生成'}
                                    </button>
                                </div>
                            </aside>
                        </>
                    )}
                </div>

                {/* Footer */}
                <footer className="step-footer">
                    <button onClick={goPrev} className="btn-secondary" disabled={currentStep === 0}>
                        上一步
                    </button>
                    <button onClick={goNext} className="btn-primary">
                        {currentStep === steps.length - 1 ? '完成' : '下一步'}
                    </button>
                </footer>
            </main>
        </div>
    );
}

// ============================================================================
// Step Components
// ============================================================================

function PersonalInfoStep({ data, onChange }: { data: ResumeData; onChange: (d: ResumeData) => void }) {
    const update = (key: keyof typeof data.personal, value: string) => {
        onChange({ ...data, personal: { ...data.personal, [key]: value } });
    };

    return (
        <div className="form-section">
            <div className="form-grid-2">
                <div className="form-group">
                    <label className="form-label">姓名 <span className="required">*</span></label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="张三"
                        value={data.personal.name}
                        onChange={(e) => update('name', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">职位/头衔 <span className="required">*</span></label>
                    <input
                        type="text"
                        className="form-input"
                        placeholder="前端工程师"
                        value={data.personal.title}
                        onChange={(e) => update('title', e.target.value)}
                    />
                </div>
            </div>

            <div className="form-grid-2">
                <div className="form-group">
                    <label className="form-label">邮箱</label>
                    <input
                        type="email"
                        className="form-input"
                        placeholder="your@email.com"
                        value={data.personal.email}
                        onChange={(e) => update('email', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">电话</label>
                    <input
                        type="tel"
                        className="form-input"
                        placeholder="+86 138 0000 0000"
                        value={data.personal.phone}
                        onChange={(e) => update('phone', e.target.value)}
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">地址</label>
                <input
                    type="text"
                    className="form-input"
                    placeholder="北京市朝阳区xxx街道"
                    value={data.personal.address}
                    onChange={(e) => update('address', e.target.value)}
                />
            </div>

            <div className="form-grid-2">
                <div className="form-group">
                    <label className="form-label">个人网站</label>
                    <input
                        type="url"
                        className="form-input"
                        placeholder="https://yourwebsite.com"
                        value={data.personal.website}
                        onChange={(e) => update('website', e.target.value)}
                    />
                </div>
                <div className="form-group">
                    <label className="form-label">头像照片</label>
                    <PhotoUpload
                        value={data.personal.photo || ''}
                        onChange={(v) => update('photo', v)}
                    />
                </div>
            </div>

            <div className="form-group">
                <label className="form-label">个人简介</label>
                <textarea
                    className="form-textarea"
                    placeholder="简要介绍自己的职业背景和核心优势..."
                    rows={4}
                    value={data.personal.summary}
                    onChange={(e) => update('summary', e.target.value)}
                />
            </div>
        </div>
    );
}

function ExperienceStep({ data, onChange }: { data: ResumeData; onChange: (d: ResumeData) => void }) {
    const addExperience = () => {
        onChange({
            ...data,
            experience: [
                ...data.experience,
                {
                    id: Date.now().toString(),
                    company: '',
                    position: '',
                    location: '',
                    startDate: '',
                    endDate: '',
                    current: false,
                    description: '',
                    highlights: [],
                },
            ],
        });
    };

    const updateExperience = (index: number, updates: Partial<typeof data.experience[0]>) => {
        const newExp = [...data.experience];
        newExp[index] = { ...newExp[index], ...updates };
        onChange({ ...data, experience: newExp });
    };

    const removeExperience = (index: number) => {
        onChange({ ...data, experience: data.experience.filter((_, i) => i !== index) });
    };

    return (
        <div className="form-section">
            {data.experience.map((exp, i) => (
                <div key={exp.id} className="form-card">
                    <div className="form-card-header">
                        <span className="form-card-title">工作经历 {i + 1}</span>
                        <button onClick={() => removeExperience(i)} className="form-card-remove">
                            删除
                        </button>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">公司名称</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="公司全称"
                                value={exp.company}
                                onChange={(e) => updateExperience(i, { company: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">职位</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="你的职位"
                                value={exp.position}
                                onChange={(e) => updateExperience(i, { position: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-grid-3">
                        <div className="form-group">
                            <label className="form-label">开始时间</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="2020-01"
                                value={exp.startDate}
                                onChange={(e) => updateExperience(i, { startDate: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">结束时间</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="2023-12 或 至今"
                                value={exp.endDate}
                                disabled={exp.current}
                                onChange={(e) => updateExperience(i, { endDate: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">地点</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="北京"
                                value={exp.location}
                                onChange={(e) => updateExperience(i, { location: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">工作描述</label>
                        <textarea
                            className="form-textarea"
                            placeholder="描述你的主要职责和成就..."
                            rows={3}
                            value={exp.description}
                            onChange={(e) => updateExperience(i, { description: e.target.value })}
                        />
                    </div>
                </div>
            ))}

            <button onClick={addExperience} className="btn-add">
                + 添加工作经历
            </button>
        </div>
    );
}

function EducationStep({ data, onChange }: { data: ResumeData; onChange: (d: ResumeData) => void }) {
    const addEducation = () => {
        onChange({
            ...data,
            education: [
                ...data.education,
                {
                    id: Date.now().toString(),
                    institution: '',
                    degree: '',
                    field: '',
                    location: '',
                    startDate: '',
                    endDate: '',
                    gpa: '',
                    description: '',
                    courses: [],
                },
            ],
        });
    };

    const updateEducation = (index: number, updates: Partial<typeof data.education[0]>) => {
        const newEdu = [...data.education];
        newEdu[index] = { ...newEdu[index], ...updates };
        onChange({ ...data, education: newEdu });
    };

    const removeEducation = (index: number) => {
        onChange({ ...data, education: data.education.filter((_, i) => i !== index) });
    };

    return (
        <div className="form-section">
            {data.education.map((edu, i) => (
                <div key={edu.id} className="form-card">
                    <div className="form-card-header">
                        <span className="form-card-title">教育背景 {i + 1}</span>
                        <button onClick={() => removeEducation(i)} className="form-card-remove">
                            删除
                        </button>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">学校名称</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="大学名称"
                                value={edu.institution}
                                onChange={(e) => updateEducation(i, { institution: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">学位</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="学士/硕士/博士"
                                value={edu.degree}
                                onChange={(e) => updateEducation(i, { degree: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="form-grid-2">
                        <div className="form-group">
                            <label className="form-label">专业</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="计算机科学"
                                value={edu.field}
                                onChange={(e) => updateEducation(i, { field: e.target.value })}
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">时间</label>
                            <input
                                type="text"
                                className="form-input"
                                placeholder="2016 - 2020"
                                value={`${edu.startDate}${edu.endDate ? ' - ' + edu.endDate : ''}`}
                                onChange={(e) => {
                                    const parts = e.target.value.split(' - ');
                                    updateEducation(i, { startDate: parts[0] || '', endDate: parts[1] || '' });
                                }}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">描述</label>
                        <textarea
                            className="form-textarea"
                            placeholder="相关课程、学术成就等..."
                            rows={2}
                            value={edu.description}
                            onChange={(e) => updateEducation(i, { description: e.target.value })}
                        />
                    </div>
                </div>
            ))}

            <button onClick={addEducation} className="btn-add">
                + 添加教育背景
            </button>
        </div>
    );
}

function SkillsStep({ data, onChange }: { data: ResumeData; onChange: (d: ResumeData) => void }) {
    const addSkill = () => {
        onChange({
            ...data,
            skills: [
                ...data.skills,
                { id: Date.now().toString(), name: '', level: 3, category: 'technical', icon: '📌', years: 0, subSkills: [] },
            ],
        });
    };

    const updateSkill = (index: number, updates: Partial<typeof data.skills[0]>) => {
        const newSkills = [...data.skills];
        newSkills[index] = { ...newSkills[index], ...updates };
        onChange({ ...data, skills: newSkills });
    };

    const removeSkill = (index: number) => {
        onChange({ ...data, skills: data.skills.filter((_, i) => i !== index) });
    };

    const addLanguage = () => {
        onChange({
            ...data,
            languages: [
                ...data.languages,
                { id: Date.now().toString(), name: '', level: 'intermediate', levelNumber: 3, flag: '🏳️' },
            ],
        });
    };

    const updateLanguage = (index: number, updates: Partial<typeof data.languages[0]>) => {
        const newLangs = [...data.languages];
        newLangs[index] = { ...newLangs[index], ...updates };
        onChange({ ...data, languages: newLangs });
    };

    return (
        <div className="form-section">
            <h3 className="form-section-title">技能列表</h3>

            {data.skills.map((skill, i) => (
                <div key={skill.id} className="form-row">
                    <input
                        type="text"
                        className="form-input flex-1"
                        placeholder="技能名称"
                        value={skill.name}
                        onChange={(e) => updateSkill(i, { name: e.target.value })}
                    />
                    <select
                        className="form-select"
                        value={skill.level}
                        onChange={(e) => updateSkill(i, { level: parseInt(e.target.value) })}
                    >
                        <option value={1}>初级</option>
                        <option value={2}>基础</option>
                        <option value={3}>熟练</option>
                        <option value={4}>精通</option>
                        <option value={5}>专家</option>
                    </select>
                    <button onClick={() => removeSkill(i)} className="btn-remove">✕</button>
                </div>
            ))}

            <button onClick={addSkill} className="btn-add">
                + 添加技能
            </button>

            <h3 className="form-section-title" style={{ marginTop: '2rem' }}>语言能力</h3>

            {data.languages.map((lang, i) => (
                <div key={lang.id} className="form-row">
                    <input
                        type="text"
                        className="form-input-small"
                        placeholder="🇨🇳"
                        value={lang.flag}
                        onChange={(e) => updateLanguage(i, { flag: e.target.value })}
                    />
                    <input
                        type="text"
                        className="form-input flex-1"
                        placeholder="语言名称"
                        value={lang.name}
                        onChange={(e) => updateLanguage(i, { name: e.target.value })}
                    />
                    <select
                        className="form-select"
                        value={lang.levelNumber}
                        onChange={(e) => updateLanguage(i, { levelNumber: parseInt(e.target.value) })}
                    >
                        <option value={1}>入门</option>
                        <option value={2}>基础</option>
                        <option value={3}>中级</option>
                        <option value={4}>流利</option>
                        <option value={5}>母语</option>
                    </select>
                </div>
            ))}

            <button onClick={addLanguage} className="btn-add">
                + 添加语言
            </button>
        </div>
    );
}




function FinalizeStep({ data }: { data: ResumeData }) {
    return (
        <div className="form-section finalize-section">
            <div className="finalize-icon">🎉</div>
            <h2 className="finalize-title">太棒了！你的简历已准备就绪</h2>
            <p className="finalize-description">
                点击"完成"进入编辑器，你可以：
            </p>
            <ul className="finalize-list">
                <li>✓ 预览不同的模板样式</li>
                <li>✓ 微调内容和格式</li>
                <li>✓ 与 AI 助手对话优化</li>
                <li>✓ 导出高质量 PDF</li>
            </ul>

            <div className="finalize-summary">
                <div className="summary-item">
                    <span className="summary-label">姓名</span>
                    <span className="summary-value">{data.personal.name || '未填写'}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">职位</span>
                    <span className="summary-value">{data.personal.title || '未填写'}</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">工作经历</span>
                    <span className="summary-value">{data.experience.length} 条</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">教育背景</span>
                    <span className="summary-value">{data.education.length} 条</span>
                </div>
                <div className="summary-item">
                    <span className="summary-label">技能</span>
                    <span className="summary-value">{data.skills.length} 项</span>
                </div>
            </div>
        </div>
    );
}
