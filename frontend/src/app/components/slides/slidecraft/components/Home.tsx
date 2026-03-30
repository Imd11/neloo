import React, { useCallback, useRef, useState } from 'react';
import { ArrowRight, Check, Clock, Paperclip, Sparkles, Trash2, X } from 'lucide-react';
import { Attachment, PresentationData, StyleDimensions } from '../types';
import { PRESETS, recommendPreset } from '../data/presets';

interface HomeProps {
    onSubmit: (topic: string, attachments: Attachment[], dims: StyleDimensions, presetId?: string) => void;
    history: PresentationData[];
    onLoadHistory: (presentation: PresentationData) => void;
    onDeleteHistory: (id: string) => void;
    initialTopic?: string;
    initialAttachments?: Attachment[];
    onBack?: () => void;
}

const SUGGESTIONS = [
    'AI 如何改变教育行业',
    'My Startup Pitch Deck',
    '2025 年度工作总结',
    'The Future of Web Development',
];

const Home: React.FC<HomeProps> = ({
    onSubmit,
    history,
    onLoadHistory,
    onDeleteHistory,
    initialTopic = '',
    initialAttachments = [],
    onBack,
}) => {
    const [topic, setTopic] = useState(initialTopic);
    const [attachments, setAttachments] = useState<Attachment[]>(initialAttachments);
    const [isDragging, setIsDragging] = useState(false);
    const [selectedPresetId, setSelectedPresetId] = useState<string | null>(
        initialTopic ? recommendPreset(initialTopic) : null
    );
    const fileInput = useRef<HTMLInputElement>(null);

    const handleFile = useCallback(async (file: File) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64 = (reader.result as string).split(',')[1];
            setAttachments((prev) => [
                ...prev,
                { name: file.name, mimeType: file.type, data: base64 },
            ]);
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        Array.from(e.dataTransfer.files).forEach(handleFile);
    }, [handleFile]);

    const handleSubmit = () => {
        if (!topic.trim()) return;
        const presetId = selectedPresetId || recommendPreset(topic);
        const preset = PRESETS.find((item) => item.id === presetId);
        if (preset) {
            onSubmit(topic.trim(), attachments, preset.dimensions, preset.id);
        }
    };

    const recommendedId = topic.trim() ? recommendPreset(topic) : null;

    return (
        <div
            className="min-h-screen flex flex-col items-center p-6 pt-12 md:pt-16"
            onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
        >
            <div className="w-full max-w-5xl">
                {onBack && (
                    <button
                        onClick={onBack}
                        className="mb-6 text-sm text-zinc-500 transition hover:text-zinc-200"
                    >
                        返回 Neloo
                    </button>
                )}
            </div>

            {isDragging && (
                <div className="fixed inset-0 z-50 flex items-center justify-center border-2 border-dashed border-purple-500 bg-purple-500/10">
                    <p className="text-xl font-medium text-purple-300">松开以添加文件</p>
                </div>
            )}

            <div className="mb-8 text-center fade-in">
                <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-purple-500/20 bg-purple-500/10 px-4 py-1.5 text-sm text-purple-400">
                    <Sparkles size={14} />
                    <span>AI-Powered</span>
                </div>
                <h1 className="mb-3 text-5xl font-extrabold tracking-tight md:text-6xl">
                    <span className="bg-gradient-to-r from-purple-400 via-pink-400 to-amber-400 bg-clip-text text-transparent">
                        Slide Craft
                    </span>
                </h1>
                <p className="mx-auto max-w-md text-lg text-zinc-400">
                    输入主题，选择风格，AI 为你生成专业幻灯片
                </p>
            </div>

            <div className="mb-4 w-full max-w-2xl fade-in" style={{ animationDelay: '0.1s' }}>
                <div className="relative group">
                    <input
                        type="text"
                        value={topic}
                        onChange={(e) => setTopic(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                        placeholder="描述你的演示文稿主题..."
                        className="w-full rounded-2xl border border-zinc-800 bg-zinc-900 px-6 py-5 pr-28 text-lg text-white transition-all placeholder-zinc-500 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
                    />
                    <div className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-2">
                        <button
                            onClick={() => fileInput.current?.click()}
                            className="p-2.5 text-zinc-500 transition hover:text-zinc-300"
                        >
                            <Paperclip size={18} />
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={!topic.trim()}
                            className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 font-medium text-white shadow-lg shadow-purple-900/30 transition-all hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
                        >
                            <span>开始</span>
                            <ArrowRight size={16} />
                        </button>
                    </div>
                    <input
                        ref={fileInput}
                        type="file"
                        multiple
                        className="hidden"
                        onChange={(e) => Array.from(e.target.files || []).forEach(handleFile)}
                    />
                </div>
            </div>

            {attachments.length > 0 && (
                <div className="mb-6 flex w-full max-w-2xl flex-wrap gap-2">
                    {attachments.map((attachment, index) => (
                        <div
                            key={`${attachment.name}-${index}`}
                            className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-xs text-zinc-300"
                        >
                            <span className="max-w-[220px] truncate">{attachment.name}</span>
                            <button
                                onClick={() =>
                                    setAttachments((prev) => prev.filter((_, itemIndex) => itemIndex !== index))
                                }
                                className="rounded-full p-0.5 transition hover:bg-zinc-800"
                            >
                                <X size={12} />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            <div className="mb-8 flex flex-wrap justify-center gap-2">
                {SUGGESTIONS.map((suggestion) => (
                    <button
                        key={suggestion}
                        onClick={() => setTopic(suggestion)}
                        className="rounded-full border border-zinc-800 bg-zinc-900 px-3 py-1.5 text-sm text-zinc-400 transition hover:border-zinc-700 hover:text-zinc-200"
                    >
                        {suggestion}
                    </button>
                ))}
            </div>

            <div className="w-full max-w-5xl">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-zinc-400">
                    模板风格
                    {selectedPresetId && (
                        <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] text-purple-300">
                            已选 {PRESETS.find((item) => item.id === selectedPresetId)?.nameZh || selectedPresetId}
                        </span>
                    )}
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
                    {PRESETS.map((preset) => {
                        const isSelected = selectedPresetId === preset.id;
                        const isRecommended = recommendedId === preset.id;

                        return (
                            <button
                                key={preset.id}
                                onClick={() =>
                                    setSelectedPresetId(preset.id === selectedPresetId ? null : preset.id)
                                }
                                className={`group relative overflow-hidden rounded-2xl border-2 text-left transition-all duration-200 ${
                                    isSelected
                                        ? 'scale-[1.02] border-purple-500 shadow-lg shadow-purple-500/20 ring-1 ring-purple-500/30'
                                        : 'border-zinc-800/60 hover:border-zinc-600'
                                }`}
                            >
                                <div className="relative aspect-video overflow-hidden bg-zinc-900">
                                    <img
                                        src={`/presets/${preset.id}.webp`}
                                        alt={preset.name}
                                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                                        loading="lazy"
                                    />
                                    <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/80 to-transparent" />
                                </div>

                                <div className="bg-zinc-900/95 px-3 py-2.5">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-xs font-semibold text-zinc-100">{preset.name}</h3>
                                        <span className="text-[10px] text-purple-400">{preset.nameZh}</span>
                                    </div>
                                    <p className="mt-0.5 line-clamp-1 text-[10px] text-zinc-500">{preset.feel}</p>
                                </div>

                                {isRecommended && (
                                    <span className="absolute left-2 top-2 rounded-md bg-amber-500/90 px-2 py-0.5 text-[9px] font-bold text-black shadow-lg">
                                        ✨ 推荐
                                    </span>
                                )}
                                {isSelected && (
                                    <div className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-purple-500 shadow-lg">
                                        <Check size={12} className="text-white" />
                                    </div>
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {history.length > 0 && (
                <div className="mt-14 w-full max-w-4xl fade-in" style={{ animationDelay: '0.25s' }}>
                    <h2 className="mb-4 flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-zinc-500">
                        <Clock size={14} /> 历史记录
                    </h2>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                        {history.map((presentation) => (
                            <div
                                key={presentation.id}
                                className="group relative cursor-pointer rounded-xl border border-zinc-800 bg-zinc-900 p-4 transition hover:border-zinc-700"
                                onClick={() => onLoadHistory(presentation)}
                            >
                                <h3 className="mb-1 truncate font-medium text-zinc-200">
                                    {presentation.topic}
                                </h3>
                                <p className="text-xs text-zinc-500">
                                    {presentation.slides.length} 页 ·{' '}
                                    {new Date(presentation.createdAt).toLocaleDateString()}
                                </p>
                                {presentation.slides[0]?.imageBase64 && (
                                    <img
                                        src={`data:image/png;base64,${presentation.slides[0].imageBase64}`}
                                        className="mt-3 aspect-video w-full rounded-lg object-cover opacity-70"
                                    />
                                )}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onDeleteHistory(presentation.id);
                                    }}
                                    className="absolute right-2 top-2 rounded-lg bg-zinc-800 p-1.5 text-zinc-500 opacity-0 transition group-hover:opacity-100 hover:text-red-400"
                                >
                                    <Trash2 size={14} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

export default Home;
