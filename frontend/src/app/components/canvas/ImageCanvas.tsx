import { useState, useRef, useCallback, useEffect, type Dispatch, type SetStateAction } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
    CANVAS_IMAGE_CARD_WIDTH,
    CanvasImage,
    CanvasTool,
    getCanvasImageHeight,
    getCanvasImagePlaceholderHeight,
} from "@/types/canvas";
import { CanvasTopBar } from "./CanvasTopBar";
import { CanvasImage as CanvasImageCard, type CanvasImageRef } from "./CanvasImage";
import { useLanguageSafe } from "@/providers/LanguageProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { Brush, Eraser, Square, X, Check, Loader2 } from "lucide-react";

interface ImageCanvasProps {
    images: CanvasImage[];
    onImagesChange: Dispatch<SetStateAction<CanvasImage[]>>;
    flyingImage?: {
        id: string;
        src: string;
        startRect: DOMRect;
        generationParams?: CanvasImage["generationParams"];
    } | null;
    onFlyingComplete?: () => void;
}

export function ImageCanvas({
    images,
    onImagesChange,
    flyingImage,
    onFlyingComplete
}: ImageCanvasProps) {
    const canvasRef = useRef<HTMLDivElement>(null);
    const { t } = useLanguageSafe();

    const [tool, setTool] = useState<CanvasTool>('select');
    const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState({ x: 0, y: 0 });
    const [scale, setScale] = useState(1);

    // Edit session state (aso behavior)
    const [editingImageId, setEditingImageId] = useState<string | null>(null);
    const [editMode, setEditMode] = useState<"inpainting" | "text">("inpainting");
    const [editPrompt, setEditPrompt] = useState("");
    const [editBrushSize, setEditBrushSize] = useState(30);
    const [editTool, setEditTool] = useState<"brush" | "eraser" | "rect">("brush");
    const [isEditProcessing, setIsEditProcessing] = useState(false);
    const [isSliderDragging, setIsSliderDragging] = useState(false);

    const activeImageRef = useRef<CanvasImageRef>(null);

    // Calculate target position for flying image (center-left of canvas)
    const getTargetPosition = useCallback(() => {
        if (!canvasRef.current) return { x: 200, y: 300 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: rect.width * 0.35, // center-left
            y: rect.height * 0.5
        };
    }, []);

    const getImageDimensions = useCallback((image: CanvasImage) => {
        const width = CANVAS_IMAGE_CARD_WIDTH;
        const fallbackHeight = image.url
            ? getCanvasImageHeight(image.generationParams?.size)
            : getCanvasImagePlaceholderHeight(image.generationParams?.size);
        const height = image.displayHeight ?? fallbackHeight;
        return { width, height };
    }, []);

    // Handle flying image animation complete
    useEffect(() => {
        if (flyingImage && onFlyingComplete) {
            const timer = setTimeout(() => {
                // Add the image to canvas
                const targetPos = getTargetPosition();
                const imageHeight = getCanvasImageHeight(flyingImage.generationParams?.size);
                const newImage: CanvasImage = {
                    id: flyingImage.id,
                    url: flyingImage.src,
                    x: targetPos.x - CANVAS_IMAGE_CARD_WIDTH / 2,
                    y: targetPos.y - imageHeight / 2,
                    displayHeight: imageHeight,
                    loadingType: "generate",
                    generationParams: flyingImage.generationParams,
                };
                onImagesChange(prev => [...prev, newImage]);
                onFlyingComplete();
            }, 800); // animation duration
            return () => clearTimeout(timer);
        }
    }, [flyingImage, onFlyingComplete, onImagesChange, getTargetPosition]);

    // --- Canvas Interactions (aso behavior) ---
    const handleWheel = (e: React.WheelEvent) => {
        if (e.ctrlKey || e.metaKey) {
            e.preventDefault();
            setScale(prev => {
                const delta = -e.deltaY * 0.001;
                return Math.min(3, Math.max(0.25, prev * (1 + delta)));
            });
        } else {
            setViewOffset(prev => ({
                x: prev.x - e.deltaX,
                y: prev.y - e.deltaY
            }));
        }
    };

    const handleCanvasMouseDown = (e: React.MouseEvent) => {
        if (tool === "hand" || e.button === 1) {
            setIsPanning(true);
            setPanStart({ x: e.clientX - viewOffset.x, y: e.clientY - viewOffset.y });
        }
    };

    const handleCanvasMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            setViewOffset({
                x: e.clientX - panStart.x,
                y: e.clientY - panStart.y
            });
        }
    };

    const handleCanvasMouseUp = () => {
        setIsPanning(false);
    };

    // --- Edit Logic ---
    const handleEditStart = (id: string, mode: "inpainting" | "text") => {
        setEditingImageId(id);
        setEditMode(mode);
        setEditPrompt("");
        setEditTool("brush");
    };

    const handleEditCancel = () => {
        setEditingImageId(null);
    };

    const handleEditConfirm = async () => {
        if (!editingImageId || !activeImageRef.current) return;
        setIsEditProcessing(true);
        const placeholderId = `edit-${editingImageId}-${Date.now()}`;

        try {
            const originalImageUrl = activeImageRef.current.getOriginalImageUrl();
            const markedImageDataUrl = activeImageRef.current.getMarkedImageDataUrl();
            const parentDisplayHeight = activeImageRef.current.getDisplayHeight();

            if (!originalImageUrl || !markedImageDataUrl) {
                throw new Error("Failed to get image data");
            }

            onImagesChange(prev => {
                const parent = prev.find(img => img.id === editingImageId);
                const baseX = parent ? parent.x + 450 : 100;
                const baseY = parent ? parent.y : 100;
                const parentDimensions = parent
                    ? getImageDimensions(parent)
                    : { width: CANVAS_IMAGE_CARD_WIDTH, height: getCanvasImagePlaceholderHeight() };

                const placeholder: CanvasImage = {
                    id: placeholderId,
                    url: "",
                    x: baseX,
                    y: baseY,
                    displayHeight: parentDisplayHeight || parentDimensions.height,
                    parentId: editingImageId,
                    loadingType: "edit",
                    generationParams: parent?.generationParams,
                };

                return [...prev, placeholder];
            });

            const formData = new FormData();
            formData.append("originalImageUrl", originalImageUrl);
            formData.append("markedImageDataUrl", markedImageDataUrl);
            formData.append("prompt", editPrompt);

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            const res = await fetch("/api/edit", {
                method: "POST",
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            const nextUrl = data.url || (Array.isArray(data.urls) ? data.urls[0] : null);
            if (nextUrl) {
                onImagesChange(prev => prev.map(img =>
                    img.id === placeholderId ? { ...img, url: nextUrl } : img
                ));
                setEditingImageId(null);
            } else {
                onImagesChange(prev => prev.map(img =>
                    img.id === placeholderId
                        ? { ...img, status: "failed" as const, error: "AI edit failed: no image returned" }
                        : img
                ));
            }
        } catch {
            onImagesChange(prev => prev.map(img =>
                img.id === placeholderId
                    ? { ...img, status: "failed" as const, error: "Edit failed" }
                    : img
            ));
        } finally {
            setIsEditProcessing(false);
            setEditingImageId(null);
        }
    };

    // --- Regenerate Image ---
    const handleRegenerate = async (imageId: string) => {
        const img = images.find(i => i.id === imageId);
        if (!img?.generationParams) {
            alert(t("canvas.error_regenerate_missing_params"));
            return;
        }

        onImagesChange(images.map(item =>
            item.id === imageId ? { ...item, url: "", loadingType: "generate" as const } : item
        ));

        try {
            const response = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: img.generationParams.prompt,
                    resolution: img.generationParams.resolution,
                    ...(img.generationParams.size ? { size: img.generationParams.size } : {}),
                }),
            });

            if (!response.ok) throw new Error("Generate failed");
            const data = await response.json();
            const nextUrl = data.images?.[0];
            if (!nextUrl) throw new Error("No image returned");

            onImagesChange(prev => prev.map(item =>
                item.id === imageId
                    ? { ...item, url: nextUrl, generationParams: img.generationParams }
                    : item
            ));
        } catch {
            alert(t("canvas.error_regenerate_failed"));
            onImagesChange(prev => prev.map(item =>
                item.id === imageId
                    ? { ...item, url: img.url, generationParams: img.generationParams }
                    : item
            ));
        }
    };

    // --- Delete Image (recursive, aso behavior) ---
    const handleDelete = (imageId: string) => {
        const getAllChildren = (id: string): string[] => {
            const children = images.filter(img => img.parentId === id).map(img => img.id);
            return [
                ...children,
                ...children.flatMap(childId => getAllChildren(childId))
            ];
        };

        const toDelete = [imageId, ...getAllChildren(imageId)];
        if (toDelete.length > 1) {
            if (!confirm(t("canvas.confirm_delete_images", { count: toDelete.length }))) {
                return;
            }
        }
        onImagesChange(images.filter(img => !toDelete.includes(img.id)));
    };

    return (
        <div className="relative w-full h-full flex flex-col bg-canvas-bg overflow-hidden">
            {/* Top Bar */}
            <CanvasTopBar
                activeTool={tool}
                onToolChange={setTool}
                scale={scale}
                onScaleChange={setScale}
            />

            {/* Canvas Area */}
            <div
                ref={canvasRef}
                className={cn(
                    "flex-1 relative overflow-hidden",
                    tool === 'hand' && "cursor-grab",
                    isPanning && "cursor-grabbing"
                )}
                onWheel={handleWheel}
                onMouseDown={handleCanvasMouseDown}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onMouseLeave={handleCanvasMouseUp}
                style={{
                    cursor: tool === "hand" ? (isPanning ? "grabbing" : "grab") : "default",
                    backgroundImage: "radial-gradient(hsl(var(--canvas-dots)) 1px, transparent 1px)",
                    backgroundSize: "16px 16px"
                }}
            >
                {/* Canvas Transform Container */}
                <div
                    className="absolute inset-0 transition-transform duration-75 ease-out"
                    style={{
                        transform: `translate(${viewOffset.x}px, ${viewOffset.y}px) scale(${scale})`
                    }}
                >
                    {/* Connection Lines (SVG Layer) */}
                    <svg className="absolute inset-0 w-full h-full pointer-events-none overflow-visible">
                        {images.map(img => {
                            if (!img.parentId) return null;
                            const parent = images.find(p => p.id === img.parentId);
                            if (!parent) return null;

                            const parentDimensions = getImageDimensions(parent);
                            const childDimensions = getImageDimensions(img);
                            const parentCenterY = parent.y + parentDimensions.height / 2;
                            const childCenterY = img.y + childDimensions.height / 2;
                            const parentIsOnLeft = parent.x <= img.x;
                            const direction = parentIsOnLeft ? 1 : -1;
                            const EDGE_OFFSET = 10;
                            const endpointX1 = parentIsOnLeft
                                ? parent.x + parentDimensions.width
                                : parent.x;
                            const endpointY1 = parentCenterY;
                            const endpointX2 = parentIsOnLeft
                                ? img.x
                                : img.x + childDimensions.width;
                            const endpointY2 = childCenterY;

                            const x1 = endpointX1 + direction * EDGE_OFFSET;
                            const y1 = endpointY1;
                            const x2 = endpointX2 - direction * EDGE_OFFSET;
                            const y2 = endpointY2;

                            const curveOffset = Math.max(40, Math.abs(x2 - x1) * 0.45);
                            const c1x = x1 + direction * curveOffset;
                            const c1y = y1;
                            const c2x = x2 - direction * curveOffset;
                            const c2y = y2;
                            const path = `M ${x1} ${y1} C ${c1x} ${c1y} ${c2x} ${c2y} ${x2} ${y2}`;

                            return (
                                <g key={`line-${img.id}`}>
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke="black"
                                        strokeWidth="8"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity="0.6"
                                    />
                                    <path
                                        d={path}
                                        fill="none"
                                        stroke="white"
                                        strokeWidth="4"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        opacity="0.9"
                                    />
                                    <circle cx={endpointX1} cy={endpointY1} r={6} fill="white" opacity="0.9" />
                                    <circle cx={endpointX2} cy={endpointY2} r={6} fill="white" opacity="0.9" />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Images */}
                    {images.map(img => (
                        <CanvasImageCard
                            key={img.id}
                            ref={img.id === editingImageId ? activeImageRef : null}
                            id={img.id}
                            url={img.url}
                            x={img.x}
                            y={img.y}
                            parentId={img.parentId}
                            status={img.status}
                            error={img.error}
                            loadingType={img.loadingType}
                            generationSize={img.generationParams?.size}
                            displayHeight={img.displayHeight}
                            isSelected={false}
                            isEditing={editingImageId === img.id}
                            tool={tool === "hand" ? "hand" : "select"}
                            onUpdate={(id, pos) => {
                                onImagesChange(prev => prev.map(item => item.id === id ? { ...item, ...pos } : item));
                            }}
                            onImageLoad={(id, measuredHeight) => {
                                onImagesChange(prev => prev.map(item => (
                                    item.id === id && item.displayHeight !== measuredHeight
                                        ? { ...item, displayHeight: measuredHeight }
                                        : item
                                )));
                            }}
                            onEditStart={handleEditStart}
                            onRegenerate={handleRegenerate}
                            onDelete={handleDelete}
                            brushSize={editBrushSize}
                            isEraser={editTool === "eraser"}
                            isRectTool={editTool === "rect"}
                        />
                    ))}
                </div>

                {/* Flying Image Animation */}
                <AnimatePresence>
                    {flyingImage && canvasRef.current && (
                        <motion.div
                            initial={{
                                position: 'fixed',
                                left: flyingImage.startRect.left,
                                top: flyingImage.startRect.top,
                                width: flyingImage.startRect.width,
                                height: flyingImage.startRect.height,
                                opacity: 0.9,
                                zIndex: 100
                            }}
                            animate={{
                                left: canvasRef.current.getBoundingClientRect().left + canvasRef.current.offsetWidth * 0.35 - CANVAS_IMAGE_CARD_WIDTH / 2,
                                top: canvasRef.current.getBoundingClientRect().top + canvasRef.current.offsetHeight * 0.5 - getCanvasImageHeight(flyingImage.generationParams?.size) / 2,
                                width: CANVAS_IMAGE_CARD_WIDTH,
                                height: getCanvasImageHeight(flyingImage.generationParams?.size),
                                opacity: 1
                            }}
                            exit={{ opacity: 0 }}
                            transition={{
                                duration: 0.8,
                                ease: [0.34, 1.56, 0.64, 1] // Custom bezier for smooth curve
                            }}
                            className="pointer-events-none"
                        >
                            <img
                                src={flyingImage.src}
                                alt="Flying image"
                                className="w-full h-full object-contain rounded-lg shadow-2xl"
                            />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Edit Toolbar (Floating) */}
            {editingImageId && (
                <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-[#09090b]/90 backdrop-blur border border-white/10 rounded-full px-6 py-3 shadow-2xl flex items-center gap-6 z-50 animate-in slide-in-from-bottom-4 fade-in">
                    <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                        <Button
                            size="icon"
                            variant={editTool === "brush" ? "default" : "ghost"}
                            className="rounded-full w-10 h-10"
                            onClick={() => setEditTool("brush")}
                            title={t("canvas.brush_tool")}
                        >
                            <Brush className="w-4 h-4" />
                        </Button>
                        {editMode === "text" && (
                            <Button
                                size="icon"
                                variant={editTool === "rect" ? "default" : "ghost"}
                                className="rounded-full w-10 h-10"
                                onClick={() => setEditTool("rect")}
                                title={t("canvas.rect_tool")}
                            >
                                <Square className="w-4 h-4" />
                            </Button>
                        )}
                        <Button
                            size="icon"
                            variant={editTool === "eraser" ? "default" : "ghost"}
                            className="rounded-full w-10 h-10"
                            onClick={() => setEditTool("eraser")}
                            title={t("canvas.eraser_tool")}
                        >
                            <Eraser className="w-4 h-4" />
                        </Button>

                        {editTool !== "rect" && (
                            <div className="relative flex items-center">
                                {isSliderDragging && (
                                    <div
                                        className="absolute left-1/2 -translate-x-1/2 flex flex-col items-center gap-1 pointer-events-none z-50"
                                        style={{ bottom: "100%", marginBottom: "8px" }}
                                    >
                                        <div className="bg-zinc-900/95 border border-white/20 rounded-lg p-3 shadow-xl backdrop-blur-sm">
                                            <div
                                                className="rounded-full bg-red-500/50 border-2 border-red-400"
                                                style={{
                                                    width: `${Math.max(10, editBrushSize / 5)}px`,
                                                    height: `${Math.max(10, editBrushSize / 5)}px`,
                                                    transition: "all 0.05s ease-out"
                                                }}
                                            />
                                        </div>
                                        <span className="text-[10px] text-zinc-400 font-medium">{editBrushSize}px</span>
                                    </div>
                                )}
                                <div className="w-24 px-2">
                                    <Slider
                                        value={[editBrushSize]}
                                        onValueChange={([v]) => setEditBrushSize(v)}
                                        onPointerDown={() => setIsSliderDragging(true)}
                                        onPointerUp={() => setIsSliderDragging(false)}
                                        onPointerLeave={() => setIsSliderDragging(false)}
                                        min={5}
                                        max={250}
                                        step={1}
                                    />
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 border-r border-white/10 pr-6">
                        <Input
                            className="w-64 !bg-transparent border-none focus-visible:ring-0 h-10 text-white"
                            placeholder={editMode === "inpainting" ? t("canvas.edit_placeholder") : t("canvas.edit_text_placeholder")}
                            value={editPrompt}
                            onChange={(e) => setEditPrompt(e.target.value)}
                            autoComplete="off"
                            name="edit-prompt"
                            spellCheck={false}
                        />
                    </div>

                    <div className="flex items-center gap-2">
                        <Button
                            size="icon"
                            variant="ghost"
                            className="rounded-full w-10 h-10 hover:bg-red-500/20 hover:text-red-500"
                            onClick={handleEditCancel}
                        >
                            <X className="w-5 h-5" />
                        </Button>
                        <Button
                            size="icon"
                            className="rounded-full w-10 h-10 bg-blue-500 hover:bg-blue-600 text-white"
                            onClick={handleEditConfirm}
                            disabled={isEditProcessing}
                        >
                            {isEditProcessing ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Check className="w-5 h-5" />
                            )}
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
