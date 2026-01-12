import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { CanvasImage, ViewState, CanvasTool } from "@/types/canvas";
import { CanvasTopBar } from "./CanvasTopBar";
import { ImageContextMenu } from "./ImageContextMenu";
import { InpaintEditor } from "./InpaintEditor";
import { toast } from "sonner";

interface ImageCanvasProps {
    images: CanvasImage[];
    onImagesChange: (images: CanvasImage[]) => void;
    flyingImage?: {
        id: string;
        src: string;
        startRect: DOMRect;
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
    const [viewState, setViewState] = useState<ViewState>({
        offsetX: 0,
        offsetY: 0,
        scale: 1
    });
    const [activeTool, setActiveTool] = useState<CanvasTool>('select');
    const [isPanning, setIsPanning] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [lastMousePos, setLastMousePos] = useState({ x: 0, y: 0 });
    const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
    const [brushSize, setBrushSize] = useState(20);

    // Context menu state
    const [contextMenu, setContextMenu] = useState<{
        x: number;
        y: number;
        imageId: string;
    } | null>(null);

    // Inpaint editor state
    const [inpaintEditor, setInpaintEditor] = useState<{
        imageId: string;
        imageUrl: string;
    } | null>(null);

    // Calculate target position for flying image (center-left of canvas)
    const getTargetPosition = useCallback(() => {
        if (!canvasRef.current) return { x: 200, y: 300 };
        const rect = canvasRef.current.getBoundingClientRect();
        return {
            x: rect.width * 0.35, // center-left
            y: rect.height * 0.5
        };
    }, []);

    // Handle flying image animation complete
    useEffect(() => {
        if (flyingImage && onFlyingComplete) {
            const timer = setTimeout(() => {
                // Add the image to canvas
                const targetPos = getTargetPosition();
                const newImage: CanvasImage = {
                    id: flyingImage.id,
                    src: flyingImage.src,
                    x: targetPos.x - 150, // offset for image size
                    y: targetPos.y - 150,
                    width: 300,
                    height: 300,
                    rotation: 0,
                    isSelected: false // 默认不选中，避免显示线框
                };
                onImagesChange([...images, newImage]);
                // 不自动选中
                // setSelectedImageId(newImage.id);
                onFlyingComplete();
            }, 800); // animation duration
            return () => clearTimeout(timer);
        }
    }, [flyingImage, onFlyingComplete, images, onImagesChange, getTargetPosition]);


    // Pan handlers
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (activeTool === 'hand' || e.button === 1) {
            setIsPanning(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    }, [activeTool]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (isPanning) {
            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;
            setViewState(prev => ({
                ...prev,
                offsetX: prev.offsetX + deltaX,
                offsetY: prev.offsetY + deltaY
            }));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }

        // Handle image dragging
        if (isDragging && selectedImageId) {
            const deltaX = (e.clientX - lastMousePos.x) / viewState.scale;
            const deltaY = (e.clientY - lastMousePos.y) / viewState.scale;

            onImagesChange(images.map(img =>
                img.id === selectedImageId
                    ? { ...img, x: img.x + deltaX, y: img.y + deltaY }
                    : img
            ));
            setLastMousePos({ x: e.clientX, y: e.clientY });
        }
    }, [isPanning, isDragging, lastMousePos, selectedImageId, images, onImagesChange, viewState.scale]);

    const handleMouseUp = useCallback(() => {
        setIsPanning(false);
        setIsDragging(false);
    }, []);

    // Zoom handlers
    const handleWheel = useCallback((e: React.WheelEvent) => {
        e.preventDefault();
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        setViewState(prev => ({
            ...prev,
            scale: Math.min(Math.max(prev.scale * delta, 0.1), 5)
        }));
    }, []);

    const handleZoomIn = () => {
        setViewState(prev => ({
            ...prev,
            scale: Math.min(prev.scale * 1.2, 5)
        }));
    };

    const handleZoomOut = () => {
        setViewState(prev => ({
            ...prev,
            scale: Math.max(prev.scale / 1.2, 0.1)
        }));
    };

    // Image drag start
    const handleImageMouseDown = useCallback((id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (activeTool === 'select') {
            setSelectedImageId(id);
            setIsDragging(true);
            setLastMousePos({ x: e.clientX, y: e.clientY });

            onImagesChange(images.map(img => ({
                ...img,
                isSelected: img.id === id
            })));
        }
    }, [activeTool, images, onImagesChange]);

    // Image right click (context menu)
    const handleImageContextMenu = useCallback((id: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setSelectedImageId(id);
        onImagesChange(images.map(img => ({
            ...img,
            isSelected: img.id === id
        })));
        setContextMenu({
            x: e.clientX,
            y: e.clientY,
            imageId: id
        });
    }, [images, onImagesChange]);

    const handleCanvasClick = useCallback(() => {
        setSelectedImageId(null);
        setContextMenu(null);
        onImagesChange(images.map(img => ({ ...img, isSelected: false })));
    }, [images, onImagesChange]);

    // Image operations
    const handleDeleteImage = useCallback((id: string) => {
        onImagesChange(images.filter(img => img.id !== id));
        setSelectedImageId(null);
        setContextMenu(null);
        toast.success("已删除图片");
    }, [images, onImagesChange]);

    const handleDuplicateImage = useCallback((id: string) => {
        const originalImage = images.find(img => img.id === id);
        if (originalImage) {
            const newImage: CanvasImage = {
                ...originalImage,
                id: `${id}-copy-${Date.now()}`,
                x: originalImage.x + 30,
                y: originalImage.y + 30,
                isSelected: true
            };
            onImagesChange([
                ...images.map(img => ({ ...img, isSelected: false })),
                newImage
            ]);
            setSelectedImageId(newImage.id);
            toast.success("已复制图片");
        }
        setContextMenu(null);
    }, [images, onImagesChange]);

    const handleBringToFront = useCallback((id: string) => {
        const image = images.find(img => img.id === id);
        if (image) {
            onImagesChange([
                ...images.filter(img => img.id !== id),
                image
            ]);
        }
        setContextMenu(null);
    }, [images, onImagesChange]);

    const handleSendToBack = useCallback((id: string) => {
        const image = images.find(img => img.id === id);
        if (image) {
            onImagesChange([
                image,
                ...images.filter(img => img.id !== id)
            ]);
        }
        setContextMenu(null);
    }, [images, onImagesChange]);

    const handleDownloadImage = useCallback((id: string) => {
        const image = images.find(img => img.id === id);
        if (image) {
            const link = document.createElement('a');
            link.href = image.src;
            link.download = `image-${id}.png`;
            link.click();
            toast.success("开始下载图片");
        }
        setContextMenu(null);
    }, [images]);

    // AI 改图
    const handleAIEdit = useCallback((id: string) => {
        const image = images.find(img => img.id === id);
        if (image) {
            setInpaintEditor({
                imageId: id,
                imageUrl: image.src
            });
        }
        setContextMenu(null);
    }, [images]);

    const handleInpaintSave = useCallback((newUrl: string) => {
        if (inpaintEditor) {
            // 替换原图为编辑后的图
            onImagesChange(images.map(img =>
                img.id === inpaintEditor.imageId
                    ? { ...img, src: newUrl }
                    : img
            ));
            toast.success("AI 改图完成！");
        }
        setInpaintEditor(null);
    }, [inpaintEditor, images, onImagesChange]);

    // Handle keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (selectedImageId) {
                if (e.key === 'Delete' || e.key === 'Backspace') {
                    handleDeleteImage(selectedImageId);
                }
                if (e.key === 'd' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    handleDuplicateImage(selectedImageId);
                }
            }
            // Tool shortcuts
            if (e.key === 'v') setActiveTool('select');
            if (e.key === 'h') setActiveTool('hand');
            if (e.key === 'b') setActiveTool('brush');
            if (e.key === 'e') setActiveTool('eraser');
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedImageId, handleDeleteImage, handleDuplicateImage]);

    return (
        <div className="relative w-full h-full flex flex-col bg-canvas-bg">
            {/* Top Bar */}
            <CanvasTopBar
                activeTool={activeTool}
                onToolChange={setActiveTool}
                scale={viewState.scale}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
            />

            {/* Canvas Area */}
            <div
                ref={canvasRef}
                className={cn(
                    "flex-1 relative overflow-hidden",
                    activeTool === 'hand' && "cursor-grab",
                    isPanning && "cursor-grabbing"
                )}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onWheel={handleWheel}
                onClick={handleCanvasClick}
                style={{
                    backgroundImage: 'radial-gradient(hsl(var(--muted-foreground)) 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                    backgroundPosition: `${viewState.offsetX}px ${viewState.offsetY}px`
                }}
            >
                {/* Canvas Transform Container */}
                <div
                    className="absolute inset-0"
                    style={{
                        transform: `translate(${viewState.offsetX}px, ${viewState.offsetY}px) scale(${viewState.scale})`,
                        transformOrigin: 'center center'
                    }}
                >
                    {/* Render Images */}
                    {images.map((image) => (
                        <motion.div
                            key={image.id}
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.3 }}
                            className={cn(
                                "absolute select-none",
                                activeTool === 'select' ? "cursor-move" : "cursor-pointer",
                                image.isSelected
                                    ? "ring-2 ring-blue-500 shadow-2xl shadow-blue-500/20"
                                    : "shadow-2xl shadow-black/50"
                            )}
                            style={{
                                left: image.x,
                                top: image.y,
                                width: '300px',  // Fixed width like aso
                            }}
                            onMouseDown={(e) => handleImageMouseDown(image.id, e)}
                            onContextMenu={(e) => handleImageContextMenu(image.id, e)}
                        >
                            <img
                                src={image.src}
                                alt="Canvas image"
                                className="w-full h-auto object-contain rounded-[32px] pointer-events-none"
                                draggable={false}
                            />
                            {image.isSelected && (
                                <>
                                    {/* Simple selection indicator - blue ring only, no resize handles */}
                                </>
                            )}
                        </motion.div>
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
                                left: canvasRef.current.getBoundingClientRect().left + canvasRef.current.offsetWidth * 0.35 - 150,
                                top: canvasRef.current.getBoundingClientRect().top + canvasRef.current.offsetHeight * 0.5 - 150,
                                width: 300,
                                height: 300,
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


            {/* Context Menu */}
            {contextMenu && (
                <ImageContextMenu
                    x={contextMenu.x}
                    y={contextMenu.y}
                    onClose={() => setContextMenu(null)}
                    onDelete={() => handleDeleteImage(contextMenu.imageId)}
                    onDownload={() => handleDownloadImage(contextMenu.imageId)}
                    onAIEdit={() => handleAIEdit(contextMenu.imageId)}
                />
            )}

            {/* Inpaint Editor */}
            {inpaintEditor && (
                <InpaintEditor
                    imageUrl={inpaintEditor.imageUrl}
                    onClose={() => setInpaintEditor(null)}
                    onSave={handleInpaintSave}
                />
            )}
        </div>
    );
}
