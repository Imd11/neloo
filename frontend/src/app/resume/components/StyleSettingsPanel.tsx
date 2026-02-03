import type { StyleSettings, ResumeLanguage } from '../types/resume';
import { PAGE_PRESETS } from '../lib/pageSize';
import { languageNames } from '../lib/i18n/resumeLabels';

interface Props {
    settings: StyleSettings;
    onChange: (settings: StyleSettings) => void;
}

export function StyleSettingsPanel({ settings, onChange }: Props) {
    const update = <K extends keyof StyleSettings>(key: K, value: StyleSettings[K]) => {
        onChange({ ...settings, [key]: value });
    };

    return (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 border-b pb-2">样式设置</h3>

            {/* Page Size */}
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    纸张大小
                </label>
                <select
                    value={settings.pageSize}
                    onChange={(e) => update('pageSize', e.target.value as StyleSettings['pageSize'])}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                    {Object.entries(PAGE_PRESETS).map(([key, preset]) => (
                        <option key={key} value={key}>
                            {preset.label}
                        </option>
                    ))}
                </select>
            </div>

            {/* Resume Language */}
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    简历语言
                </label>
                <select
                    value={settings.resumeLanguage}
                    onChange={(e) => update('resumeLanguage', e.target.value as ResumeLanguage)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                >
                    {Object.entries(languageNames).map(([code, name]) => (
                        <option key={code} value={code}>
                            {name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Primary Color */}
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-2">
                    主题色
                </label>
                {/* Preset Color Swatches */}
                <div className="flex flex-wrap gap-2 mb-2">
                    {[
                        { color: '#0e5484', name: '经典蓝' },
                        { color: '#1a365d', name: '藏蓝' },
                        { color: '#7c3aed', name: '紫罗兰' },
                        { color: '#059669', name: '翠绿' },
                        { color: '#dc2626', name: '热情红' },
                        { color: '#78716c', name: '高级灰' },
                        { color: '#0d9488', name: '青绿' },
                        { color: '#ea580c', name: '活力橙' },
                    ].map(({ color, name }) => (
                        <button
                            key={color}
                            onClick={() => update('primaryColor', color)}
                            title={name}
                            className={`
                                w-7 h-7 rounded-full border-2 transition-all cursor-pointer
                                ${settings.primaryColor === color
                                    ? 'border-gray-900 scale-110 shadow-md'
                                    : 'border-transparent hover:border-gray-300 hover:scale-105'}
                            `}
                            style={{ backgroundColor: color }}
                        />
                    ))}
                    {/* Custom Color Picker */}
                    <div className="relative">
                        <input
                            type="color"
                            value={settings.primaryColor}
                            onChange={(e) => update('primaryColor', e.target.value)}
                            className="absolute inset-0 w-7 h-7 opacity-0 cursor-pointer"
                            title="自定义颜色"
                        />
                        <div
                            className="w-7 h-7 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 hover:border-gray-400"
                            title="自定义颜色"
                        >
                            +
                        </div>
                    </div>
                </div>
                {/* Current Color Display */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                    <div
                        className="w-4 h-4 rounded border"
                        style={{ backgroundColor: settings.primaryColor }}
                    />
                    <span>{settings.primaryColor}</span>
                </div>
            </div>

            {/* Font Size */}
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    字体大小: {settings.fontSize}pt
                </label>
                <input
                    type="range"
                    min="7"
                    max="14"
                    step="0.5"
                    value={settings.fontSize}
                    onChange={(e) => update('fontSize', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Line Height */}
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    行距: {settings.lineHeight}
                </label>
                <input
                    type="range"
                    min="1.0"
                    max="2.0"
                    step="0.1"
                    value={settings.lineHeight}
                    onChange={(e) => update('lineHeight', parseFloat(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
            </div>

            {/* Sidebar Width */}
            <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                    侧边栏宽度: {settings.sidebarWidth}%
                </label>
                <input
                    type="range"
                    min="30"
                    max="50"
                    step="1"
                    value={settings.sidebarWidth}
                    onChange={(e) => update('sidebarWidth', parseInt(e.target.value))}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
            </div>
        </div>
    );
}
