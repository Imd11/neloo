"use client";

import { useMemo } from "react";
import {
  Loader2,
  Code2,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/artifactParser";

interface ArtifactCardProps {
  artifact: Artifact | null;
  isStreaming: boolean;
  isComplete: boolean;
  onPreview?: () => void;
  className?: string;
}

/**
 * Lightweight Artifact Card for chat messages
 *
 * Design principles:
 * - Minimal visual footprint in conversation
 * - Clear status indication (generating/complete/error)
 * - One-click access to preview
 * - Does not display code (that's in the right panel)
 */
export function ArtifactCard({
  artifact,
  isStreaming,
  isComplete,
  onPreview,
  className,
}: ArtifactCardProps) {
  // Determine status
  const status = useMemo(() => {
    if (isStreaming) return "generating";
    if (isComplete && artifact) return "complete";
    if (!artifact) return "waiting";
    return "complete";
  }, [isStreaming, isComplete, artifact]);

  // Get type label
  const typeLabel = useMemo(() => {
    if (!artifact) return "";
    switch (artifact.type) {
      case "react":
        return "React 组件";
      case "html":
        return "HTML 页面";
      case "vue":
        return "Vue 组件";
      default:
        return "代码";
    }
  }, [artifact]);

  // Status icon and color
  const StatusIcon = useMemo(() => {
    switch (status) {
      case "generating":
        return (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        );
      case "complete":
        return (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        );
      case "waiting":
        return (
          <Code2 className="h-4 w-4 text-muted-foreground" />
        );
      default:
        return (
          <Code2 className="h-4 w-4 text-muted-foreground" />
        );
    }
  }, [status]);

  // Status text
  const statusText = useMemo(() => {
    switch (status) {
      case "generating":
        return "正在构建...";
      case "complete":
        return "已完成";
      case "waiting":
        return "准备中";
      default:
        return "";
    }
  }, [status]);

  // Card is always clickable (even during streaming, to view code in real-time)
  const isClickable = artifact !== null;

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-3 py-2 rounded-lg border bg-muted/30",
        "transition-all duration-200",
        isClickable && "hover:bg-muted/50 cursor-pointer",
        className
      )}
      onClick={isClickable ? onPreview : undefined}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
    >
      {/* Status icon */}
      <div className="flex-shrink-0">{StatusIcon}</div>

      {/* Content */}
      <div className="flex flex-col min-w-0">
        <span className="text-sm font-medium truncate">
          {artifact?.title || (status === "generating" ? "生成代码中" : "代码预览")}
        </span>
        <span className="text-xs text-muted-foreground">
          {typeLabel && `${typeLabel} · `}
          {statusText}
          {status === "generating" && artifact?.code && (
            <span className="ml-1">({artifact.code.length} 字符)</span>
          )}
        </span>
      </div>

      {/* Action button */}
      {isClickable && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview?.();
          }}
          className={cn(
            "flex items-center gap-1 px-2 py-1 rounded-md",
            "text-xs font-medium",
            status === "generating"
              ? "bg-primary/20 text-primary hover:bg-primary/30"
              : "bg-primary text-primary-foreground hover:bg-primary/90",
            "transition-colors"
          )}
        >
          <Eye className="h-3 w-3" />
          {status === "generating" ? "查看" : "预览"}
        </button>
      )}
    </div>
  );
}

/**
 * Compact version for inline display
 */
export function ArtifactCardCompact({
  artifact,
  isStreaming,
  onPreview,
  className,
}: {
  artifact: Artifact | null;
  isStreaming: boolean;
  onPreview?: () => void;
  className?: string;
}) {
  if (isStreaming) {
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs",
          "bg-primary/10 text-primary",
          className
        )}
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        <span>构建中...</span>
      </span>
    );
  }

  if (!artifact) return null;

  return (
    <button
      onClick={onPreview}
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-xs",
        "bg-green-500/10 text-green-600 dark:text-green-400",
        "hover:bg-green-500/20 transition-colors",
        className
      )}
    >
      <CheckCircle2 className="h-3 w-3" />
      <span>{artifact.title || "查看预览"}</span>
      <Eye className="h-3 w-3" />
    </button>
  );
}
