import React, { useEffect, useState, useRef } from "react";
import {
  ArrowLeft,
  Loader2,
  Play,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Edit3,
} from "lucide-react";
import { Slide, Attachment, StyleDimensions } from "../types";
import { generateOutlineStream } from "../services/geminiService";

interface OutlineEditorProps {
  topic: string;
  attachments: Attachment[];
  style?: StyleDimensions;
  presetId?: string;
  modelId?: string | null;
  accessToken?: string;
  onBack: () => void;
  onGenerateSlides: (slides: Slide[]) => void;
}

const OutlineEditor: React.FC<OutlineEditorProps> = ({
  topic,
  attachments,
  style,
  presetId,
  modelId,
  accessToken,
  onBack,
  onGenerateSlides,
}) => {
  const [slides, setSlides] = useState<Slide[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamText, setStreamText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const streamRef = useRef("");
  const abortRef = useRef<AbortController | null>(null);
  const streamPanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    startGeneration();
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const startGeneration = async () => {
    setIsStreaming(true);
    setError(null);
    setStreamText("");
    streamRef.current = "";
    setSlides([]);
    setIsDone(false);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const fullText = await generateOutlineStream(
        topic,
        attachments,
        style,
        (chunk) => {
          streamRef.current += chunk;
          setStreamText(streamRef.current);

          // Try to parse JSON progressively
          try {
            const cleaned = streamRef.current
              .replace(/```json\s*/g, "")
              .replace(/```\s*/g, "")
              .trim();
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) {
              setSlides(
                parsed.map((s: any, i: number) => ({
                  id: crypto.randomUUID(),
                  title: s.title || `Slide ${i + 1}`,
                  content: s.content || "",
                  visualDescription: s.visualDescription || "",
                  slideType: s.slideType || "content",
                  layout: s.layout || "title-left",
                  narrativeGoal: s.narrativeGoal || "",
                }))
              );
            }
          } catch {
            /* partial JSON, wait for more */
          }

          // Auto-scroll stream panel
          if (streamPanelRef.current) {
            streamPanelRef.current.scrollTop =
              streamPanelRef.current.scrollHeight;
          }
        },
        controller.signal,
        presetId,
        modelId,
        accessToken
      );

      // Final parse
      const cleaned = fullText
        .replace(/```json\s*/g, "")
        .replace(/```\s*/g, "")
        .trim();
      try {
        const parsed = JSON.parse(cleaned);
        if (Array.isArray(parsed)) {
          setSlides(
            parsed.map((s: any, i: number) => ({
              id: crypto.randomUUID(),
              title: s.title || `Slide ${i + 1}`,
              content: s.content || "",
              visualDescription: s.visualDescription || "",
              slideType: s.slideType || "content",
              layout: s.layout || "title-left",
              narrativeGoal: s.narrativeGoal || "",
            }))
          );
        }
      } catch {
        setError("Failed to parse outline JSON. Please retry.");
      }

      setIsDone(true);
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setError(e.message || "Generation failed");
      }
    } finally {
      setIsStreaming(false);
    }
  };

  const updateSlide = (index: number, field: string, value: string) => {
    setSlides((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const deleteSlide = (index: number) => {
    setSlides((prev) => prev.filter((_, i) => i !== index));
  };

  const canProceed = slides.length > 0 && isDone;

  return (
    <div className="flex min-h-screen flex-col">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 p-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-zinc-400 transition hover:text-white"
        >
          <ArrowLeft size={18} /> 返回
        </button>
        <h2 className="flex items-center gap-2 text-lg font-semibold text-zinc-200">
          {isStreaming && (
            <Loader2
              size={18}
              className="text-purple-400 animate-spin"
            />
          )}
          大纲编辑
        </h2>
        <button
          onClick={() => onGenerateSlides(slides)}
          disabled={!canProceed}
          className="bg-purple-600 hover:bg-purple-500 flex items-center gap-2 rounded-xl px-5 py-2 font-medium text-white shadow-lg shadow-purple-900/30 transition disabled:bg-zinc-800 disabled:text-zinc-600 disabled:shadow-none"
        >
          <Play size={16} /> 生成幻灯片
        </button>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Stream */}
        <div
          ref={streamPanelRef}
          className="custom-scrollbar w-80 flex-shrink-0 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4"
        >
          <h3 className="mb-3 text-xs uppercase tracking-wider text-zinc-600">
            AI Token Stream
          </h3>
          <pre className="whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-green-400/70">
            {streamText || (isStreaming ? "Waiting for response..." : "")}
          </pre>
          {error && (
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
              <AlertCircle
                size={16}
                className="mt-0.5 flex-shrink-0"
              />
              <div>
                <p>{error}</p>
                <button
                  onClick={startGeneration}
                  className="mt-2 text-xs underline hover:text-red-300"
                >
                  重试
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Slide Cards */}
        <div className="custom-scrollbar flex-1 overflow-y-auto p-6">
          {slides.length === 0 && isStreaming && (
            <div className="flex h-full flex-col items-center justify-center text-zinc-500">
              <Loader2
                size={32}
                className="text-purple-400 mb-4 animate-spin"
              />
              <p>正在分析内容并生成大纲...</p>
            </div>
          )}

          <div className="mx-auto max-w-3xl space-y-4">
            {slides.map((slide, idx) => (
              <div
                key={slide.id}
                className="group relative rounded-xl border border-zinc-800 bg-zinc-900 p-5 fade-in"
              >
                {/* Slide number & type */}
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-zinc-800 px-2 py-0.5 font-mono text-xs text-zinc-600">
                      {String(idx + 1).padStart(2, "0")}
                    </span>
                    <span className="text-purple-400 bg-purple-500/10 rounded-full px-2 py-0.5 text-[10px]">
                      {slide.slideType}
                    </span>
                    <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-500">
                      {slide.layout}
                    </span>
                  </div>
                  <button
                    onClick={() => deleteSlide(idx)}
                    className="text-zinc-600 opacity-0 transition hover:text-red-400 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Title */}
                <input
                  value={slide.title}
                  onChange={(e) => updateSlide(idx, "title", e.target.value)}
                  className="focus:border-purple-500/30 mb-2 w-full border-b border-transparent bg-transparent text-lg font-semibold text-zinc-100 outline-none transition"
                  placeholder="Slide title..."
                />

                {/* Content */}
                <textarea
                  value={slide.content}
                  onChange={(e) => updateSlide(idx, "content", e.target.value)}
                  rows={3}
                  className="focus:border-purple-500/30 mb-3 w-full resize-none border-b border-transparent bg-transparent text-sm text-zinc-300 outline-none transition"
                  placeholder="Content..."
                />

                {/* Visual Description */}
                <div className="rounded-lg bg-zinc-800/50 p-3">
                  <label className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-zinc-500">
                    <Edit3 size={10} /> 视觉描述（指导 AI 生成整页幻灯片图片）
                  </label>
                  <textarea
                    value={slide.visualDescription}
                    onChange={(e) =>
                      updateSlide(idx, "visualDescription", e.target.value)
                    }
                    rows={2}
                    className="w-full resize-none bg-transparent text-xs text-zinc-400 outline-none"
                    placeholder="Describe the visual..."
                  />
                </div>

                {/* Narrative Goal */}
                {slide.narrativeGoal && (
                  <p className="mt-2 text-[10px] italic text-zinc-600">
                    🎯 {slide.narrativeGoal}
                  </p>
                )}
              </div>
            ))}
          </div>

          {isDone && slides.length > 0 && (
            <div className="mx-auto mt-6 flex max-w-3xl items-center gap-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-400">
              <CheckCircle2 size={16} />
              大纲生成完成！共 {slides.length}{" "}
              页。可编辑后点击「生成幻灯片」继续。
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OutlineEditor;
