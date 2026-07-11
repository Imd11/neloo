import { useState } from "react";
import { MousePointer2, Hand, Bell, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { CanvasTool } from "@/types/canvas";
import { useLanguage } from "@/providers/LanguageProvider";

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
  const { t } = useLanguage();
  const [pendingScale, setPendingScale] = useState<string | null>(null);

  const clampPercent = (value: number) => Math.min(300, Math.max(25, value));
  const setPercent = (percent: number) =>
    onScaleChange(clampPercent(percent) / 100);

  return (
    <div className="z-10 flex h-14 items-center justify-between border-b border-canvas-border bg-canvas-topbar/90 px-6 backdrop-blur">
      <div className="flex items-center gap-4">
        <div className="flex items-center rounded-lg border border-canvas-border bg-canvas-toolbar p-1">
          <button
            onClick={() => onToolChange("select")}
            className={cn(
              "rounded-md p-2 transition-all",
              activeTool === "select"
                ? "bg-blue-500/20 text-blue-400"
                : "text-canvas-muted hover:bg-canvas-hover hover:text-canvas-foreground"
            )}
            aria-label="Select"
          >
            <MousePointer2 className="h-4 w-4" />
          </button>
          <button
            onClick={() => onToolChange("hand")}
            className={cn(
              "rounded-md p-2 transition-all",
              activeTool === "hand"
                ? "bg-blue-500/20 text-blue-400"
                : "text-canvas-muted hover:bg-canvas-hover hover:text-canvas-foreground"
            )}
            aria-label="Hand"
          >
            <Hand className="h-4 w-4" />
          </button>
        </div>

        <div className="h-4 w-px bg-canvas-border" />

        <div className="flex items-center gap-2 text-sm text-canvas-muted">
          <div className="flex items-center gap-1 rounded-md border border-canvas-border bg-canvas-toolbar">
            <button
              aria-label="Zoom out"
              className="h-8 px-2 text-sm text-canvas-muted transition-colors hover:bg-canvas-hover hover:text-canvas-foreground"
              onClick={() => setPercent(Math.round(scale * 100) - 5)}
            >
              −
            </button>
            <input
              aria-label="Canvas zoom"
              className="h-8 w-14 border-0 bg-transparent px-2 text-center text-xs text-canvas-foreground focus:border-none focus:outline-none"
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
            <span className="pr-1 text-xs text-canvas-muted">%</span>
            <button
              aria-label="Zoom in"
              className="h-8 px-2 text-sm text-canvas-muted transition-colors hover:bg-canvas-hover hover:text-canvas-foreground"
              onClick={() => setPercent(Math.round(scale * 100) + 5)}
            >
              +
            </button>
          </div>
        </div>
      </div>

      {/* Right - User Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <Bell className="h-4 w-4" />
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-sm text-muted-foreground hover:text-foreground"
        >
          {t("canvas.quota")}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
        >
          <User className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
