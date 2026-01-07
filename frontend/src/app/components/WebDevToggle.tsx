"use client";

import { Code2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WebDevToggleProps {
  enabled: boolean;
  locked: boolean; // thread has messages, mode can't be changed
  onEnable: () => void;
  className?: string;
}

/**
 * Toggle button for Web Development mode.
 *
 * When enabled, the AI will output code wrapped in <artifact> tags
 * that can be rendered in a preview panel using Sandpack.
 *
 * Once enabled on a thread (after first message is sent), the mode
 * is locked and cannot be changed. User must create a new thread
 * to use a different mode.
 */
export function WebDevToggle({
  enabled,
  locked,
  onEnable,
  className,
}: WebDevToggleProps) {
  // When mode is enabled, show prominent active indicator
  if (enabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-full",
          "bg-gradient-to-r from-violet-500 to-purple-600",
          "text-white shadow-md shadow-purple-500/30",
          "border border-purple-400/50",
          "animate-pulse-subtle",
          className
        )}
      >
        <Sparkles className="h-4 w-4" />
        <span className="text-sm font-semibold">Web Dev ON</span>
      </div>
    );
  }

  // When mode is not enabled, show toggle button
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onEnable}
      disabled={locked}
      className={cn(
        "gap-2 h-8 transition-all duration-200",
        "hover:border-purple-400 hover:bg-purple-50 hover:text-purple-700",
        "dark:hover:bg-purple-950/30 dark:hover:text-purple-300",
        className
      )}
      title={locked ? "Cannot change mode after messages have been sent" : "Enable Web Development mode"}
    >
      <Code2 className="h-4 w-4" />
      <span className="text-sm">Web Dev</span>
    </Button>
  );
}
