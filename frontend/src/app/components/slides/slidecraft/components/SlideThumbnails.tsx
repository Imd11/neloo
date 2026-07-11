import React, { useState } from "react";
import { Loader2, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { Slide } from "../types";

interface SlideThumbnailsProps {
  slides: Slide[];
  currentIndex: number;
  onSlideSelect: (index: number) => void;
  onAddSlide: (index: number) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onDelete: (index: number) => void;
}

const SlideThumbnails: React.FC<SlideThumbnailsProps> = ({
  slides,
  currentIndex,
  onSlideSelect,
  onAddSlide,
  onReorder,
  onDelete,
}) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    const target = e.target as HTMLElement;
    if (target.closest("button")) {
      e.preventDefault();
      return;
    }

    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    if (draggedIndex !== null && draggedIndex !== index) {
      onReorder(draggedIndex, index);
    }
    setDraggedIndex(null);
  };

  return (
    <div className="custom-scrollbar flex w-24 flex-shrink-0 flex-col gap-4 overflow-y-auto border-r border-zinc-800 bg-zinc-950 p-4 pb-20 md:w-64">
      {slides.map((slide, idx) => {
        const isDragging = draggedIndex !== null;
        const isOver = dragOverIndex === idx;
        const isDraggingSelf = draggedIndex === idx;
        const showBottomIndicator =
          isOver && draggedIndex !== null && draggedIndex < idx;
        const showTopIndicator =
          isOver && draggedIndex !== null && draggedIndex > idx;

        return (
          <div
            key={slide.id}
            className={`group/thumbnail relative transition-all ${
              isDraggingSelf ? "scale-95 opacity-50" : "opacity-100"
            }`}
            draggable
            onDragStart={(e) => handleDragStart(e, idx)}
            onDragOver={(e) => handleDragOver(e, idx)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, idx)}
          >
            {showTopIndicator && (
              <div className="bg-purple-500 pointer-events-none absolute -top-2 left-0 right-0 z-20 h-1 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            )}
            {showBottomIndicator && (
              <div className="bg-purple-500 pointer-events-none absolute -bottom-2 left-0 right-0 z-20 h-1 rounded-full shadow-[0_0_10px_rgba(168,85,247,0.8)]" />
            )}

            <div
              onClick={() => onSlideSelect(idx)}
              className={`relative aspect-video cursor-pointer overflow-hidden rounded-lg border-2 transition-all ${
                currentIndex === idx
                  ? "border-purple-500 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                  : "border-zinc-800 hover:border-zinc-600"
              }`}
            >
              {slide.imageBase64 ? (
                <img
                  src={`data:image/png;base64,${slide.imageBase64}`}
                  className="pointer-events-none h-full w-full object-cover"
                  alt={`Slide ${idx + 1}`}
                />
              ) : (
                <div className="pointer-events-none flex h-full w-full flex-col items-center justify-center bg-zinc-900 p-2 text-center">
                  {slide.isGeneratingImage ? (
                    <Loader2
                      className="text-purple-500 animate-spin"
                      size={16}
                    />
                  ) : (
                    <ImageIcon
                      className="text-zinc-700"
                      size={16}
                    />
                  )}
                </div>
              )}

              <div className="pointer-events-none absolute left-1 top-1 rounded bg-black/70 px-1.5 py-0.5 font-mono text-[10px] text-white">
                {idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-end bg-gradient-to-t from-black/90 to-transparent p-2 opacity-0 hover:opacity-100">
                <p className="line-clamp-2 text-[10px] leading-tight text-zinc-300">
                  {slide.title}
                </p>
              </div>
            </div>

            {!isDragging && (
              <>
                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onDelete(idx);
                  }}
                  className="absolute right-1 top-1 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-white/5 bg-black/60 text-zinc-400 opacity-0 shadow-sm transition-all hover:bg-black hover:text-red-400 group-hover/thumbnail:opacity-100"
                  title="Delete slide"
                >
                  <Trash2 size={12} />
                </button>

                <button
                  onPointerDown={(e) => e.stopPropagation()}
                  onMouseDown={(e) => e.stopPropagation()}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onAddSlide(idx + 1);
                  }}
                  className="bg-purple-600 absolute -bottom-3 left-1/2 z-50 flex h-6 w-6 -translate-x-1/2 cursor-pointer items-center justify-center rounded-full text-white opacity-0 shadow-lg transition-all hover:scale-110 group-hover/thumbnail:opacity-100"
                  title="Insert slide after this"
                >
                  <Plus size={14} />
                </button>
              </>
            )}
          </div>
        );
      })}

      <button
        onClick={() => onAddSlide(slides.length)}
        className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-zinc-800 text-zinc-500 transition hover:border-zinc-600 hover:bg-zinc-900/50 hover:text-zinc-300"
      >
        <Plus size={24} />
        <span className="text-xs font-medium">New Slide</span>
      </button>
    </div>
  );
};

export default SlideThumbnails;
