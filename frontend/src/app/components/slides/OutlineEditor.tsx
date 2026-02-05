'use client';

import React, { useEffect, useState, useRef } from 'react';
import { ArrowLeft, Loader2, Play, Trash2, AlertCircle } from 'lucide-react';
import type { Slide, Attachment } from '@/app/slides/types/slides';
import { generateOutlineStream } from '@/app/slides/lib/slidesService';

interface OutlineEditorProps {
    topic: string;
    initialAttachments: Attachment[];
    onBack: () => void;
    onGenerateSlides: (slides: Slide[]) => void;
    onStreamUpdate?: (text: string) => void; // For AI chat panel
}

const OutlineEditor: React.FC<OutlineEditorProps> = ({
    topic,
    initialAttachments,
    onBack,
    onGenerateSlides,
    onStreamUpdate
}) => {
    const [rawOutput, setRawOutput] = useState('');
    const [slides, setSlides] = useState<Slide[]>([]);
    const [isGenerating, setIsGenerating] = useState(true);
    const [parseError, setParseError] = useState(false);
    const [hasStreamStarted, setHasStreamStarted] = useState(false);

    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let mounted = true;

        const startGeneration = async () => {
            try {
                await generateOutlineStream(topic, initialAttachments, (text) => {
                    if (!mounted) return;
                    setRawOutput(text);
                    setHasStreamStarted(true);
                    onStreamUpdate?.(text);

                    // Attempt realtime parsing for the visual side
                    try {
                        if (text.trim().endsWith(']')) {
                            const parsed = JSON.parse(text);
                            if (Array.isArray(parsed)) {
                                setSlides(parsed.map((s, i) => ({ ...s, id: `slide-${i}` })));
                                setParseError(false);
                            }
                        }
                    } catch (e) {
                        // Ignore parsing errors during streaming
                    }
                });
            } catch (e) {
                console.error("Generation failed", e);
            } finally {
                if (mounted) {
                    setIsGenerating(false);
                }
            }
        };

        startGeneration();

        return () => { mounted = false; };
    }, [topic, initialAttachments, onStreamUpdate]);

    // Handle final parsing when generation stops
    useEffect(() => {
        if (!isGenerating && rawOutput) {
            try {
                let cleanJson = rawOutput.replace(/```json/g, '').replace(/```/g, '').trim();
                const parsed = JSON.parse(cleanJson);
                if (Array.isArray(parsed)) {
                    setSlides(parsed.map((s, i) => ({ ...s, id: `slide-${i}` })));
                    setParseError(false);
                } else {
                    setParseError(true);
                }
            } catch (e) {
                console.error("Final parse error", e);
                setParseError(true);
            }
        }
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [rawOutput, isGenerating]);

    const updateSlide = (id: string, field: keyof Slide, value: string) => {
        setSlides(prev => prev.map(s => s.id === id ? { ...s, [field]: value } : s));
    };

    const deleteSlide = (id: string) => {
        setSlides(prev => prev.filter(s => s.id !== id));
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950">
            {/* Navbar */}
            <header className="h-16 border-b border-zinc-800 flex items-center px-6 justify-between bg-zinc-950/50 backdrop-blur flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-zinc-900 rounded-full text-zinc-400 hover:text-white transition">
                        <ArrowLeft size={20} />
                    </button>
                    <div className="flex flex-col">
                        <h2 className="font-semibold text-lg truncate max-w-md text-white">{topic || "无标题"}</h2>
                        {initialAttachments.length > 0 && (
                            <span className="text-[10px] text-zinc-500 flex items-center gap-1">
                                已附加: {initialAttachments.length} 个文件
                            </span>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {isGenerating && (
                        <span className="text-xs text-purple-400 animate-pulse flex items-center gap-1">
                            <Loader2 size={12} className="animate-spin" /> AI 生成中...
                        </span>
                    )}
                </div>
            </header>

            {/* Main Content */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-3xl mx-auto space-y-6 pb-20">
                    <div className="flex justify-between items-end mb-6">
                        <div>
                            <h3 className="text-2xl font-bold text-white">幻灯片大纲</h3>
                            <p className="text-zinc-400 text-sm mt-1">在生成图片之前，请查看并编辑您的结构。</p>
                        </div>
                    </div>

                    {slides.length === 0 && !parseError && (
                        <div className="flex flex-col items-center justify-center h-64 text-zinc-500 space-y-4">
                            {hasStreamStarted ? <Loader2 className="animate-spin text-purple-500" size={32} /> : null}
                            <p>{hasStreamStarted ? "解析结构中..." : "初始化中..."}</p>
                        </div>
                    )}

                    {parseError && (
                        <div className="p-4 border border-red-900/50 bg-red-900/10 rounded-lg flex items-center gap-3 text-red-200">
                            <AlertCircle size={20} />
                            <p>无法自动解析大纲。请重试或等待生成完成。</p>
                        </div>
                    )}

                    {slides.map((slide, index) => (
                        <div key={slide.id} className="group bg-zinc-900 border border-zinc-800 rounded-xl p-6 transition-all hover:border-zinc-700 hover:shadow-xl hover:shadow-black/50">
                            <div className="flex justify-between items-start mb-4 border-b border-zinc-800 pb-2">
                                <span className="text-xs font-mono text-zinc-500 bg-zinc-950 px-2 py-1 rounded">幻灯片 {index + 1}</span>
                                <button
                                    onClick={() => deleteSlide(slide.id)}
                                    className="text-zinc-600 hover:text-red-400 p-1 opacity-0 group-hover:opacity-100 transition"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <label className="text-xs text-zinc-500 uppercase font-semibold">标题</label>
                                    <input
                                        className="w-full bg-transparent text-xl font-bold text-white border-b border-transparent focus:border-purple-500 outline-none py-1"
                                        value={slide.title}
                                        onChange={(e) => updateSlide(slide.id, 'title', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500 uppercase font-semibold">内容</label>
                                    <textarea
                                        className="w-full bg-zinc-950/50 rounded-lg text-zinc-300 p-3 mt-1 text-sm outline-none border border-transparent focus:border-zinc-700 min-h-[80px]"
                                        value={slide.content}
                                        onChange={(e) => updateSlide(slide.id, 'content', e.target.value)}
                                    />
                                </div>

                                <div>
                                    <label className="text-xs text-zinc-500 uppercase font-semibold flex items-center gap-2">
                                        视觉提示 <span className="text-[10px] bg-purple-900/30 text-purple-300 px-1 rounded">AI</span>
                                    </label>
                                    <textarea
                                        className="w-full bg-zinc-950/30 rounded-lg text-zinc-400 p-3 mt-1 text-xs outline-none border border-transparent focus:border-zinc-700 min-h-[60px] italic"
                                        value={slide.visualDescription}
                                        onChange={(e) => updateSlide(slide.id, 'visualDescription', e.target.value)}
                                    />
                                </div>
                            </div>
                        </div>
                    ))}

                    {/* Generate Button Footer */}
                    {slides.length > 0 && (
                        <div className="fixed bottom-6 right-6 z-20">
                            <button
                                onClick={() => onGenerateSlides(slides)}
                                disabled={isGenerating}
                                className="bg-white text-black hover:bg-zinc-200 shadow-lg shadow-purple-900/20 px-6 py-3 rounded-full font-bold flex items-center gap-2 transition-all transform hover:scale-105 disabled:opacity-50 disabled:scale-100"
                            >
                                {isGenerating ? <Loader2 className="animate-spin" size={20} /> : <Play size={20} fill="currentColor" />}
                                生成幻灯片
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default OutlineEditor;
