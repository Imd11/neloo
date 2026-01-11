import { MousePointer2, Hand, Minus, Plus, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CanvasTool } from "@/types/canvas";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

interface CanvasTopBarProps {
    activeTool: CanvasTool;
    onToolChange: (tool: CanvasTool) => void;
    scale: number;
    onZoomIn: () => void;
    onZoomOut: () => void;
}

export function CanvasTopBar({
    activeTool,
    onToolChange,
    scale,
    onZoomIn,
    onZoomOut,
}: CanvasTopBarProps) {
    return (
        <div className="h-14 flex items-center justify-between px-4 bg-canvas-topbar border-b border-canvas-border">
            {/* Left - Tool Selection + Zoom Controls */}
            <div className="flex items-center gap-3">
                {/* Tool Selection */}
                <div className="flex items-center gap-0.5 bg-canvas-toolbar rounded-lg p-1">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "w-8 h-8 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover",
                                        activeTool === 'select' && "bg-canvas-active text-canvas-foreground"
                                    )}
                                    onClick={() => onToolChange('select')}
                                >
                                    <MousePointer2 className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>选择工具 (V)</p>
                            </TooltipContent>
                        </Tooltip>

                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                        "w-8 h-8 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover",
                                        activeTool === 'hand' && "bg-canvas-active text-canvas-foreground"
                                    )}
                                    onClick={() => onToolChange('hand')}
                                >
                                    <Hand className="w-4 h-4" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>抓手工具 (H)</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

                {/* Divider */}
                <div className="w-px h-5 bg-canvas-border" />

                {/* Zoom Controls */}
                <div className="flex items-center gap-1 bg-canvas-toolbar rounded-lg px-2 py-1">
                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-6 h-6 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover"
                                    onClick={onZoomOut}
                                >
                                    <Minus className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>缩小</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>

                    <span className="px-2 text-sm text-canvas-foreground min-w-[3rem] text-center font-medium">
                        {Math.round(scale * 100)}
                    </span>

                    <span className="text-sm text-canvas-muted">%</span>

                    <TooltipProvider delayDuration={300}>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-6 h-6 text-canvas-muted hover:text-canvas-foreground hover:bg-canvas-hover"
                                    onClick={onZoomIn}
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent side="bottom">
                                <p>放大</p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>

            {/* Right - User Actions */}
            <div className="flex items-center gap-2">
                <Button variant="ghost" size="icon" className="w-8 h-8">
                    <Bell className="w-4 h-4" />
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground text-sm h-8"
                >
                    额度
                </Button>
                <Button variant="ghost" size="icon" className="w-8 h-8">
                    <User className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
