import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, Play, Trash2, CheckCircle2, AlertCircle, Edit3 } from 'lucide-react';
import { Slide, Attachment, StyleDimensions } from '../types';
import { generateOutlineStream } from '../services/geminiService';

interface OutlineEditorProps {
    topic: string;
    attachments: Attachment[];
    style?: StyleDimensions;
    presetId?: string;
    onBack: () => void;
    onGenerateSlides: (slides: Slide[]) => void;
}

const OutlineEditor: React.FC<OutlineEditorProps> = ({ topic, attachments, style, presetId, onBack, onGenerateSlides }) => {
    const [slides, setSlides] = useState<Slide[]>([]);
    const [isStreaming, setIsStreaming] = useState(false);
    const [streamText, setStreamText] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isDone, setIsDone] = useState(false);
    const streamRef = useRef('');
    const abortRef = useRef<AbortController | null>(null);
    const streamPanelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        startGeneration();
        return () => { abortRef.current?.abort(); };
    }, []);

    const startGeneration = async () => {
        setIsStreaming(true);
        setError(null);
        setStreamText('');
        streamRef.current = '';
        setSlides([]);
        setIsDone(false);

        const controller = new AbortController();
        abortRef.current = controller;

        try {
            const fullText = await generateOutlineStream(
                topic, attachments, style,
                (chunk) => {
                    streamRef.current += chunk;
                    setStreamText(streamRef.current);

                    // Try to parse JSON progressively
                    try {
                        const cleaned = streamRef.current.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
                        const parsed = JSON.parse(cleaned);
                        if (Array.isArray(parsed)) {
                            setSlides(parsed.map((s: any, i: number) => ({
                                id: crypto.randomUUID(),
                                title: s.title || `Slide ${i + 1}`,
                                content: s.content || '',
                                visualDescription: s.visualDescription || '',
                                slideType: s.slideType || 'content',
                                layout: s.layout || 'title-left',
                                narrativeGoal: s.narrativeGoal || '',
                            })));
                        }
                    } catch { /* partial JSON, wait for more */ }

                    // Auto-scroll stream panel
                    if (streamPanelRef.current) {
                        streamPanelRef.current.scrollTop = streamPanelRef.current.scrollHeight;
                    }
                },
                controller.signal,
                presetId
            );

            // Final parse
            const cleaned = fullText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
            try {
                const parsed = JSON.parse(cleaned);
                if (Array.isArray(parsed)) {
                    setSlides(parsed.map((s: any, i: number) => ({
                        id: crypto.randomUUID(),
                        title: s.title || `Slide ${i + 1}`,
                        content: s.content || '',
                        visualDescription: s.visualDescription || '',
                        slideType: s.slideType || 'content',
                        layout: s.layout || 'title-left',
                        narrativeGoal: s.narrativeGoal || '',
                    })));
                }
            } catch {
                setError('Failed to parse outline JSON. Please retry.');
            }

            setIsDone(true);
        } catch (e: any) {
            if (e.name !== 'AbortError') {
                setError(e.message || 'Generation failed');
            }
        } finally {
            setIsStreaming(false);
        }
    };

    const updateSlide = (index: number, field: string, value: string) => {
        setSlides(prev => prev.map((s, i) => i === index ? { ...s, [field]: value } : s));
    };

    const deleteSlide = (index: number) => {
        setSlides(prev => prev.filter((_, i) => i !== index));
    };

    const canProceed = slides.length > 0 && isDone;

    return (
        <div className="min-h-screen flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-zinc-800">
                <button onClick={onBack} className="flex items-center gap-2 text-zinc-400 hover:text-white transition">
                    <ArrowLeft size={18} /> 返回
                </button>
                <h2 className="text-lg font-semibold text-zinc-200 flex items-center gap-2">
                    {isStreaming && <Loader2 size={18} className="animate-spin text-purple-400" />}
                    大纲编辑
                </h2>
                <button
                    onClick={() => onGenerateSlides(slides)}
                    disabled={!canProceed}
                    className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:bg-zinc-800 disabled:text-zinc-600 text-white rounded-xl font-medium transition shadow-lg shadow-purple-900/30 disabled:shadow-none"
                >
                    <Play size={16} /> 生成幻灯片
                </button>
            </div>

            <div className="flex-1 flex overflow-hidden">
                {/* Left: Stream */}
                <div ref={streamPanelRef} className="w-80 border-r border-zinc-800 bg-zinc-950 p-4 overflow-y-auto custom-scrollbar flex-shrink-0">
                    <h3 className="text-xs text-zinc-600 uppercase tracking-wider mb-3">AI Token Stream</h3>
                    <pre className="text-xs text-green-400/70 whitespace-pre-wrap font-mono leading-relaxed break-all">
                        {streamText || (isStreaming ? 'Waiting for response...' : '')}
                    </pre>
                    {error && (
                        <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-start gap-2">
                            <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
                            <div>
                                <p>{error}</p>
                                <button onClick={startGeneration} className="mt-2 text-xs underline hover:text-red-300">重试</button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Slide Cards */}
                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {slides.length === 0 && isStreaming && (
                        <div className="flex flex-col items-center justify-center h-full text-zinc-500">
                            <Loader2 size={32} className="animate-spin text-purple-400 mb-4" />
                            <p>正在分析内容并生成大纲...</p>
                        </div>
                    )}

                    <div className="max-w-3xl mx-auto space-y-4">
                        {slides.map((slide, idx) => (
                            <div key={slide.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 fade-in group relative">
                                {/* Slide number & type */}
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-xs font-mono text-zinc-600 bg-zinc-800 px-2 py-0.5 rounded">{String(idx + 1).padStart(2, '0')}</span>
                                        <span className="text-[10px] text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-full">{slide.slideType}</span>
                                        <span className="text-[10px] text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded-full">{slide.layout}</span>
                                    </div>
                                    <button onClick={() => deleteSlide(idx)} className="text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition">
                                        <Trash2 size={14} />
                                    </button>
                                </div>

                                {/* Title */}
                                <input
                                    value={slide.title}
                                    onChange={e => updateSlide(idx, 'title', e.target.value)}
                                    className="w-full bg-transparent text-lg font-semibold text-zinc-100 mb-2 outline-none border-b border-transparent focus:border-purple-500/30 transition"
                                    placeholder="Slide title..."
                                />

                                {/* Content */}
                                <textarea
                                    value={slide.content}
                                    onChange={e => updateSlide(idx, 'content', e.target.value)}
                                    rows={3}
                                    className="w-full bg-transparent text-sm text-zinc-300 mb-3 outline-none resize-none border-b border-transparent focus:border-purple-500/30 transition"
                                    placeholder="Content..."
                                />

                                {/* Visual Description */}
                                <div className="bg-zinc-800/50 rounded-lg p-3">
                                    <label className="text-[10px] text-zinc-500 uppercase tracking-wider flex items-center gap-1 mb-1">
                                        <Edit3 size={10} /> 视觉描述（指导 AI 生成整页幻灯片图片）
                                    </label>
                                    <textarea
                                        value={slide.visualDescription}
                                        onChange={e => updateSlide(idx, 'visualDescription', e.target.value)}
                                        rows={2}
                                        className="w-full bg-transparent text-xs text-zinc-400 outline-none resize-none"
                                        placeholder="Describe the visual..."
                                    />
                                </div>

                                {/* Narrative Goal */}
                                {slide.narrativeGoal && (
                                    <p className="text-[10px] text-zinc-600 mt-2 italic">🎯 {slide.narrativeGoal}</p>
                                )}
                            </div>
                        ))}
                    </div>

                    {isDone && slides.length > 0 && (
                        <div className="max-w-3xl mx-auto mt-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm flex items-center gap-2">
                            <CheckCircle2 size={16} />
                            大纲生成完成！共 {slides.length} 页。可编辑后点击「生成幻灯片」继续。
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OutlineEditor;
