"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  PanelLeftClose,
  PanelLeft,
  SquarePen,
  Search,
  FolderOpen,
} from "lucide-react";
import { ThreadList } from "./ThreadList";
import { ThemeToggle } from "@/components/auth/ThemeToggle";
import { UserAvatar } from "@/components/auth/UserAvatar";

interface AppSidebarProps {
  onNewThread: () => void;
  onSearch: () => void;
  onLibrary: () => void;
  onThreadSelect: (id: string) => void;
  onMutateReady?: (mutate: () => void) => void;
  onInterruptCountChange?: (count: number) => void;
  currentThreadId?: string | null;
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function AppSidebar({
  onNewThread,
  onSearch,
  onLibrary,
  onThreadSelect,
  onMutateReady,
  onInterruptCountChange,
  collapsed: controlledCollapsed,
  onCollapsedChange,
}: AppSidebarProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(false);

  // Support both controlled and uncontrolled mode
  const collapsed = controlledCollapsed ?? internalCollapsed;
  const setCollapsed = onCollapsedChange ?? setInternalCollapsed;

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className="flex h-full w-full flex-col border-r border-border bg-card"
      >
        {/* Header with logo and collapse/expand button */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed ? (
            <>
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F6868]">
                  <span className="text-sm font-bold text-white">M</span>
                </div>
                <span className="font-semibold text-foreground">Mello</span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setCollapsed(true)}
                className="h-8 w-8 text-muted-foreground hover:text-foreground"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setCollapsed(false)}
                  className="group mx-auto relative flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F6868] hover:bg-[#2F6868]/80 transition-all duration-200"
                >
                  {/* Logo - visible by default, hidden on hover */}
                  <span className="text-sm font-bold text-white transition-opacity duration-200 group-hover:opacity-0">
                    M
                  </span>
                  {/* Expand icon - hidden by default, visible on hover */}
                  <PanelLeft className="absolute h-4 w-4 text-white opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right">展开侧边栏</TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Action buttons */}
        <div className={cn("flex flex-col gap-1 p-2", collapsed && "items-center")}>
          {/* New Task Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="default"
                size={collapsed ? "icon" : "default"}
                onClick={onNewThread}
                className={cn(
                  "bg-[#2F6868] text-white hover:bg-[#2F6868]/80",
                  !collapsed && "w-full justify-start"
                )}
              >
                <SquarePen className={cn("h-4 w-4", !collapsed && "mr-2")} />
                {!collapsed && "新建任务"}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">新建任务</TooltipContent>}
          </Tooltip>

          {/* Search Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={onSearch}
                className={cn(!collapsed && "w-full justify-start")}
              >
                <Search className={cn("h-4 w-4", !collapsed && "mr-2")} />
                {!collapsed && "搜索"}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">搜索</TooltipContent>}
          </Tooltip>

          {/* Library Button */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size={collapsed ? "icon" : "default"}
                onClick={onLibrary}
                className={cn(!collapsed && "w-full justify-start")}
              >
                <FolderOpen className={cn("h-4 w-4", !collapsed && "mr-2")} />
                {!collapsed && "库"}
              </Button>
            </TooltipTrigger>
            {collapsed && <TooltipContent side="right">库</TooltipContent>}
          </Tooltip>
        </div>

        {/* Thread list - only shown when expanded */}
        {!collapsed && (
          <div className="flex-1 overflow-hidden">
            <div className="border-t border-border">
              <div className="relative h-full" style={{ height: "calc(100vh - 220px)" }}>
                <ThreadList
                  onThreadSelect={onThreadSelect}
                  onMutateReady={onMutateReady}
                  onInterruptCountChange={onInterruptCountChange}
                />
              </div>
            </div>
          </div>
        )}

        {/* Expand button when collapsed */}
        {collapsed && (
          <div className="flex-1" />
        )}

        {/* Footer with theme toggle and user avatar */}
        <div className={cn(
          "border-t border-border p-2",
          collapsed ? "flex flex-col items-center gap-2" : "flex items-center justify-between"
        )}>
          <div className={cn(
            "flex items-center",
            collapsed ? "flex-col gap-2" : "gap-2"
          )}>
            <Tooltip>
              <TooltipTrigger asChild>
                <div>
                  <ThemeToggle />
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">切换主题</TooltipContent>}
            </Tooltip>
            <UserAvatar dropdownDirection="up" />
          </div>
          {!collapsed && (
            <span className="text-xs text-muted-foreground">v1.0.0</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
