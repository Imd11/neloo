import { useEffect, useState } from "react";
import { MousePointer2, Hand, Bell, User } from "lucide-react";
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
    onScaleChange: (scale: number) => void;
}

export function CanvasTopBar({
    activeTool,
    onToolChange,
    scale,
    onScaleChange,
}: CanvasTopBarProps) {
    const [pendingScale, setPendingScale] = useState<string | null>(null);

    useEffect(() => {
        if (pendingScale === null) return;
        // If scale changes from elsewhere while typing, keep user's input.
    }, [pendingScale]);

    const clampPercent = (value: number) => Math.min(300, Math.max(25, value));
    const setPercent = (percent: number) => onScaleChange(clampPercent(percent) / 100);

    return (
        <div className="h-14 border-b border-border bg-background/50 backdrop-blur flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-muted/50 rounded-lg p-1 border border-border/40">
                    <button
                        onClick={() => onToolChange("select")}
                        className={cn(
                            "p-2 rounded-md transition-all",
                            activeTool === "select"
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label="Select"
                    >
                        <MousePointer2 className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => onToolChange("hand")}
                        className={cn(
                            "p-2 rounded-md transition-all",
                            activeTool === "hand"
                                ? "bg-primary/15 text-primary"
                                : "text-muted-foreground hover:text-foreground"
                        )}
                        aria-label="Hand"
                    >
                        <Hand className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-4 w-px bg-border" />

                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1 bg-muted/50 border border-border/40 rounded-md">
                        <button
                            aria-label="Zoom out"
                            className="px-2 h-8 text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/5 transition-colors"
                            onClick={() => setPercent(Math.round(scale * 100) - 5)}
                        >
                            −
                        </button>
                        <input
                            aria-label="Canvas zoom"
                            className="w-14 bg-transparent border-0 h-8 text-xs px-2 text-foreground focus:outline-none focus:border-none text-center"
                            value={pendingScale ?? Math.round(scale * 100).toString()}
                            onChange={(e) => setPendingScale(e.target.value)}
                            onBlur={() => {
                                if (pendingScale === null) return;
                                const next = Number(pendingScale);
                                if (Number.isFinite(next) && next > 0) {
                                    setPercent(next);
                                }
                                setPendingScale(null);
                            }}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                    (e.currentTarget as HTMLInputElement).blur();
                                } else if (e.key === "Escape") {
                                    setPendingScale(null);
                                    (e.currentTarget as HTMLInputElement).blur();
                                }
                            }}
                        />
                        <span className="text-xs text-muted-foreground pr-1">%</span>
                        <button
                            aria-label="Zoom in"
                            className="px-2 h-8 text-sm text-foreground/80 hover:text-foreground hover:bg-foreground/5 transition-colors"
                            onClick={() => setPercent(Math.round(scale * 100) + 5)}
                        >
                            +
                        </button>
                    </div>
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
