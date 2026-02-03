import { FortySecondsCVTemplate } from '../templates/forty-seconds-cv/FortySecondsCVTemplate';
import { AltaCVTemplate } from '../templates/altacv/AltaCVTemplate';
import { MinimalCVTemplate } from '../templates/minimal-cv/MinimalCVTemplate';
import { SidebarCVTemplate } from '../templates/sidebar-cv/SidebarCVTemplate';
import { LuxSleekCVTemplate } from '../templates/luxsleek-cv/LuxSleekCVTemplate';
import { HipsterCVTemplate } from '../templates/hipster-cv/HipsterCVTemplate';
import { TimelineCVTemplate } from '../templates/timeline-cv/TimelineCVTemplate';
import { ModernCVTemplate } from '../templates/modern-cv/ModernCVTemplate';
import { ClassicCVTemplate } from '../templates/classic-cv/ClassicCVTemplate';
import type { ResumeData, StyleSettings } from '../types/resume';
import { defaultResumeData, defaultStyleSettings } from '../types/resume';
import { getPagePreset } from '../lib/pageSize';

// Template definitions
export type TemplateId = 'forty-seconds-cv' | 'altacv' | 'minimal-cv' | 'sidebar-cv' | 'luxsleek-cv' | 'hipster-cv' | 'timeline-cv' | 'modern-cv' | 'classic-cv';

export interface TemplateInfo {
    id: TemplateId;
    name: string;
    description: string;
    category: 'professional' | 'creative' | 'academic' | 'modern';
    Component: React.ComponentType<{ data: ResumeData; style: StyleSettings }>;
}

const templates: TemplateInfo[] = [
    {
        id: 'forty-seconds-cv',
        name: 'Forty Seconds CV',
        description: '双栏布局，适合技术人员',
        category: 'professional',
        Component: FortySecondsCVTemplate,
    },
    {
        id: 'altacv',
        name: 'AltaCV',
        description: '创意风格，含人生哲学板块',
        category: 'creative',
        Component: AltaCVTemplate,
    },
    {
        id: 'minimal-cv',
        name: 'Minimal CV',
        description: '学术风格，简洁优雅',
        category: 'academic',
        Component: MinimalCVTemplate,
    },
    {
        id: 'sidebar-cv',
        name: 'Sidebar CV',
        description: '现代风格，技能展示突出',
        category: 'modern',
        Component: SidebarCVTemplate,
    },
    {
        id: 'luxsleek-cv',
        name: 'LuxSleek CV',
        description: '奢华简约，复古优雅设计',
        category: 'professional',
        Component: LuxSleekCVTemplate,
    },
    {
        id: 'hipster-cv',
        name: 'Hipster CV',
        description: '创意潮流，彩色气泡图',
        category: 'creative',
        Component: HipsterCVTemplate,
    },
    {
        id: 'timeline-cv',
        name: 'Timeline CV',
        description: '可视化时间线，连线点设计',
        category: 'professional',
        Component: TimelineCVTemplate,
    },
    {
        id: 'modern-cv',
        name: 'Modern CV',
        description: '橙色点缀，信息卡片',
        category: 'modern',
        Component: ModernCVTemplate,
    },
    {
        id: 'classic-cv',
        name: 'Classic CV',
        description: '传统商务，深蓝侧栏',
        category: 'professional',
        Component: ClassicCVTemplate,
    },
];

interface TemplateGalleryProps {
    activeTemplate: TemplateId;
    onSelectTemplate: (id: TemplateId) => void;
}

export function TemplateGallery({ activeTemplate, onSelectTemplate }: TemplateGalleryProps) {
    const pagePreset = getPagePreset(defaultStyleSettings.pageSize);
    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">选择模板</h3>

            <div className="grid grid-cols-2 gap-3">
                {templates.map((template) => {
                    const TemplateComponent = template.Component;
                    return (
                        <button
                            key={template.id}
                            onClick={() => onSelectTemplate(template.id)}
                            className={`group relative rounded-lg overflow-hidden border-2 transition-all ${activeTemplate === template.id
                                ? 'border-indigo-500 shadow-lg ring-2 ring-indigo-200'
                                : 'border-gray-200 hover:border-gray-300 hover:shadow-md'
                                }`}
                        >
                            {/* Live Template Thumbnail */}
                            <div className="aspect-[3/4] bg-gray-50 relative overflow-hidden">
                                <div
                                    className="absolute inset-0 origin-top-left"
                                    style={{
                                        transform: 'scale(0.12)',
                                        width: pagePreset.width,
                                        height: pagePreset.height,
                                        pointerEvents: 'none'
                                    }}
                                >
                                    <TemplateComponent
                                        data={defaultResumeData}
                                        style={defaultStyleSettings}
                                    />
                                </div>

                                {/* Active Badge */}
                                {activeTemplate === template.id && (
                                    <div className="absolute top-2 right-2 bg-indigo-500 text-white text-xs px-2 py-0.5 rounded-full font-medium z-10">
                                        当前
                                    </div>
                                )}

                                {/* Category Badge */}
                                <div className="absolute bottom-2 left-2 z-10">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${template.category === 'professional' ? 'bg-blue-100 text-blue-700' :
                                        template.category === 'creative' ? 'bg-purple-100 text-purple-700' :
                                            template.category === 'academic' ? 'bg-green-100 text-green-700' :
                                                'bg-orange-100 text-orange-700'
                                        }`}>
                                        {template.category === 'professional' ? '专业' :
                                            template.category === 'creative' ? '创意' :
                                                template.category === 'academic' ? '学术' : '现代'}
                                    </span>
                                </div>
                            </div>

                            {/* Info */}
                            <div className="p-2.5 bg-white">
                                <h4 className="text-sm font-semibold text-gray-800 truncate">{template.name}</h4>
                                <p className="text-xs text-gray-500 truncate mt-0.5">{template.description}</p>
                            </div>
                        </button>
                    );
                })}
            </div>

            <p className="text-xs text-gray-400 text-center mt-4">
                更多模板正在转换中...
            </p>
        </div>
    );
}
