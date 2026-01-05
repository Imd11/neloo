"use client";

import { Code2 } from "lucide-react";
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
  // When mode is enabled, show indicator
  if (enabled) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full border border-primary/20",
          className
        )}
      >
        <Code2 className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium text-primary">Web Dev</span>
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
      className={cn("gap-2 h-8", className)}
      title={locked ? "Cannot change mode after messages have been sent" : "Enable Web Development mode"}
    >
      <Code2 className="h-4 w-4" />
      <span className="text-sm">Web Dev</span>
    </Button>
  );
}
