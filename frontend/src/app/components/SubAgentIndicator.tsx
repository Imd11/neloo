"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronUp, Loader2, CheckCircle2, XCircle, Clock } from "lucide-react";
import type { SubAgent } from "@/app/types/types";
import { cn } from "@/lib/utils";

interface SubAgentIndicatorProps {
  subAgent: SubAgent;
  onClick: () => void;
  isExpanded?: boolean;
}

/**
 * Format elapsed time in a human-readable format
 * - Under 60s: "Xs" (e.g., "12s")
 * - 60s+: "Xm Ys" (e.g., "2m 35s")
 */
function formatElapsedTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

/**
 * Get status display configuration
 */
function getStatusConfig(status: SubAgent["status"]) {
  switch (status) {
    case "pending":
      return {
        icon: Clock,
        label: "等待中",
        className: "text-amber-500",
        bgClassName: "bg-amber-50 dark:bg-amber-950/30",
        borderClassName: "border-amber-200 dark:border-amber-800",
        animate: false,
      };
    case "active":
      return {
        icon: Loader2,
        label: "执行中",
        className: "text-blue-500",
        bgClassName: "bg-blue-50 dark:bg-blue-950/30",
        borderClassName: "border-blue-200 dark:border-blue-800",
        animate: true,
      };
    case "completed":
      return {
        icon: CheckCircle2,
        label: "已完成",
        className: "text-emerald-500",
        bgClassName: "bg-emerald-50 dark:bg-emerald-950/30",
        borderClassName: "border-emerald-200 dark:border-emerald-800",
        animate: false,
      };
    case "error":
      return {
        icon: XCircle,
        label: "失败",
        className: "text-red-500",
        bgClassName: "bg-red-50 dark:bg-red-950/30",
        borderClassName: "border-red-200 dark:border-red-800",
        animate: false,
      };
    default:
      return {
        icon: Clock,
        label: "未知",
        className: "text-gray-500",
        bgClassName: "bg-gray-50 dark:bg-gray-950/30",
        borderClassName: "border-gray-200 dark:border-gray-800",
        animate: false,
      };
  }
}

/**
 * Get a friendly display name for the subagent type
 */
function getSubAgentDisplayName(name: string): string {
  const nameMap: Record<string, string> = {
    "eda-analyst": "数据探索分析",
    "stats-analyst": "统计分析",
    "regression-analyst": "回归分析",
    "viz-analyst": "可视化分析",
    "general-purpose": "通用任务",
  };
  return nameMap[name] || name;
}

export const SubAgentIndicator = React.memo<SubAgentIndicatorProps>(
  ({ subAgent, onClick, isExpanded = true }) => {
    const [elapsedTime, setElapsedTime] = useState(0);
    const [startTime] = useState(() => {
      // Use startedAt if available, otherwise use current time for active tasks
      if (subAgent.startedAt) {
        return subAgent.startedAt;
      }
      return subAgent.status === "active" || subAgent.status === "pending"
        ? Date.now()
        : null;
    });

    // Timer effect for active tasks
    useEffect(() => {
      if (subAgent.status !== "active" || !startTime) {
        return;
      }

      // Update immediately
      setElapsedTime(Date.now() - startTime);

      // Update every second
      const interval = setInterval(() => {
        setElapsedTime(Date.now() - startTime);
      }, 1000);

      return () => clearInterval(interval);
    }, [subAgent.status, startTime]);

    // Calculate final elapsed time for completed tasks
    const displayTime = useCallback(() => {
      if (subAgent.status === "active" && startTime) {
        return formatElapsedTime(elapsedTime);
      }
      if (subAgent.status === "completed" && subAgent.completedAt && startTime) {
        return formatElapsedTime(subAgent.completedAt - startTime);
      }
      if (subAgent.status === "completed" && elapsedTime > 0) {
        return formatElapsedTime(elapsedTime);
      }
      return null;
    }, [subAgent.status, subAgent.completedAt, startTime, elapsedTime]);

    const statusConfig = getStatusConfig(subAgent.status);
    const StatusIcon = statusConfig.icon;
    const displayName = getSubAgentDisplayName(subAgent.subAgentName);
    const timeDisplay = displayTime();

    return (
      <div
        className={cn(
          "w-fit max-w-[70vw] overflow-hidden rounded-xl border transition-all duration-300",
          statusConfig.bgClassName,
          statusConfig.borderClassName
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={onClick}
          className={cn(
            "flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-200",
            "hover:bg-transparent"
          )}
        >
          <div className="flex w-full items-center justify-between gap-3">
            {/* Left side: Status icon + Name */}
            <div className="flex items-center gap-2.5">
              <StatusIcon
                size={16}
                className={cn(
                  statusConfig.className,
                  statusConfig.animate && "animate-spin"
                )}
              />
              <div className="flex flex-col">
                <span className="font-sans text-[14px] font-semibold leading-tight text-foreground">
                  {displayName}
                </span>
                <span className="font-sans text-[11px] text-muted-foreground">
                  {subAgent.subAgentName}
                </span>
              </div>
            </div>

            {/* Right side: Status badge + Time + Chevron */}
            <div className="flex items-center gap-2.5">
              {/* Status badge */}
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  statusConfig.bgClassName,
                  statusConfig.className
                )}
              >
                {statusConfig.label}
              </span>

              {/* Time display */}
              {timeDisplay && (
                <span className="font-mono text-[12px] tabular-nums text-muted-foreground">
                  {timeDisplay}
                </span>
              )}

              {/* Expand/Collapse chevron */}
              {isExpanded ? (
                <ChevronUp size={14} className="shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown size={14} className="shrink-0 text-muted-foreground" />
              )}
            </div>
          </div>
        </Button>
      </div>
    );
  }
);

SubAgentIndicator.displayName = "SubAgentIndicator";
