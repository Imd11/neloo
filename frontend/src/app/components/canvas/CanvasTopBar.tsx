import { useState } from "react";
import { MousePointer2, Hand, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CanvasTool } from "@/types/canvas";

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

    const clampPercent = (value: number) => Math.min(300, Math.max(25, value));
    const setPercent = (percent: number) => onScaleChange(clampPercent(percent) / 100);

    return (
        <div className="h-14 border-b border-white/10 bg-[#09090b]/50 backdrop-blur flex items-center justify-between px-6 z-10">
            <div className="flex items-center gap-4">
                <div className="flex items-center bg-zinc-900/50 rounded-lg p-1 border border-white/5">
                    <button
                        onClick={() => onToolChange("select")}
                        className={cn(
                            "p-2 rounded-md transition-all",
                            activeTool === "select"
                                ? "bg-blue-500/20 text-blue-400"
                                : "text-zinc-400 hover:text-white"
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
                                ? "bg-blue-500/20 text-blue-400"
                                : "text-zinc-400 hover:text-white"
                        )}
                        aria-label="Hand"
                    >
                        <Hand className="w-4 h-4" />
                    </button>
                </div>

                <div className="h-4 w-px bg-white/10" />

                <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <div className="flex items-center gap-1 bg-zinc-900/60 border border-white/10 rounded-md">
                        <button
                            aria-label="Zoom out"
                            className="px-2 h-8 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
                            onClick={() => setPercent(Math.round(scale * 100) - 5)}
                        >
                            −
                        </button>
                        <input
                            aria-label="Canvas zoom"
                            className="w-14 bg-transparent border-0 h-8 text-xs px-2 text-zinc-200 focus:outline-none focus:border-none text-center"
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
                        <span className="text-xs text-zinc-500 pr-1">%</span>
                        <button
                            aria-label="Zoom in"
                            className="px-2 h-8 text-sm text-zinc-300 hover:text-white hover:bg-white/5 transition-colors"
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
