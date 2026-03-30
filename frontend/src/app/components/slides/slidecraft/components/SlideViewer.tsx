import React from 'react';
import {
    ChevronLeft, ChevronRight, Loader2, RefreshCw, AlertCircle, Square, Trash2,
} from 'lucide-react';
import { Slide, StyleDimensions } from '../types';
import { LAYOUTS } from '../data/layouts';

interface SlideViewerProps {
    slide: Slide;
    isFirst: boolean;
    isLast: boolean;
    onPrev: () => void;
    onNext: () => void;
    onSlideUpdate: (updates: Partial<Slide>) => void;
    onRegenerate: (desc: string) => void;
    onStopGeneration?: () => void;
    onIgnore?: () => void;
    onDelete?: () => void;
    style?: StyleDimensions;
    presetId?: string;
}

const SlideViewer: React.FC<SlideViewerProps> = ({
    slide,
    isFirst,
    isLast,
    onPrev,
    onNext,
    onSlideUpdate,
    onRegenerate,
    onStopGeneration,
    onIgnore,
    onDelete,
}) => {
    const layoutOptions = Object.values(LAYOUTS);

    return (
        <div className="flex-1 flex bg-zinc-900 overflow-hidden">
            <div className="flex-1 relative overflow-hidden">
                <button
                    onClick={onPrev}
                    disabled={isFirst}
                    className="absolute left-4 top-1/2 -translate-y-1/2 z-40 p-4 rounded-full bg-black/50 hover:bg-black/80 text-white disabled:opacity-0 transition backdrop-blur"
                >
                    <ChevronLeft size={24} />
                </button>
                <button
                    onClick={onNext}
                    disabled={isLast}
                    className="absolute right-4 top-1/2 -translate-y-1/2 z-40 p-4 rounded-full bg-black/50 hover:bg-black/80 text-white disabled:opacity-0 transition backdrop-blur"
                >
                    <ChevronRight size={24} />
                </button>

                <div className="absolute inset-0 flex items-center justify-center p-8">
                    <div className="relative w-full max-w-6xl aspect-video rounded-2xl overflow-hidden border border-zinc-800 bg-black shadow-2xl">
                        {slide.imageBase64 ? (
                            <img
                                src={`data:image/png;base64,${slide.imageBase64}`}
                                alt={slide.title}
                                className="w-full h-full object-contain"
                            />
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-500">
                                {slide.isGeneratingImage ? (
                                    <>
                                        <Loader2 size={40} className="animate-spin text-purple-400" />
                                        <p>Generating full slide image...</p>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-sm uppercase tracking-[0.25em] text-zinc-600">Slide Preview</div>
                                        <p>No generated image yet</p>
                                    </>
                                )}
                            </div>
                        )}

                        {(slide.isGeneratingImage || slide.generationFailed) && (
                            <div className="absolute inset-0 bg-black/75 backdrop-blur-sm flex flex-col items-center justify-center gap-5 p-6 text-center">
                                {slide.isGeneratingImage && (
                                    <>
                                        <Loader2 size={44} className="animate-spin text-purple-400" />
                                        <div className="space-y-1">
                                            <div className="text-sm tracking-[0.2em] uppercase text-purple-300">Rendering Slide</div>
                                            <p className="text-zinc-300 max-w-md">
                                                The image model is generating a complete slide, including layout and text.
                                            </p>
                                        </div>
                                        {onStopGeneration && (
                                            <button
                                                onClick={onStopGeneration}
                                                className="px-5 py-2.5 rounded-full bg-red-500/20 hover:bg-red-500/35 border border-red-500/40 text-red-100 transition flex items-center gap-2"
                                            >
                                                <Square size={14} fill="currentColor" />
                                                Stop
                                            </button>
                                        )}
                                    </>
                                )}

                                {slide.generationFailed && !slide.isGeneratingImage && (
                                    <>
                                        <div className="p-3 rounded-full bg-red-500/10 text-red-400">
                                            <AlertCircle size={40} />
                                        </div>
                                        <div className="space-y-1">
                                            <div className="text-lg font-semibold text-white">Slide image generation failed</div>
                                            <p className="text-zinc-400 max-w-md">
                                                You can retry with the current content, or skip and continue editing the deck.
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            {onIgnore && (
                                                <button
                                                    onClick={onIgnore}
                                                    className="px-5 py-2.5 rounded-full bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition"
                                                >
                                                    Skip
                                                </button>
                                            )}
                                            <button
                                                onClick={() => onRegenerate(slide.visualDescription)}
                                                className="px-5 py-2.5 rounded-full bg-purple-600 hover:bg-purple-500 text-white transition flex items-center gap-2"
                                            >
                                                <RefreshCw size={14} />
                                                Retry
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        )}

                        {onDelete && (
                            <button
                                onClick={onDelete}
                                className="absolute top-4 left-4 p-2 rounded-full bg-black/60 hover:bg-red-500 text-white transition shadow-lg"
                                title="Delete slide"
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <aside className="w-[360px] border-l border-zinc-800 bg-zinc-950 p-5 overflow-y-auto custom-scrollbar">
                <div className="space-y-5">
                    <div>
                        <div className="text-[11px] uppercase tracking-[0.25em] text-zinc-500 mb-2">Full Slide Prompt</div>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Edit the slide content, then click regenerate. The image model renders the complete slide in one pass.
                        </p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Title</label>
                        <input
                            value={slide.title}
                            onChange={(e) => onSlideUpdate({ title: e.target.value })}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none focus:border-purple-500/50"
                            placeholder="Slide title"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Body Copy</label>
                        <textarea
                            value={slide.content}
                            onChange={(e) => onSlideUpdate({ content: e.target.value })}
                            rows={8}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none resize-none focus:border-purple-500/50"
                            placeholder="Main bullet points or supporting copy"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Visual Direction</label>
                        <textarea
                            value={slide.visualDescription}
                            onChange={(e) => onSlideUpdate({ visualDescription: e.target.value })}
                            rows={5}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none resize-none focus:border-purple-500/50"
                            placeholder="Describe composition, imagery, tone, and emphasis"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Layout</label>
                        <select
                            value={slide.layout || 'title-left'}
                            onChange={(e) => onSlideUpdate({ layout: e.target.value })}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none focus:border-purple-500/50"
                        >
                            {layoutOptions.map((layout) => (
                                <option key={layout.id} value={layout.id}>
                                    {layout.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs text-zinc-500 uppercase tracking-wider">Narrative Goal</label>
                        <textarea
                            value={slide.narrativeGoal || ''}
                            onChange={(e) => onSlideUpdate({ narrativeGoal: e.target.value })}
                            rows={3}
                            className="w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none resize-none focus:border-purple-500/50"
                            placeholder="What this slide should make the audience understand"
                        />
                    </div>

                    <div className="rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4 space-y-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">Important</div>
                        <p className="text-sm text-zinc-400 leading-relaxed">
                            Text edits do not auto-refresh the generated image. Regenerate when you want the visual output to match the latest content.
                        </p>
                        <button
                            onClick={() => onRegenerate(slide.visualDescription)}
                            disabled={slide.isGeneratingImage}
                            className="w-full rounded-xl bg-white text-black hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500 px-4 py-3 font-medium transition flex items-center justify-center gap-2"
                        >
                            {slide.isGeneratingImage ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                            {slide.isGeneratingImage ? 'Generating...' : 'Regenerate Full Slide'}
                        </button>
                    </div>
                </div>
            </aside>
        </div>
    );
};

export default SlideViewer;
