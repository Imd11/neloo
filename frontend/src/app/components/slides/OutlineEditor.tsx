"use client";

import React, { useEffect, useState, useRef } from "react";
import { ArrowLeft, Loader2, Play, Trash2, AlertCircle } from "lucide-react";
import type { Slide, Attachment } from "@/app/slides/types/slides";
import { generateOutlineStream } from "@/app/slides/lib/slidesService";

interface OutlineEditorProps {
  topic: string;
  initialAttachments: Attachment[];
  onBack: () => void;
  onGenerateSlides: (slides: Slide[]) => void;
  onStreamUpdate?: (text: string) => void; // For AI chat panel
  showAIPanel?: boolean; // For adjusting button position
}

const OutlineEditor: React.FC<OutlineEditorProps> = ({
  topic,
  initialAttachments,
  onBack,
  onGenerateSlides,
  onStreamUpdate,
  showAIPanel = true,
}) => {
  const [rawOutput, setRawOutput] = useState("");
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
            if (text.trim().endsWith("]")) {
              const parsed = JSON.parse(text);
              if (Array.isArray(parsed)) {
                setSlides(parsed.map((s, i) => ({ ...s, id: `slide-${i}` })));
                setParseError(false);
              }
            }
          } catch {
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

    return () => {
      mounted = false;
    };
  }, [topic, initialAttachments, onStreamUpdate]);

  // Handle final parsing when generation stops
  useEffect(() => {
    if (!isGenerating && rawOutput) {
      try {
        const cleanJson = rawOutput
          .replace(/```json/g, "")
          .replace(/```/g, "")
          .trim();
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
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rawOutput, isGenerating]);

  const updateSlide = (id: string, field: keyof Slide, value: string) => {
    setSlides((prev) =>
      prev.map((s) => (s.id === id ? { ...s, [field]: value } : s))
    );
  };

  const deleteSlide = (id: string) => {
    setSlides((prev) => prev.filter((s) => s.id !== id));
  };

  return (
    <div className="flex h-full flex-col bg-zinc-950">
      {/* Navbar */}
      <header className="flex h-16 flex-shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950/50 px-6 backdrop-blur">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-900 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex flex-col">
            <h2 className="max-w-md truncate text-lg font-semibold text-white">
              {topic || "无标题"}
            </h2>
            {initialAttachments.length > 0 && (
              <span className="flex items-center gap-1 text-[10px] text-zinc-500">
                已附加: {initialAttachments.length} 个文件
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {isGenerating && (
            <span className="text-purple-400 flex animate-pulse items-center gap-1 text-xs">
              <Loader2
                size={12}
                className="animate-spin"
              />{" "}
              AI 生成中...
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl space-y-6 pb-20">
          <div className="mb-6 flex items-end justify-between">
            <div>
              <h3 className="text-2xl font-bold text-white">幻灯片大纲</h3>
              <p className="mt-1 text-sm text-zinc-400">
                在生成图片之前，请查看并编辑您的结构。
              </p>
            </div>
          </div>

          {slides.length === 0 && !parseError && (
            <div className="flex h-64 flex-col items-center justify-center space-y-4 text-zinc-500">
              {hasStreamStarted ? (
                <Loader2
                  className="text-purple-500 animate-spin"
                  size={32}
                />
              ) : null}
              <p>{hasStreamStarted ? "解析结构中..." : "初始化中..."}</p>
            </div>
          )}

          {parseError && (
            <div className="flex items-center gap-3 rounded-lg border border-red-900/50 bg-red-900/10 p-4 text-red-200">
              <AlertCircle size={20} />
              <p>无法自动解析大纲。请重试或等待生成完成。</p>
            </div>
          )}

          {slides.map((slide, index) => (
            <div
              key={slide.id}
              className="group rounded-xl border border-zinc-800 bg-zinc-900 p-6 transition-all hover:border-zinc-700 hover:shadow-xl hover:shadow-black/50"
            >
              <div className="mb-4 flex items-start justify-between border-b border-zinc-800 pb-2">
                <span className="rounded bg-zinc-950 px-2 py-1 font-mono text-xs text-zinc-500">
                  幻灯片 {index + 1}
                </span>
                <button
                  onClick={() => deleteSlide(slide.id)}
                  className="p-1 text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-500">
                    标题
                  </label>
                  <input
                    className="focus:border-purple-500 w-full border-b border-transparent bg-transparent py-1 text-xl font-bold text-white outline-none"
                    value={slide.title}
                    onChange={(e) =>
                      updateSlide(slide.id, "title", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold uppercase text-zinc-500">
                    内容
                  </label>
                  <textarea
                    className="mt-1 min-h-[80px] w-full rounded-lg border border-transparent bg-zinc-950/50 p-3 text-sm text-zinc-300 outline-none focus:border-zinc-700"
                    value={slide.content}
                    onChange={(e) =>
                      updateSlide(slide.id, "content", e.target.value)
                    }
                  />
                </div>

                <div>
                  <label className="flex items-center gap-2 text-xs font-semibold uppercase text-zinc-500">
                    视觉提示{" "}
                    <span className="bg-purple-900/30 text-purple-300 rounded px-1 text-[10px]">
                      AI
                    </span>
                  </label>
                  <textarea
                    className="mt-1 min-h-[60px] w-full rounded-lg border border-transparent bg-zinc-950/30 p-3 text-xs italic text-zinc-400 outline-none focus:border-zinc-700"
                    value={slide.visualDescription}
                    onChange={(e) =>
                      updateSlide(slide.id, "visualDescription", e.target.value)
                    }
                  />
                </div>
              </div>
            </div>
          ))}

          {/* Generate Button Footer */}
          {slides.length > 0 && (
            <div
              className={`fixed bottom-6 z-20 transition-all duration-300 ${
                showAIPanel ? "right-[340px]" : "right-6"
              }`}
            >
              <button
                onClick={() => onGenerateSlides(slides)}
                disabled={isGenerating}
                className="flex transform items-center gap-2 rounded-full bg-white px-6 py-3 font-bold text-black shadow-lg shadow-purple-900/20 transition-all hover:scale-105 hover:bg-zinc-200 disabled:scale-100 disabled:opacity-50"
              >
                {isGenerating ? (
                  <Loader2
                    className="animate-spin"
                    size={20}
                  />
                ) : (
                  <Play
                    size={20}
                    fill="currentColor"
                  />
                )}
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
