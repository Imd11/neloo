import React, { useState, useEffect, useRef, useCallback } from "react";
import { ArrowLeft, Download, Loader2, Undo, Redo } from "lucide-react";
import { Slide, PresentationData, StyleDimensions } from "../types";
import {
  generateSlideImage,
  generateSingleSlide,
} from "../services/geminiService";
import { getActivePalette } from "../data/styleInstructions";
import SlideThumbnails from "./SlideThumbnails";
import SlideViewer from "./SlideViewer";

interface SlideShowProps {
  presentation: PresentationData;
  style?: StyleDimensions;
  modelId?: string | null;
  accessToken?: string;
  onBack: () => void;
  onSlidesUpdate: (slides: Slide[]) => void;
}

const SlideShow: React.FC<SlideShowProps> = ({
  presentation,
  style,
  modelId,
  accessToken,
  onBack,
  onSlidesUpdate,
}) => {
  const [slides, setSlides] = useState<Slide[]>(presentation.slides);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isExporting, setIsExporting] = useState(false);
  const imageQueueRef = useRef<Set<string>>(new Set());
  const abortRefs = useRef<Map<string, AbortController>>(new Map());

  // ─── Global Undo/Redo (#5) ───
  const [history, setHistory] = useState<Slide[][]>([presentation.slides]);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [imageCache, setImageCache] = useState<Record<string, string>>({});

  const pushHistory = useCallback(
    (newSlides: Slide[]) => {
      // Cache any images before pushing
      const newCache = { ...imageCache };
      newSlides.forEach((s) => {
        if (s.imageBase64) newCache[s.id] = s.imageBase64;
      });
      setImageCache(newCache);

      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        trimmed.push(newSlides);
        if (trimmed.length > 50) trimmed.shift();
        return trimmed;
      });
      setHistoryIndex((prev) => Math.min(prev + 1, 49));
    },
    [historyIndex, imageCache]
  );

  const handleUndo = () => {
    if (historyIndex <= 0) return;
    const newIdx = historyIndex - 1;
    const restored = history[newIdx].map((s) => ({
      ...s,
      imageBase64: s.imageBase64 || imageCache[s.id],
    }));
    setSlides(restored);
    setHistoryIndex(newIdx);
    onSlidesUpdate(restored);
  };

  const handleRedo = () => {
    if (historyIndex >= history.length - 1) return;
    const newIdx = historyIndex + 1;
    const restored = history[newIdx].map((s) => ({
      ...s,
      imageBase64: s.imageBase64 || imageCache[s.id],
    }));
    setSlides(restored);
    setHistoryIndex(newIdx);
    onSlidesUpdate(restored);
  };

  useEffect(() => {
    setSlides(presentation.slides);
  }, [presentation.slides]);

  // Cache images as they arrive
  useEffect(() => {
    const newCache = { ...imageCache };
    let changed = false;
    slides.forEach((s) => {
      if (s.imageBase64 && !newCache[s.id]) {
        newCache[s.id] = s.imageBase64;
        changed = true;
      }
    });
    if (changed) setImageCache(newCache);
  }, [slides]);

  // Smart image generation queue
  useEffect(() => {
    const generateQueue = async () => {
      const order = [currentIndex];
      for (let d = 1; d <= slides.length; d++) {
        if (currentIndex + d < slides.length) order.push(currentIndex + d);
        if (currentIndex - d >= 0) order.push(currentIndex - d);
      }

      for (const idx of order) {
        const slide = slides[idx];
        if (
          !slide ||
          slide.imageBase64 ||
          slide.isGeneratingImage ||
          imageQueueRef.current.has(slide.id)
        )
          continue;
        imageQueueRef.current.add(slide.id);
        generateImageForSlide(idx, slide);
      }
    };
    generateQueue();
  }, [slides.length, currentIndex]);

  const generateImageForSlide = async (idx: number, slide: Slide) => {
    updateSlideAtIndex(idx, {
      isGeneratingImage: true,
      generationFailed: false,
    });

    const controller = new AbortController();
    abortRefs.current.set(slide.id, controller);

    try {
      const base64 = await generateSlideImage(
        slide,
        style,
        controller.signal,
        presentation.presetId
      );
      updateSlideAtIndex(idx, {
        imageBase64: base64,
        isGeneratingImage: false,
      });
    } catch (err: any) {
      if (err.name !== "AbortError") {
        updateSlideAtIndex(idx, {
          isGeneratingImage: false,
          generationFailed: true,
        });
      }
    } finally {
      imageQueueRef.current.delete(slide.id);
      abortRefs.current.delete(slide.id);
    }
  };

  const updateSlideAtIndex = useCallback(
    (idx: number, updates: Partial<Slide>) => {
      setSlides((prev) => {
        const next = [...prev];
        if (next[idx]) next[idx] = { ...next[idx], ...updates };
        return next;
      });
    },
    []
  );

  // Debounced auto-save
  const saveTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => {
    if (saveTimeout.current) clearTimeout(saveTimeout.current);
    saveTimeout.current = setTimeout(() => {
      onSlidesUpdate(slides);
    }, 1000);
    return () => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
    };
  }, [slides]);

  const handleSlideUpdate = (updates: Partial<Slide>) => {
    const newSlides = [...slides];
    newSlides[currentIndex] = { ...newSlides[currentIndex], ...updates };
    setSlides(newSlides);
    // Only push history for meaningful content changes, not image/generating state
    if (
      "title" in updates ||
      "content" in updates ||
      "visualDescription" in updates ||
      "layout" in updates ||
      "narrativeGoal" in updates ||
      "slideType" in updates
    ) {
      pushHistory(newSlides);
    }
  };

  const handleRegenerate = (desc: string) => {
    const slide = slides[currentIndex];
    if (!slide) return;
    imageQueueRef.current.delete(slide.id);
    const updatedSlide = {
      ...slide,
      visualDescription: desc,
      imageBase64: undefined,
      generationFailed: false,
    };
    const newSlides = [...slides];
    newSlides[currentIndex] = updatedSlide;
    setSlides(newSlides);
    generateImageForSlide(currentIndex, updatedSlide);
  };

  // ─── New Callbacks for SlideViewer (#4) ───
  const handleStopGeneration = () => {
    const slide = slides[currentIndex];
    if (!slide) return;
    const ctrl = abortRefs.current.get(slide.id);
    if (ctrl) ctrl.abort();
    imageQueueRef.current.delete(slide.id);
    updateSlideAtIndex(currentIndex, { isGeneratingImage: false });
  };

  const handleIgnoreFailure = () => {
    updateSlideAtIndex(currentIndex, { generationFailed: false });
  };

  const handleReorder = (from: number, to: number) => {
    const newSlides = [...slides];
    const [moved] = newSlides.splice(from, 1);
    newSlides.splice(to, 0, moved);
    setSlides(newSlides);
    pushHistory(newSlides);
    if (currentIndex === from) setCurrentIndex(to);
    else if (from < currentIndex && to >= currentIndex)
      setCurrentIndex(currentIndex - 1);
    else if (from > currentIndex && to <= currentIndex)
      setCurrentIndex(currentIndex + 1);
  };

  const handleAddSlide = async (atIndex: number) => {
    const newSlide = await generateSingleSlide(
      presentation.topic,
      slides,
      atIndex,
      style,
      presentation.presetId,
      modelId,
      accessToken
    );
    if (newSlide) {
      const newSlides = [...slides];
      newSlides.splice(atIndex, 0, newSlide);
      setSlides(newSlides);
      pushHistory(newSlides);
      setCurrentIndex(atIndex);
    }
  };

  const handleDeleteSlide = (idx?: number) => {
    const deleteIdx = idx ?? currentIndex;
    if (slides.length <= 1) return;
    const slide = slides[deleteIdx];
    const ctrl = abortRefs.current.get(slide.id);
    if (ctrl) ctrl.abort();
    const newSlides = slides.filter((_, i) => i !== deleteIdx);
    setSlides(newSlides);
    pushHistory(newSlides);
    if (currentIndex >= newSlides.length) setCurrentIndex(newSlides.length - 1);
    else if (currentIndex > deleteIdx) setCurrentIndex(currentIndex - 1);
  };

  // PPTX Export using full-slide images
  const handleExportPPTX = async () => {
    setIsExporting(true);
    try {
      const pptxgenjs = (await import("pptxgenjs")).default;
      const pres = new pptxgenjs();
      pres.layout = "LAYOUT_16x9";
      pres.author = "Slide Craft";
      pres.title = presentation.topic;

      const palette = getActivePalette(presentation.presetId, style);

      for (const slide of slides) {
        const pptSlide = pres.addSlide();

        if (slide.imageBase64) {
          pptSlide.background = {
            data: `image/png;base64,${slide.imageBase64}`,
          };
        } else {
          pptSlide.background = { color: palette.background.replace("#", "") };
          const textColor = slide.imageBase64
            ? "FFFFFF"
            : palette.primaryText.replace("#", "");
          pptSlide.addText(slide.title, {
            x: 0.8,
            y: 0.8,
            w: 8.4,
            fontSize: 32,
            fontFace: "Inter",
            color: textColor,
            bold: true,
            align: "left",
            valign: "top",
            margin: 0,
            shadow: {
              type: "outer",
              blur: 3,
              offset: 1,
              color: "000000",
              opacity: 0.5,
            },
          });
          pptSlide.addText(slide.content, {
            x: 0.8,
            y: 2.0,
            w: 8.4,
            h: 3.0,
            fontSize: 16,
            fontFace: "Inter",
            color: textColor,
            align: "left",
            valign: "top",
            margin: 0,
            lineSpacingMultiple: 1.4,
            shadow: {
              type: "outer",
              blur: 3,
              offset: 1,
              color: "000000",
              opacity: 0.5,
            },
          });
        }
      }

      // Safe filename
      const safeName = presentation.topic
        .slice(0, 30)
        .replace(/[\\/:*?"<>|]/g, "_")
        .trim();
      await pres.writeFile({ fileName: `${safeName} - SlideCraft.pptx` });
    } catch (e) {
      console.error("Export error:", e);
      alert("导出失败：" + (e as Error).message);
    } finally {
      setIsExporting(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a textarea/input
      if (
        (e.target as HTMLElement).tagName === "TEXTAREA" ||
        (e.target as HTMLElement).tagName === "INPUT"
      )
        return;

      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        setCurrentIndex((i) => Math.min(i + 1, slides.length - 1));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        setCurrentIndex((i) => Math.max(i - 1, 0));
      } else if ((e.metaKey || e.ctrlKey) && e.key === "z") {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [slides.length, historyIndex, history]);

  // Count generating images
  const generatingCount = slides.filter((s) => s.isGeneratingImage).length;
  const currentSlide = slides[currentIndex];

  return (
    <div className="flex h-screen min-h-screen flex-col bg-zinc-950">
      {/* Top bar */}
      <div className="z-50 flex h-14 flex-shrink-0 items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-2 text-sm text-zinc-400 transition hover:text-white"
          >
            <ArrowLeft size={16} /> 返回
          </button>
          <span className="text-zinc-700">|</span>

          {/* Undo / Redo */}
          <button
            onClick={handleUndo}
            disabled={historyIndex <= 0}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30"
            title="撤销 (⌘Z)"
          >
            <Undo size={16} />
          </button>
          <button
            onClick={handleRedo}
            disabled={historyIndex >= history.length - 1}
            className="rounded-lg p-1.5 text-zinc-500 transition hover:bg-zinc-800 hover:text-white disabled:opacity-30"
            title="重做 (⌘⇧Z)"
          >
            <Redo size={16} />
          </button>
        </div>

        {/* Centered title */}
        <h2 className="pointer-events-none absolute left-1/2 max-w-xs -translate-x-1/2 transform truncate text-sm font-medium text-zinc-300">
          {presentation.topic}
        </h2>

        <div className="flex items-center gap-3">
          {/* Generation status */}
          {generatingCount > 0 && (
            <span className="text-purple-400 flex animate-pulse items-center gap-1.5 text-xs">
              <Loader2
                size={12}
                className="animate-spin"
              />
              处理中 {generatingCount}...
            </span>
          )}
          <span className="font-mono text-xs text-zinc-500">
            {currentIndex + 1} / {slides.length}
          </span>
          <button
            onClick={handleExportPPTX}
            disabled={isExporting}
            className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-medium text-zinc-900 shadow-lg transition hover:bg-zinc-200 disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            {isExporting ? (
              <Loader2
                size={14}
                className="animate-spin"
              />
            ) : (
              <Download size={14} />
            )}
            {isExporting ? "导出中..." : "导出 PPTX"}
          </button>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        <SlideThumbnails
          slides={slides}
          currentIndex={currentIndex}
          onSlideSelect={setCurrentIndex}
          onAddSlide={handleAddSlide}
          onDelete={handleDeleteSlide}
          onReorder={handleReorder}
        />
        {currentSlide && (
          <SlideViewer
            slide={currentSlide}
            isFirst={currentIndex === 0}
            isLast={currentIndex === slides.length - 1}
            onPrev={() => setCurrentIndex((i) => i - 1)}
            onNext={() => setCurrentIndex((i) => i + 1)}
            onSlideUpdate={handleSlideUpdate}
            onRegenerate={handleRegenerate}
            onStopGeneration={handleStopGeneration}
            onIgnore={handleIgnoreFailure}
            onDelete={() => handleDeleteSlide()}
            style={style}
            presetId={presentation.presetId}
          />
        )}
      </div>
    </div>
  );
};

export default SlideShow;
