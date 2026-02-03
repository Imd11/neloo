/**
 * AdditionalStep - "其他信息" step
 * Left side: Form for existing modules + AI recommended new modules
 * Right side: AI suggestions handled by StepWizard (same as other steps)
 */
import { useState, useEffect, useMemo, useRef } from 'react';
import type { ResumeData, Project, Certificate, Award, Publication, Hobby } from '../types/resume';
import { createId } from '../types/resume';
import { sendMessage } from '../lib/deepseek';
import {
    buildRecommendNewModulesPrompt,
    parseRecommendResponse,
    getExistingModules,
    MODULE_LABELS,
    MODULE_ICONS,
    type ModuleKey,
    type NewModuleRecommendation,
} from '../lib/additionalStepAI';
import './AdditionalStep.css';

interface AdditionalStepProps {
    data: ResumeData;
    onChange: (data: ResumeData) => void;
    prefetchedModuleRecommendations?: {
        status: 'idle' | 'loading' | 'ready' | 'error';
        recommendations: NewModuleRecommendation[];
        error?: string;
    };
}

type RecommendState = {
    status: 'idle' | 'loading' | 'ready' | 'error';
    recommendations: NewModuleRecommendation[];
    error: string | null;
};

export function AdditionalStep({ data, onChange, prefetchedModuleRecommendations }: AdditionalStepProps) {
    const [expandedModules, setExpandedModules] = useState<Set<ModuleKey>>(new Set());
    const [recommendState, setRecommendState] = useState<RecommendState>({
        status: 'idle',
        recommendations: [],
        error: null,
    });
    const [acceptedModules, setAcceptedModules] = useState<Set<ModuleKey>>(new Set());

    // Compute existing modules from resume data
    const existingModules = useMemo(() => getExistingModules(data), [data]);

    // Auto-expand existing modules ONLY on first mount (not when existingModules changes)
    const hasInitializedExpandedRef = useRef(false);
    useEffect(() => {
        if (!hasInitializedExpandedRef.current && existingModules.length > 0) {
            setExpandedModules(new Set(existingModules));
            hasInitializedExpandedRef.current = true;
        }
    }, [existingModules]);

    // Use prefetched recommendations if available, otherwise fetch on mount
    useEffect(() => {
        // If we have prefetched data, use it
        if (prefetchedModuleRecommendations) {
            if (prefetchedModuleRecommendations.status === 'ready') {
                // Filter out modules that already exist
                const filtered = prefetchedModuleRecommendations.recommendations.filter(
                    r => !existingModules.includes(r.moduleType)
                );
                setRecommendState({ status: 'ready', recommendations: filtered, error: null });
            } else if (prefetchedModuleRecommendations.status === 'loading') {
                setRecommendState({ status: 'loading', recommendations: [], error: null });
            } else if (prefetchedModuleRecommendations.status === 'error') {
                setRecommendState({
                    status: 'error',
                    recommendations: [],
                    error: prefetchedModuleRecommendations.error || '加载失败',
                });
            }
            return;
        }

        // Fallback: fetch if no prefetched data and still idle
        if (recommendState.status !== 'idle') return;

        const fetchRecommendations = async () => {
            setRecommendState({ status: 'loading', recommendations: [], error: null });

            try {
                const prompt = buildRecommendNewModulesPrompt(data);
                const response = await sendMessage([{ role: 'user', content: prompt }]);
                const parsed = parseRecommendResponse(response);

                if (parsed) {
                    const filtered = parsed.recommendations.filter(
                        r => !existingModules.includes(r.moduleType)
                    );
                    setRecommendState({ status: 'ready', recommendations: filtered, error: null });
                } else {
                    setRecommendState({ status: 'error', recommendations: [], error: 'AI 返回格式错误' });
                }
            } catch (err) {
                setRecommendState({
                    status: 'error',
                    recommendations: [],
                    error: err instanceof Error ? err.message : '请求失败',
                });
            }
        };

        fetchRecommendations();
    }, [data, existingModules, recommendState.status, prefetchedModuleRecommendations]);


    // Toggle module expansion
    const toggleExpanded = (module: ModuleKey) => {
        setExpandedModules(prev => {
            const next = new Set(prev);
            if (next.has(module)) {
                next.delete(module);
            } else {
                next.add(module);
            }
            return next;
        });
    };

    // Accept AI recommendation
    const acceptRecommendation = (recommendation: NewModuleRecommendation) => {
        const { moduleType, suggestedContent } = recommendation;
        const currentData = data[moduleType] as any[];
        const newData = [...currentData, ...suggestedContent];

        onChange({
            ...data,
            [moduleType]: newData,
            sectionVisibility: {
                ...data.sectionVisibility,
                [moduleType]: true,
            },
        });

        setAcceptedModules(prev => new Set(prev).add(moduleType));
        setExpandedModules(prev => new Set(prev).add(moduleType));
    };

    // =========================================================================
    // Update handlers for each module
    // =========================================================================

    const updateProject = (id: string, updates: Partial<Project>) => {
        onChange({
            ...data,
            projects: data.projects.map(p => p.id === id ? { ...p, ...updates } : p),
        });
    };
    const removeProject = (id: string) => {
        onChange({ ...data, projects: data.projects.filter(p => p.id !== id) });
    };
    const addProject = () => {
        onChange({
            ...data,
            projects: [...data.projects, {
                id: createId(), name: '', role: '', organization: '',
                startDate: '', endDate: '', description: '', highlights: [], technologies: [], url: '',
            }],
        });
    };

    const updateCertificate = (id: string, updates: Partial<Certificate>) => {
        onChange({
            ...data,
            certificates: data.certificates.map(c => c.id === id ? { ...c, ...updates } : c),
        });
    };
    const removeCertificate = (id: string) => {
        onChange({ ...data, certificates: data.certificates.filter(c => c.id !== id) });
    };
    const addCertificate = () => {
        onChange({
            ...data,
            certificates: [...data.certificates, {
                id: createId(), name: '', issuer: '', date: '', expiryDate: '', credentialId: '', url: '',
            }],
        });
    };

    const updateAward = (id: string, updates: Partial<Award>) => {
        onChange({
            ...data,
            awards: data.awards.map(a => a.id === id ? { ...a, ...updates } : a),
        });
    };
    const removeAward = (id: string) => {
        onChange({ ...data, awards: data.awards.filter(a => a.id !== id) });
    };
    const addAward = () => {
        onChange({
            ...data,
            awards: [...data.awards, { id: createId(), title: '', issuer: '', date: '', description: '' }],
        });
    };

    const updatePublication = (id: string, updates: Partial<Publication>) => {
        onChange({
            ...data,
            publications: data.publications.map(p => p.id === id ? { ...p, ...updates } : p),
        });
    };
    const removePublication = (id: string) => {
        onChange({ ...data, publications: data.publications.filter(p => p.id !== id) });
    };
    const addPublication = () => {
        onChange({
            ...data,
            publications: [...data.publications, {
                id: createId(), title: '', authors: '', publisher: '', date: '', url: '', description: '',
            }],
        });
    };

    const updateHobby = (id: string, updates: Partial<Hobby>) => {
        onChange({
            ...data,
            hobbies: data.hobbies.map(h => h.id === id ? { ...h, ...updates } : h),
        });
    };
    const removeHobby = (id: string) => {
        onChange({ ...data, hobbies: data.hobbies.filter(h => h.id !== id) });
    };
    const addHobby = () => {
        onChange({
            ...data,
            hobbies: [...data.hobbies, { id: createId(), name: '', icon: '', description: '' }],
        });
    };

    // =========================================================================
    // Render module form
    // =========================================================================

    const renderModuleForm = (moduleKey: ModuleKey) => {
        switch (moduleKey) {
            case 'projects':
                return (
                    <div className="module-items">
                        {data.projects.map((project) => (
                            <div key={project.id} className="module-item">
                                <div className="item-row">
                                    <input type="text" placeholder="项目名称" value={project.name}
                                        onChange={e => updateProject(project.id, { name: e.target.value })} className="form-input" />
                                    <input type="text" placeholder="角色" value={project.role}
                                        onChange={e => updateProject(project.id, { role: e.target.value })} className="form-input small" />
                                    <button className="btn-remove" onClick={() => removeProject(project.id)}>✕</button>
                                </div>
                                <div className="item-row">
                                    <input type="text" placeholder="起始时间" value={project.startDate}
                                        onChange={e => updateProject(project.id, { startDate: e.target.value })} className="form-input small" />
                                    <span>-</span>
                                    <input type="text" placeholder="结束时间" value={project.endDate}
                                        onChange={e => updateProject(project.id, { endDate: e.target.value })} className="form-input small" />
                                </div>
                                <textarea placeholder="项目描述" value={project.description}
                                    onChange={e => updateProject(project.id, { description: e.target.value })} className="form-textarea" rows={2} />
                            </div>
                        ))}
                        <button className="btn-add" onClick={addProject}>+ 添加项目</button>
                    </div>
                );
            case 'certificates':
                return (
                    <div className="module-items">
                        {data.certificates.map((cert) => (
                            <div key={cert.id} className="module-item">
                                <div className="item-row">
                                    <input type="text" placeholder="证书名称" value={cert.name}
                                        onChange={e => updateCertificate(cert.id, { name: e.target.value })} className="form-input" />
                                    <input type="text" placeholder="颁发机构" value={cert.issuer}
                                        onChange={e => updateCertificate(cert.id, { issuer: e.target.value })} className="form-input" />
                                    <button className="btn-remove" onClick={() => removeCertificate(cert.id)}>✕</button>
                                </div>
                                <input type="text" placeholder="获得日期" value={cert.date}
                                    onChange={e => updateCertificate(cert.id, { date: e.target.value })} className="form-input small" />
                            </div>
                        ))}
                        <button className="btn-add" onClick={addCertificate}>+ 添加证书</button>
                    </div>
                );
            case 'awards':
                return (
                    <div className="module-items">
                        {data.awards.map((award) => (
                            <div key={award.id} className="module-item">
                                <div className="item-row">
                                    <input type="text" placeholder="奖项名称" value={award.title}
                                        onChange={e => updateAward(award.id, { title: e.target.value })} className="form-input" />
                                    <input type="text" placeholder="颁发机构" value={award.issuer}
                                        onChange={e => updateAward(award.id, { issuer: e.target.value })} className="form-input" />
                                    <button className="btn-remove" onClick={() => removeAward(award.id)}>✕</button>
                                </div>
                                <input type="text" placeholder="获奖日期" value={award.date}
                                    onChange={e => updateAward(award.id, { date: e.target.value })} className="form-input small" />
                            </div>
                        ))}
                        <button className="btn-add" onClick={addAward}>+ 添加奖项</button>
                    </div>
                );
            case 'publications':
                return (
                    <div className="module-items">
                        {data.publications.map((pub) => (
                            <div key={pub.id} className="module-item">
                                <div className="item-row">
                                    <input type="text" placeholder="标题" value={pub.title}
                                        onChange={e => updatePublication(pub.id, { title: e.target.value })} className="form-input" />
                                    <button className="btn-remove" onClick={() => removePublication(pub.id)}>✕</button>
                                </div>
                                <div className="item-row">
                                    <input type="text" placeholder="作者" value={pub.authors}
                                        onChange={e => updatePublication(pub.id, { authors: e.target.value })} className="form-input" />
                                    <input type="text" placeholder="期刊/出版社" value={pub.publisher}
                                        onChange={e => updatePublication(pub.id, { publisher: e.target.value })} className="form-input" />
                                </div>
                                <input type="text" placeholder="发表日期" value={pub.date}
                                    onChange={e => updatePublication(pub.id, { date: e.target.value })} className="form-input small" />
                            </div>
                        ))}
                        <button className="btn-add" onClick={addPublication}>+ 添加出版物</button>
                    </div>
                );
            case 'hobbies':
                return (
                    <div className="module-items hobbies-grid">
                        {data.hobbies.map((hobby) => (
                            <div key={hobby.id} className="hobby-tag">
                                <input type="text" placeholder="兴趣爱好" value={hobby.name}
                                    onChange={e => updateHobby(hobby.id, { name: e.target.value })} className="form-input-inline" />
                                <button className="btn-remove-small" onClick={() => removeHobby(hobby.id)}>✕</button>
                            </div>
                        ))}
                        <button className="btn-add-circle" onClick={addHobby}>+</button>
                    </div>
                );
            default:
                return null;
        }
    };

    // =========================================================================
    // Render existing module card (with form)
    // =========================================================================

    const renderExistingModuleCard = (moduleKey: ModuleKey) => {
        const isExpanded = expandedModules.has(moduleKey);
        const count = (data[moduleKey] as any[]).length;

        return (
            <div key={moduleKey} className="module-card existing">
                <div className="module-card-header" onClick={() => toggleExpanded(moduleKey)}>
                    <div className="module-card-left">
                        <span className="module-icon">{MODULE_ICONS[moduleKey]}</span>
                        <span className="module-label">{MODULE_LABELS[moduleKey]}</span>
                        <span className="module-count">({count}条)</span>
                    </div>
                    <button className="expand-btn">{isExpanded ? '▼' : '▶'}</button>
                </div>
                {isExpanded && (
                    <div className="module-content">
                        {renderModuleForm(moduleKey)}
                    </div>
                )}
            </div>
        );
    };

    // =========================================================================
    // Render AI recommended module card
    // =========================================================================

    const renderRecommendedCard = (recommendation: NewModuleRecommendation) => {
        const { moduleType, moduleName, reason, suggestedContent } = recommendation;
        const isAccepted = acceptedModules.has(moduleType);

        if (isAccepted) return null;

        return (
            <div key={moduleType} className="recommend-card">
                <div className="recommend-header">
                    <span className="module-icon">{MODULE_ICONS[moduleType]}</span>
                    <span className="module-label">{moduleName}</span>
                    <span className="badge ai-tag">AI推荐</span>
                </div>
                <div className="recommend-reason">{reason}</div>
                <div className="recommend-preview">
                    {suggestedContent.slice(0, 1).map((item: any, i: number) => (
                        <div key={i} className="preview-item">
                            <strong>{item.name || item.title || item.role}</strong>
                            {item.description && <p>{item.description.slice(0, 80)}...</p>}
                        </div>
                    ))}
                </div>
                <div className="recommend-actions">
                    <button className="btn-accept" onClick={() => acceptRecommendation(recommendation)}>
                        ✓ 接受并添加
                    </button>
                </div>
            </div>
        );
    };

    // =========================================================================
    // Main Render - Only the form area (AI panel handled by StepWizard)
    // =========================================================================

    return (
        <div className="additional-step">
            {/* Existing Modules */}
            {existingModules.length > 0 && (
                <div className="modules-section">
                    <h4 className="section-title">📂 您简历中已有的模块</h4>
                    {existingModules.map(renderExistingModuleCard)}
                </div>
            )}

            {/* AI Recommended Modules */}
            <div className="modules-section">
                <h4 className="section-title">✨ AI 推荐添加</h4>
                {recommendState.status === 'loading' && (
                    <div className="recommend-loading">
                        <span className="spinner"></span> AI 正在分析您的背景...
                    </div>
                )}
                {recommendState.status === 'error' && (
                    <div className="recommend-error">❌ {recommendState.error}</div>
                )}
                {recommendState.status === 'ready' && (
                    recommendState.recommendations.length > 0 ? (
                        <div className="recommend-list">
                            {recommendState.recommendations.map(renderRecommendedCard)}
                        </div>
                    ) : (
                        <p className="no-recommend">暂无推荐，您的简历已经很完整！</p>
                    )
                )}
            </div>

            <p className="form-hint">💡 右侧会显示 AI 对已有内容的优化建议</p>
        </div>
    );
}
