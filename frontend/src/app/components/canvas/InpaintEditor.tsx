"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Loader2, Eraser, Brush, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/providers/LanguageProvider";

interface InpaintEditorProps {
    imageUrl: string;
    onClose: () => void;
    onSave: (newUrl: string) => void;
    initialPrompt?: string;
}

export function InpaintEditor({ imageUrl, onClose, onSave, initialPrompt = "" }: InpaintEditorProps) {
    const { t } = useLanguage();
    const [prompt, setPrompt] = useState(initialPrompt);
    const [brushSize, setBrushSize] = useState(30);
    const [isProcessing, setIsProcessing] = useState(false);

    const containerRef = useRef<HTMLDivElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const maskCanvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
    const [tool, setTool] = useState<"brush" | "eraser">("brush");
    const [cursorPos, setCursorPos] = useState<{ x: number; y: number } | null>(null);

    // Initialize Canvas
    useEffect(() => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = imageUrl;
        img.onload = () => {
            if (!canvasRef.current || !maskCanvasRef.current || !containerRef.current) return;

            // Calculate fit dimensions - keep it contained but large enough
            const maxWidth = containerRef.current.clientWidth;
            const maxHeight = containerRef.current.clientHeight;
            const scale = Math.min(maxWidth / img.width, maxHeight / img.height);

            const width = img.width * scale;
            const height = img.height * scale;

            setImageSize({ width, height });

            // Setup Source Canvas
            const ctx = canvasRef.current.getContext("2d");
            canvasRef.current.width = width;
            canvasRef.current.height = height;
            if (ctx) {
                ctx.drawImage(img, 0, 0, width, height);
            }

            // Setup Mask Canvas
            const maskCtx = maskCanvasRef.current.getContext("2d");
            maskCanvasRef.current.width = width;
            maskCanvasRef.current.height = height;
            if (maskCtx) {
                maskCtx.clearRect(0, 0, width, height);
            }
        };
    }, [imageUrl]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(true);
        draw(e);
    };

    const stopDrawing = () => {
        setIsDrawing(false);
        const ctx = maskCanvasRef.current?.getContext("2d");
        if (ctx) ctx.beginPath();
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        // Update cursor position
        const canvas = maskCanvasRef.current;
        if (canvas) {
            const rect = canvas.getBoundingClientRect();
            setCursorPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
        }

        if (!isDrawing || !maskCanvasRef.current) return;
        const ctx = canvas?.getContext("2d");
        if (!ctx) return;

        const rect = canvas!.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        ctx.lineWidth = brushSize;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        if (tool === "brush") {
            ctx.globalCompositeOperation = "source-over";
            ctx.strokeStyle = "rgba(255, 0, 0, 0.5)";
        } else {
            ctx.globalCompositeOperation = "destination-out";
            ctx.strokeStyle = "rgba(0, 0, 0, 1)";
        }

        ctx.lineTo(x, y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(x, y);
    };

    const handleGenerate = async () => {
        if (!prompt.trim()) {
            toast.error(t("canvas.edit_prompt_required"));
            return;
        }
        if (!canvasRef.current || !maskCanvasRef.current) return;

        setIsProcessing(true);
        try {
            // Generate original image as Data URL
            const originalDataUrl = canvasRef.current.toDataURL("image/png");

            // Generate marked image (original + red mask overlay) as Data URL
            const markedCanvas = document.createElement("canvas");
            markedCanvas.width = canvasRef.current.width;
            markedCanvas.height = canvasRef.current.height;
            const ctx = markedCanvas.getContext("2d");
            if (!ctx) throw new Error("Failed to get canvas context");

            // Draw original image
            ctx.drawImage(canvasRef.current, 0, 0);
            // Draw mask overlay on top
            ctx.drawImage(maskCanvasRef.current, 0, 0);

            const markedDataUrl = markedCanvas.toDataURL("image/png");

            // Send to API
            const formData = new FormData();
            formData.append("originalImageUrl", originalDataUrl);
            formData.append("markedImageDataUrl", markedDataUrl);
            formData.append("prompt", prompt);

            // Set 120s timeout for edit request
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120000);

            const res = await fetch("/api/edit", {
                method: "POST",
                body: formData,
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            const data = await res.json();
            if (data.error) throw new Error(data.error);

            if (data.urls && data.urls.length > 0) {
                toast.success(t("canvas.edit_complete"));
                onSave(data.urls[0]);
            } else {
                throw new Error(t("canvas.edit_missing_image"));
            }
        } catch (error) {
            console.error("[InpaintEditor] Error:", error);
            toast.error(error instanceof Error ? error.message : t("canvas.edit_failed"));
        } finally {
            setIsProcessing(false);
        }
    };

    const clearMask = () => {
        const ctx = maskCanvasRef.current?.getContext("2d");
        if (ctx && canvasRef.current) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
        }
    };

    return (
        <div className="absolute inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-sm animate-in fade-in duration-200">
            {/* Canvas Area */}
            <div ref={containerRef} className="flex-1 relative flex items-center justify-center p-8 overflow-hidden">
                <div className="relative shadow-2xl rounded-lg overflow-hidden" style={{ width: imageSize.width, height: imageSize.height }}>
                    <canvas
                        ref={canvasRef}
                        className="absolute inset-0 pointer-events-none"
                    />
                    <canvas
                        ref={maskCanvasRef}
                        className="absolute inset-0 touch-none"
                        style={{ cursor: tool === 'brush' ? 'none' : 'cell' }}
                        onMouseDown={startDrawing}
                        onMouseUp={stopDrawing}
                        onMouseLeave={() => { stopDrawing(); setCursorPos(null); }}
                        onMouseMove={draw}
                    />
                    {/* Custom Brush Cursor */}
                    {tool === 'brush' && cursorPos && (
                        <div
                            className="absolute pointer-events-none rounded-full border-2 border-red-500 bg-red-500/20"
                            style={{
                                left: cursorPos.x,
                                top: cursorPos.y,
                                width: brushSize,
                                height: brushSize,
                                transform: 'translate(-50%, -50%)',
                                transition: 'width 0.1s ease, height 0.1s ease'
                            }}
                        />
                    )}
                </div>
            </div>

            {/* Controls Bar */}
            <div className="flex-shrink-0 p-4 pb-8 flex justify-center">
                <div className="bg-card border border-border rounded-2xl shadow-2xl p-4 w-full max-w-2xl flex flex-col gap-4 relative">

                    {/* Floating Brush Size Slider */}
                    <div className="absolute -top-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2">
                        {/* Brush Preview Circle */}
                        <div className="bg-card border border-border rounded-lg px-4 py-3 shadow-lg">
                            <div
                                className="rounded-full bg-red-500/50 border-2 border-red-500"
                                style={{
                                    width: `${brushSize}px`,
                                    height: `${brushSize}px`,
                                    transition: 'all 0.1s ease'
                                }}
                            />
                        </div>

                        {/* Slider */}
                        <div className="bg-card border border-border rounded-full px-4 py-2 flex items-center gap-3 shadow-lg">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("canvas.brush_size")}</span>
                            <Slider
                                value={[brushSize]}
                                onValueChange={([v]: number[]) => setBrushSize(v)}
                                min={5}
                                max={100}
                                step={1}
                                className="w-32"
                            />
                            <span className="text-xs text-muted-foreground w-6 text-right">{brushSize}</span>
                        </div>
                    </div>

                    {/* Tools & Input Row */}
                    <div className="flex items-start gap-4">
                        {/* Tools */}
                        <div className="flex bg-muted rounded-lg p-1 gap-1 shrink-0">
                            <Button
                                variant={tool === "brush" ? "secondary" : "ghost"}
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => setTool("brush")}
                            >
                                <Brush className="w-5 h-5" />
                            </Button>
                            <Button
                                variant={tool === "eraser" ? "secondary" : "ghost"}
                                size="icon"
                                className="h-10 w-10"
                                onClick={() => setTool("eraser")}
                            >
                                <Eraser className="w-5 h-5" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-10 w-10 text-muted-foreground hover:text-foreground"
                                onClick={clearMask}
                            >
                                <RotateCcw className="w-5 h-5" />
                            </Button>
                        </div>

                        {/* Input */}
                        <div className="flex-1">
                            <textarea
                                className="w-full bg-input border border-border rounded-lg p-3 text-sm text-foreground focus:border-ring focus:outline-none h-[42px] min-h-[42px] resize-none leading-relaxed py-2.5"
                                placeholder={t("canvas.edit_placeholder")}
                                value={prompt}
                                onChange={(e) => setPrompt(e.target.value)}
                            />
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2 shrink-0">
                            <Button
                                variant="secondary"
                                className="h-10 px-4"
                                onClick={onClose}
                            >
                                {t("common.cancel")}
                            </Button>
                            <Button
                                className="h-10 px-6"
                                onClick={handleGenerate}
                                disabled={isProcessing}
                            >
                                {isProcessing ? (
                                    <>
                                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        {t("canvas.processing")}
                                    </>
                                ) : (
                                    t("canvas.ai_edit_image")
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
