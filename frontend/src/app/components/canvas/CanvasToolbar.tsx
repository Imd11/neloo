import { Paintbrush, Eraser, MousePointer2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { CanvasTool } from "@/types/canvas";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import { useLanguage } from "@/providers/LanguageProvider";

interface CanvasToolbarProps {
    activeTool: CanvasTool;
    onToolChange: (tool: CanvasTool) => void;
    brushSize: number;
    onBrushSizeChange: (size: number) => void;
    hasSelection: boolean;
    onSubmit?: () => void;
    onCancel?: () => void;
}

export function CanvasToolbar({
    activeTool,
    onToolChange,
    brushSize,
    onBrushSizeChange,
    hasSelection,
    onSubmit,
    onCancel
}: CanvasToolbarProps) {
    const { t } = useLanguage();
    // Only show toolbar when there's a selection (image on canvas)
    if (!hasSelection) return null;

    return (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20">
            <div className="flex items-center gap-2 px-3 py-2 bg-canvas-toolbar border border-canvas-border rounded-xl shadow-2xl">
                {/* Drawing Tools */}
                <div className="flex items-center gap-1 pr-2 border-r border-canvas-border">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "w-9 h-9 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover",
                                        activeTool === 'select' && "bg-canvas-active text-canvas-foreground"
                                    )}
                                    onClick={() => onToolChange('select')}
                                >
                                    <MousePointer2 className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>{t("canvas.select_tool")} (V)</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "w-9 h-9 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover",
                                        activeTool === 'brush' && "bg-canvas-active text-canvas-foreground"
                                    )}
                                    onClick={() => onToolChange('brush')}
                                >
                                    <Paintbrush className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>{t("canvas.brush_tool_short")} (B)</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "w-9 h-9 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover",
                                        activeTool === 'eraser' && "bg-canvas-active text-canvas-foreground"
                                    )}
                                    onClick={() => onToolChange('eraser')}
                                >
                                    <Eraser className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>{t("canvas.eraser_tool_short")} (E)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Brush Size */}
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            variant="ghost"
                            className="h-9 px-3 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover gap-2"
                        >
                            <div
                                className="rounded-full bg-canvas-foreground"
                                style={{ width: Math.min(brushSize / 2, 16), height: Math.min(brushSize / 2, 16) }}
                            />
                            <span className="text-sm">{brushSize}px</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        side="top"
                        className="w-48 bg-canvas-toolbar border-canvas-border"
                    >
                        <div className="space-y-3">
                            <div className="flex items-center justify-between">
                                <span className="text-sm text-canvas-muted">{t("canvas.brush_size")}</span>
                                <span className="text-sm text-canvas-foreground">{brushSize}px</span>
                            </div>
                            <Slider
                                value={[brushSize]}
                                onValueChange={(value) => onBrushSizeChange(value[0])}
                                min={1}
                                max={100}
                                step={1}
                                className="w-full"
                            />
                        </div>
                    </PopoverContent>
                </Popover>

                {/* Divider */}
                <div className="w-px h-6 bg-canvas-border" />

                {/* Action Buttons */}
                <div className="flex items-center gap-1">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-9 h-9 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                    onClick={onCancel}
                                >
                                    <X className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>{t("common.cancel")}</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-9 h-9 text-green-400 hover:text-green-300 hover:bg-green-500/10"
                                    onClick={onSubmit}
                                >
                                    <Check className="w-5 h-5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="top">
                                <p>{t("common.confirm")}</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        </div>
    );
}
