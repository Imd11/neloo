import React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  RefreshCw,
  AlertCircle,
  Square,
  Trash2,
} from "lucide-react";
import { Slide, StyleDimensions } from "../types";
import { LAYOUTS } from "../data/layouts";

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
    <div className="flex flex-1 overflow-hidden bg-zinc-900">
      <div className="relative flex-1 overflow-hidden">
        <button
          onClick={onPrev}
          disabled={isFirst}
          className="absolute left-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/50 p-4 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-0"
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={onNext}
          disabled={isLast}
          className="absolute right-4 top-1/2 z-40 -translate-y-1/2 rounded-full bg-black/50 p-4 text-white backdrop-blur transition hover:bg-black/80 disabled:opacity-0"
        >
          <ChevronRight size={24} />
        </button>

        <div className="absolute inset-0 flex items-center justify-center p-8">
          <div className="relative aspect-video w-full max-w-6xl overflow-hidden rounded-2xl border border-zinc-800 bg-black shadow-2xl">
            {slide.imageBase64 ? (
              <img
                src={`data:image/png;base64,${slide.imageBase64}`}
                alt={slide.title}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-zinc-950 text-zinc-500">
                {slide.isGeneratingImage ? (
                  <>
                    <Loader2
                      size={40}
                      className="text-purple-400 animate-spin"
                    />
                    <p>Generating full slide image...</p>
                  </>
                ) : (
                  <>
                    <div className="text-sm uppercase tracking-[0.25em] text-zinc-600">
                      Slide Preview
                    </div>
                    <p>No generated image yet</p>
                  </>
                )}
              </div>
            )}

            {(slide.isGeneratingImage || slide.generationFailed) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-black/75 p-6 text-center backdrop-blur-sm">
                {slide.isGeneratingImage && (
                  <>
                    <Loader2
                      size={44}
                      className="text-purple-400 animate-spin"
                    />
                    <div className="space-y-1">
                      <div className="text-purple-300 text-sm uppercase tracking-[0.2em]">
                        Rendering Slide
                      </div>
                      <p className="max-w-md text-zinc-300">
                        The image model is generating a complete slide,
                        including layout and text.
                      </p>
                    </div>
                    {onStopGeneration && (
                      <button
                        onClick={onStopGeneration}
                        className="flex items-center gap-2 rounded-full border border-red-500/40 bg-red-500/20 px-5 py-2.5 text-red-100 transition hover:bg-red-500/35"
                      >
                        <Square
                          size={14}
                          fill="currentColor"
                        />
                        Stop
                      </button>
                    )}
                  </>
                )}

                {slide.generationFailed && !slide.isGeneratingImage && (
                  <>
                    <div className="rounded-full bg-red-500/10 p-3 text-red-400">
                      <AlertCircle size={40} />
                    </div>
                    <div className="space-y-1">
                      <div className="text-lg font-semibold text-white">
                        Slide image generation failed
                      </div>
                      <p className="max-w-md text-zinc-400">
                        You can retry with the current content, or skip and
                        continue editing the deck.
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      {onIgnore && (
                        <button
                          onClick={onIgnore}
                          className="rounded-full bg-zinc-800 px-5 py-2.5 text-zinc-200 transition hover:bg-zinc-700"
                        >
                          Skip
                        </button>
                      )}
                      <button
                        onClick={() => onRegenerate(slide.visualDescription)}
                        className="bg-purple-600 hover:bg-purple-500 flex items-center gap-2 rounded-full px-5 py-2.5 text-white transition"
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
                className="absolute left-4 top-4 rounded-full bg-black/60 p-2 text-white shadow-lg transition hover:bg-red-500"
                title="Delete slide"
              >
                <Trash2 size={18} />
              </button>
            )}
          </div>
        </div>
      </div>

      <aside className="custom-scrollbar w-[360px] overflow-y-auto border-l border-zinc-800 bg-zinc-950 p-5">
        <div className="space-y-5">
          <div>
            <div className="mb-2 text-[11px] uppercase tracking-[0.25em] text-zinc-500">
              Full Slide Prompt
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Edit the slide content, then click regenerate. The image model
              renders the complete slide in one pass.
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Title
            </label>
            <input
              value={slide.title}
              onChange={(e) => onSlideUpdate({ title: e.target.value })}
              className="focus:border-purple-500/50 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-zinc-100 outline-none"
              placeholder="Slide title"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Body Copy
            </label>
            <textarea
              value={slide.content}
              onChange={(e) => onSlideUpdate({ content: e.target.value })}
              rows={8}
              className="focus:border-purple-500/50 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none"
              placeholder="Main bullet points or supporting copy"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Visual Direction
            </label>
            <textarea
              value={slide.visualDescription}
              onChange={(e) =>
                onSlideUpdate({ visualDescription: e.target.value })
              }
              rows={5}
              className="focus:border-purple-500/50 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none"
              placeholder="Describe composition, imagery, tone, and emphasis"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Layout
            </label>
            <select
              value={slide.layout || "title-left"}
              onChange={(e) => onSlideUpdate({ layout: e.target.value })}
              className="focus:border-purple-500/50 w-full rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-200 outline-none"
            >
              {layoutOptions.map((layout) => (
                <option
                  key={layout.id}
                  value={layout.id}
                >
                  {layout.name}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs uppercase tracking-wider text-zinc-500">
              Narrative Goal
            </label>
            <textarea
              value={slide.narrativeGoal || ""}
              onChange={(e) => onSlideUpdate({ narrativeGoal: e.target.value })}
              rows={3}
              className="focus:border-purple-500/50 w-full resize-none rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-3 text-sm text-zinc-300 outline-none"
              placeholder="What this slide should make the audience understand"
            />
          </div>

          <div className="space-y-3 rounded-2xl border border-zinc-800 bg-zinc-900/70 p-4">
            <div className="text-xs uppercase tracking-[0.2em] text-zinc-500">
              Important
            </div>
            <p className="text-sm leading-relaxed text-zinc-400">
              Text edits do not auto-refresh the generated image. Regenerate
              when you want the visual output to match the latest content.
            </p>
            <button
              onClick={() => onRegenerate(slide.visualDescription)}
              disabled={slide.isGeneratingImage}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 font-medium text-black transition hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
            >
              {slide.isGeneratingImage ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                />
              ) : (
                <RefreshCw size={16} />
              )}
              {slide.isGeneratingImage
                ? "Generating..."
                : "Regenerate Full Slide"}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
};

export default SlideViewer;
