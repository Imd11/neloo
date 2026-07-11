"use client";

import {
  useState,
  useRef,
  useEffect,
  useImperativeHandle,
  forwardRef,
} from "react";
import { createPortal } from "react-dom";
import {
  ContextMenu,
  ContextMenuItem,
} from "@/app/components/ui/custom-context-menu";
import {
  PenTool,
  Type as TypeIcon,
  Download,
  RotateCcw,
  X,
  AlertCircle,
} from "lucide-react";
import { useLanguageSafe } from "@/providers/LanguageProvider";
import { DownloadOverlay } from "@/app/components/ui/download-overlay";
import {
  CANVAS_IMAGE_CARD_WIDTH,
  getCanvasImagePlaceholderHeight,
} from "@/types/canvas";

interface CanvasImageProps {
  id: string;
  url: string;
  x: number;
  y: number;
  isSelected: boolean;
  isEditing: boolean;
  tool: "select" | "hand";
  onUpdate: (id: string, updates: { x: number; y: number }) => void;
  onImageLoad?: (id: string, measuredHeight: number) => void;
  onEditStart: (id: string, mode: "inpainting" | "text") => void;
  onRegenerate?: (id: string) => void;
  onDelete?: (id: string) => void;
  parentId?: string;
  status?: "loading" | "success" | "failed";
  error?: string;
  brushSize?: number;
  isEraser?: boolean;
  isRectTool?: boolean;
  deviceWidth?: number;
  deviceHeight?: number;
  loadingType?: "generate" | "edit";
  generationSize?: string;
  displayHeight?: number;
}

export interface CanvasImageRef {
  getMaskBlob: () => Promise<Blob | null>;
  getImageBlob: () => Promise<Blob | null>;
  getOriginalImageUrl: () => string;
  getMarkedImageDataUrl: () => string | null;
  getDisplayHeight: () => number;
  clearMask: () => void;
}

export const CanvasImage = forwardRef<CanvasImageRef, CanvasImageProps>(
  (
    {
      id,
      url,
      x,
      y,
      isSelected,
      isEditing,
      tool,
      onUpdate,
      onImageLoad,
      onEditStart,
      onRegenerate,
      onDelete,
      parentId,
      status,
      error,
      brushSize = 30,
      isEraser = false,
      isRectTool = false,
      deviceWidth,
      deviceHeight,
      loadingType = "edit",
      generationSize,
      displayHeight,
    },
    ref
  ) => {
    const { t } = useLanguageSafe();
    const [isDragging, setIsDragging] = useState(false);
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

    const imageRef = useRef<HTMLImageElement>(null);
    const visualCanvasRef = useRef<HTMLCanvasElement>(null);
    const dataCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [displayScale, setDisplayScale] = useState(1);
    const [downloadStatus, setDownloadStatus] = useState<{
      visible: boolean;
      status: "downloading" | "success" | "error";
    }>({ visible: false, status: "downloading" });

    const [rectStart, setRectStart] = useState<{ x: number; y: number } | null>(
      null
    );
    const [currentRect, setCurrentRect] = useState<{
      x: number;
      y: number;
      width: number;
      height: number;
    } | null>(null);

    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const placeholderHeight =
      displayHeight ?? getCanvasImagePlaceholderHeight(generationSize);

    const handleImageLoad = () => {
      if (!imageRef.current || !onImageLoad) return;
      const { naturalWidth, naturalHeight } = imageRef.current;
      if (!naturalWidth || !naturalHeight) return;
      const measuredHeight = Math.round(
        (CANVAS_IMAGE_CARD_WIDTH * naturalHeight) / naturalWidth
      );
      onImageLoad(id, measuredHeight);
    };

    useImperativeHandle(ref, () => ({
      getMaskBlob: async () => {
        if (!dataCanvasRef.current || !imageRef.current) return null;

        const dataCanvas = dataCanvasRef.current;
        const width = dataCanvas.width;
        const height = dataCanvas.height;

        const exportCanvas = document.createElement("canvas");
        exportCanvas.width = width;
        exportCanvas.height = height;
        const ctx = exportCanvas.getContext("2d");
        if (!ctx) return null;

        const dataCtx = dataCanvas.getContext("2d");
        if (!dataCtx) return null;
        const imageData = dataCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        for (let i = 0; i < pixels.length; i += 4) {
          const a = pixels[i + 3];
          if (a > 50) {
            pixels[i] = 255;
            pixels[i + 1] = 255;
            pixels[i + 2] = 255;
            pixels[i + 3] = 255;
          } else {
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
            pixels[i + 3] = 255;
          }
        }

        ctx.putImageData(imageData, 0, 0);
        return new Promise<Blob | null>((resolve) =>
          exportCanvas.toBlob(resolve, "image/png")
        );
      },
      getImageBlob: async () => {
        if (!imageRef.current) return null;
        const response = await fetch(url);
        return response.blob();
      },
      getOriginalImageUrl: () => url,
      getMarkedImageDataUrl: () => {
        if (!dataCanvasRef.current || !imageRef.current) return null;

        const width = imageRef.current.naturalWidth;
        const height = imageRef.current.naturalHeight;

        const markCanvas = document.createElement("canvas");
        markCanvas.width = width;
        markCanvas.height = height;
        const ctx = markCanvas.getContext("2d");
        if (!ctx) return null;

        ctx.drawImage(imageRef.current, 0, 0, width, height);

        const dataCtx = dataCanvasRef.current.getContext("2d");
        if (!dataCtx) return null;
        const imageData = dataCtx.getImageData(0, 0, width, height);
        const pixels = imageData.data;

        for (let i = 0; i < pixels.length; i += 4) {
          const a = pixels[i + 3];
          if (a > 50) {
            pixels[i] = 255;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
            pixels[i + 3] = 180;
          } else {
            pixels[i] = 0;
            pixels[i + 1] = 0;
            pixels[i + 2] = 0;
            pixels[i + 3] = 0;
          }
        }

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext("2d");
        if (tempCtx) {
          tempCtx.putImageData(imageData, 0, 0);
          ctx.drawImage(tempCanvas, 0, 0);
        }

        return markCanvas.toDataURL("image/jpeg", 0.9);
      },
      getDisplayHeight: () => {
        const imageHeight = imageRef.current?.getBoundingClientRect().height;
        if (imageHeight && Number.isFinite(imageHeight) && imageHeight > 0) {
          return imageHeight;
        }
        return placeholderHeight;
      },
      clearMask: () => {
        const vCtx = visualCanvasRef.current?.getContext("2d");
        const dCtx = dataCanvasRef.current?.getContext("2d");
        const w = visualCanvasRef.current?.width || 0;
        const h = visualCanvasRef.current?.height || 0;
        vCtx?.clearRect(0, 0, w, h);
        dCtx?.clearRect(0, 0, w, h);
      },
    }));

    useEffect(() => {
      if (
        isEditing &&
        imageRef.current &&
        visualCanvasRef.current &&
        dataCanvasRef.current
      ) {
        const width = imageRef.current.naturalWidth;
        const height = imageRef.current.naturalHeight;

        visualCanvasRef.current.width = width;
        visualCanvasRef.current.height = height;
        dataCanvasRef.current.width = width;
        dataCanvasRef.current.height = height;

        const rect = visualCanvasRef.current.getBoundingClientRect();
        if (rect.width > 0 && width > 0) {
          setDisplayScale(rect.width / width);
        }
      }
    }, [isEditing, url]);

    useEffect(() => {
      const handleResize = () => {
        if (!visualCanvasRef.current || !imageRef.current) return;
        const rect = visualCanvasRef.current.getBoundingClientRect();
        const width = imageRef.current.naturalWidth || rect.width;
        if (rect.width > 0 && width > 0) {
          setDisplayScale(rect.width / width);
        }
      };
      window.addEventListener("resize", handleResize);
      return () => window.removeEventListener("resize", handleResize);
    }, []);

    const handleMouseDown = (e: React.MouseEvent) => {
      if (tool === "hand" || isEditing) return;
      e.stopPropagation();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - x,
        y: e.clientY - y,
      });
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      onUpdate(id, {
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    useEffect(() => {
      if (isDragging) {
        window.addEventListener("mousemove", handleMouseMove);
        window.addEventListener("mouseup", handleMouseUp);
        return () => {
          window.removeEventListener("mousemove", handleMouseMove);
          window.removeEventListener("mouseup", handleMouseUp);
        };
      }
    }, [isDragging, dragOffset]);

    const getPoint = (e: React.MouseEvent) => {
      if (!visualCanvasRef.current) return { x: 0, y: 0 };
      const rect = visualCanvasRef.current.getBoundingClientRect();
      const scaleX = visualCanvasRef.current.width / rect.width;
      const scaleY = visualCanvasRef.current.height / rect.height;
      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    };

    const startDrawing = (e: React.MouseEvent) => {
      if (!isEditing) return;
      e.stopPropagation();

      if (isRectTool) {
        const point = getPoint(e);
        setRectStart(point);
        setCurrentRect(null);
        const vCtx = visualCanvasRef.current?.getContext("2d");
        const dCtx = dataCanvasRef.current?.getContext("2d");
        const w = visualCanvasRef.current?.width || 0;
        const h = visualCanvasRef.current?.height || 0;
        vCtx?.clearRect(0, 0, w, h);
        dCtx?.clearRect(0, 0, w, h);
      } else {
        setIsDrawing(true);
        draw(e);
      }
    };

    const draw = (e: React.MouseEvent) => {
      if (!isEditing || !visualCanvasRef.current || !dataCanvasRef.current)
        return;
      if (isRectTool) return;
      if (!isDrawing) return;

      const { x, y } = getPoint(e);
      const vCtx = visualCanvasRef.current.getContext("2d");
      const dCtx = dataCanvasRef.current.getContext("2d");
      if (!vCtx || !dCtx) return;

      vCtx.lineWidth = brushSize;
      vCtx.lineCap = "round";
      vCtx.lineJoin = "round";

      dCtx.lineWidth = brushSize;
      dCtx.lineCap = "round";
      dCtx.lineJoin = "round";

      if (isEraser) {
        vCtx.globalCompositeOperation = "destination-out";
        dCtx.globalCompositeOperation = "destination-out";
        vCtx.strokeStyle = "rgba(0,0,0,1)";
        dCtx.strokeStyle = "rgba(0,0,0,1)";
      } else {
        vCtx.globalCompositeOperation = "source-over";
        dCtx.globalCompositeOperation = "source-over";
        dCtx.strokeStyle = "#000000";
        vCtx.strokeStyle = "rgba(0,0,0,0)";
      }

      dCtx.lineTo(x, y);
      dCtx.stroke();
      dCtx.beginPath();
      dCtx.moveTo(x, y);

      if (!isEraser && visualCanvasRef.current && dataCanvasRef.current) {
        const vCtx2 = visualCanvasRef.current.getContext("2d");
        if (vCtx2) {
          vCtx2.clearRect(
            0,
            0,
            visualCanvasRef.current.width,
            visualCanvasRef.current.height
          );
          vCtx2.globalCompositeOperation = "source-over";
          vCtx2.drawImage(dataCanvasRef.current, 0, 0);
          vCtx2.globalCompositeOperation = "source-in";
          vCtx2.fillStyle = "rgba(255, 64, 64, 0.25)";
          vCtx2.fillRect(
            0,
            0,
            visualCanvasRef.current.width,
            visualCanvasRef.current.height
          );
        }
      }
    };

    const stopDrawing = () => {
      if (isRectTool && rectStart && currentRect) {
        const dCtx = dataCanvasRef.current?.getContext("2d");
        const vCtx = visualCanvasRef.current?.getContext("2d");
        if (dCtx && vCtx && visualCanvasRef.current && dataCanvasRef.current) {
          dCtx.globalCompositeOperation = "source-over";
          dCtx.fillStyle = "#000000";
          dCtx.fillRect(
            currentRect.x,
            currentRect.y,
            currentRect.width,
            currentRect.height
          );

          vCtx.clearRect(
            0,
            0,
            visualCanvasRef.current.width,
            visualCanvasRef.current.height
          );
          vCtx.globalCompositeOperation = "source-over";
          vCtx.drawImage(dataCanvasRef.current, 0, 0);
          vCtx.globalCompositeOperation = "source-in";
          vCtx.fillStyle = "rgba(255, 64, 64, 0.25)";
          vCtx.fillRect(
            0,
            0,
            visualCanvasRef.current.width,
            visualCanvasRef.current.height
          );
        }
        setRectStart(null);
        setCurrentRect(null);
      } else {
        setIsDrawing(false);
        const vCtx = visualCanvasRef.current?.getContext("2d");
        const dCtx = dataCanvasRef.current?.getContext("2d");
        vCtx?.beginPath();
        dCtx?.beginPath();
      }
    };

    const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
    const [showCursor, setShowCursor] = useState(false);

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
      if (!isEditing) return;
      setCursorPos({ x: e.clientX, y: e.clientY });
      setShowCursor(true);

      if (isRectTool && rectStart) {
        const point = getPoint(e);
        const newRect = {
          x: Math.min(rectStart.x, point.x),
          y: Math.min(rectStart.y, point.y),
          width: Math.abs(point.x - rectStart.x),
          height: Math.abs(point.y - rectStart.y),
        };
        setCurrentRect(newRect);

        const vCtx = visualCanvasRef.current?.getContext("2d");
        if (vCtx && visualCanvasRef.current) {
          vCtx.clearRect(
            0,
            0,
            visualCanvasRef.current.width,
            visualCanvasRef.current.height
          );
          vCtx.globalCompositeOperation = "source-over";
          vCtx.fillStyle = "rgba(255, 64, 64, 0.25)";
          vCtx.fillRect(newRect.x, newRect.y, newRect.width, newRect.height);
          vCtx.strokeStyle = "rgba(255, 64, 64, 0.8)";
          vCtx.lineWidth = 2;
          vCtx.strokeRect(newRect.x, newRect.y, newRect.width, newRect.height);
        }
      } else if (isDrawing) {
        draw(e);
      }
    };

    const handleCanvasMouseLeave = () => {
      setShowCursor(false);
      stopDrawing();
    };

    return (
      <div
        className={`absolute select-none ${isEditing ? "z-50" : "z-10"}`}
        style={{
          left: x,
          top: y,
          width: `${CANVAS_IMAGE_CARD_WIDTH}px`,
          cursor: tool === "hand" ? "grab" : isEditing ? "none" : "move",
        }}
        onMouseDown={handleMouseDown}
      >
        <ContextMenu
          disabled={isEditing}
          fixedPosition={true}
          onOpenChange={setIsMenuOpen}
          trigger={
            <div
              className={`group relative overflow-hidden rounded-xl transition-all duration-300 ${
                isSelected || isEditing || isMenuOpen
                  ? "shadow-2xl shadow-blue-500/20 ring-2 ring-blue-500"
                  : "border border-white/5 shadow-lg shadow-black/20"
              }`}
            >
              {url ? (
                <img
                  ref={imageRef}
                  src={url}
                  alt="Generated"
                  className="pointer-events-none block h-auto w-full object-contain"
                  crossOrigin="anonymous"
                  onLoad={handleImageLoad}
                />
              ) : status === "failed" ? (
                <div
                  className="relative flex w-full items-center justify-center overflow-hidden border-2 border-red-900/50 bg-gradient-to-br from-red-950/40 via-zinc-900/80 to-red-900/30 text-xs text-zinc-200"
                  style={{ height: `${placeholderHeight}px` }}
                >
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(220,38,38,0.1),transparent_70%)]" />
                  <div className="relative flex flex-col items-center gap-4 px-6 text-center">
                    <div className="relative">
                      <div className="absolute inset-0 rounded-full bg-red-500 opacity-30 blur-xl" />
                      <div className="relative rounded-full border-2 border-red-500/50 bg-zinc-900/95 p-4">
                        <AlertCircle className="h-10 w-10 text-red-400" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-lg font-semibold text-red-400">
                        {t("canvas.generation_failed")}
                      </div>
                      <div className="max-w-xs text-sm text-zinc-400">
                        {error || t("canvas.generation_failed_desc")}
                      </div>
                    </div>
                    {onRegenerate && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRegenerate(id);
                        }}
                        className="mt-2 flex items-center gap-2 rounded-lg bg-gradient-to-r from-red-600 to-red-500 px-6 py-2.5 font-medium text-white shadow-lg shadow-red-500/20 transition-all duration-200 hover:from-red-500 hover:to-red-400"
                      >
                        <RotateCcw className="h-4 w-4" />
                        {t("canvas.retry_generation")}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div
                  className="relative flex w-full items-center justify-center overflow-hidden bg-zinc-900/80 text-xs text-zinc-200"
                  style={{ height: `${placeholderHeight}px` }}
                >
                  <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-sky-500/10 via-cyan-400/5 to-purple-500/10" />
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(14,165,233,0.08),transparent_35%),radial-gradient(circle_at_80%_30%,rgba(168,85,247,0.08),transparent_30%)]" />

                  <div className="relative flex flex-col items-center gap-4">
                    <div className="relative h-16 w-16">
                      <div className="absolute inset-0 animate-[spin_3s_linear_infinite] rounded-full border-2 border-cyan-500/30 border-t-cyan-400" />
                      <div className="absolute inset-2 animate-[spin_1.5s_linear_infinite_reverse] rounded-full border-2 border-violet-500/30 border-t-violet-400" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="h-3 w-3 animate-pulse rounded-full bg-gradient-to-r from-cyan-400 to-violet-400 shadow-[0_0_20px_rgba(34,211,238,0.5)]" />
                      </div>
                      <div className="absolute -inset-2 animate-pulse rounded-full bg-cyan-500/10 blur-xl" />
                    </div>

                    <div className="rounded-full border border-white/10 bg-black/50 px-4 py-1.5 font-medium tracking-wide text-white backdrop-blur-sm">
                      {loadingType === "generate"
                        ? t("canvas.loading_generate_title")
                        : t("canvas.loading_edit_title")}
                    </div>

                    {loadingType !== "generate" && (
                      <span className="text-sm text-zinc-400">
                        {t("canvas.loading_edit_desc")}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {isEditing && (
                <>
                  <canvas
                    ref={visualCanvasRef}
                    className="absolute inset-0 h-full w-full touch-none"
                    onMouseDown={startDrawing}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={stopDrawing}
                    onMouseLeave={handleCanvasMouseLeave}
                    style={{ cursor: isRectTool ? "crosshair" : "none" }}
                  />
                  <canvas
                    ref={dataCanvasRef}
                    className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
                  />
                  {showCursor &&
                    !isRectTool &&
                    typeof document !== "undefined" &&
                    createPortal(
                      <div
                        className="pointer-events-none fixed z-[9999] -translate-x-1/2 -translate-y-1/2 transform rounded-full border border-white/50 bg-red-500/20"
                        style={{
                          width: brushSize * displayScale,
                          height: brushSize * displayScale,
                          left: cursorPos.x,
                          top: cursorPos.y,
                        }}
                      />,
                      document.body
                    )}
                </>
              )}
            </div>
          }
        >
          {!isEditing && (
            <>
              <ContextMenuItem onClick={() => onEditStart(id, "inpainting")}>
                <PenTool className="mr-2 h-4 w-4" /> {t("canvas.ai_edit_image")}
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onEditStart(id, "text")}>
                <TypeIcon className="mr-2 h-4 w-4" /> {t("canvas.ai_edit_text")}
              </ContextMenuItem>

              {!parentId && onRegenerate && (
                <ContextMenuItem onClick={() => onRegenerate(id)}>
                  <RotateCcw className="mr-2 h-4 w-4" />{" "}
                  {t("canvas.regenerate")}
                </ContextMenuItem>
              )}

              <div className="my-1 h-px bg-white/10" />
              <ContextMenuItem
                onClick={async () => {
                  const fallbackDownload = () => {
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = `image_${id}.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  };

                  const width = deviceWidth || imageRef.current?.naturalWidth;
                  const height =
                    deviceHeight || imageRef.current?.naturalHeight;

                  if (!width || !height) {
                    fallbackDownload();
                    return;
                  }

                  setDownloadStatus({ visible: true, status: "downloading" });

                  try {
                    const response = await fetch("/api/resize-download", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ imageUrl: url, width, height }),
                    });

                    if (!response.ok) throw new Error("Download failed");

                    const blob = await response.blob();
                    const downloadUrl = window.URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = downloadUrl;
                    a.download = `image_${width}x${height}.png`;
                    document.body.appendChild(a);
                    a.click();
                    window.URL.revokeObjectURL(downloadUrl);
                    document.body.removeChild(a);

                    setDownloadStatus({ visible: true, status: "success" });
                  } catch (error) {
                    console.error("Download error:", error);
                    setDownloadStatus({ visible: true, status: "error" });
                    setTimeout(
                      () =>
                        setDownloadStatus({
                          visible: false,
                          status: "downloading",
                        }),
                      2000
                    );
                  }
                }}
              >
                <Download className="mr-2 h-4 w-4" />{" "}
                {t("canvas.download_image")}
              </ContextMenuItem>

              {parentId && onDelete && (
                <ContextMenuItem onClick={() => onDelete(id)}>
                  <X className="mr-2 h-4 w-4" /> {t("canvas.delete_image")}
                </ContextMenuItem>
              )}
            </>
          )}
        </ContextMenu>

        <DownloadOverlay
          isVisible={downloadStatus.visible}
          status={downloadStatus.status}
          onComplete={() =>
            setDownloadStatus({ visible: false, status: "downloading" })
          }
        />
      </div>
    );
  }
);

CanvasImage.displayName = "CanvasImage";
