"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  LogOut,
} from "lucide-react";
import { ThreadList } from "./ThreadList";

interface AppSidebarProps {
  onNewThread: () => void;
  onSearch: () => void;
  onLibrary: () => void;
  onThreadSelect: (id: string) => void;
  onMutateReady?: (mutate: () => void) => void;
  onInterruptCountChange?: (count: number) => void;
  onLogout?: () => void;
  currentThreadId?: string | null;
}

export function AppSidebar({
  onNewThread,
  onSearch,
  onLibrary,
  onThreadSelect,
  onMutateReady,
  onInterruptCountChange,
  onLogout,
}: AppSidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          "flex h-full flex-col border-r border-border bg-card transition-all duration-300",
          collapsed ? "w-16" : "w-80"
        )}
      >
        {/* Header with logo and collapse button */}
        <div className="flex h-14 items-center justify-between border-b border-border px-3">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F6868]">
                <span className="text-sm font-bold text-white">DA</span>
              </div>
              <span className="font-semibold text-foreground">Data Analyst</span>
            </div>
          )}
          {collapsed && (
            <div className="mx-auto flex h-8 w-8 items-center justify-center rounded-lg bg-[#2F6868]">
              <span className="text-sm font-bold text-white">DA</span>
            </div>
          )}
          {!collapsed && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(true)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <PanelLeftClose className="h-4 w-4" />
            </Button>
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

        {/* Footer with expand button and logout */}
        <div className={cn(
          "border-t border-border p-2",
          collapsed ? "flex flex-col items-center gap-1" : "flex items-center justify-between"
        )}>
          {collapsed && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setCollapsed(false)}
                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                >
                  <PanelLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">展开侧边栏</TooltipContent>
            </Tooltip>
          )}
          {onLogout && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onLogout}
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">退出登录</TooltipContent>
            </Tooltip>
          )}
          {!collapsed && (
            <span className="text-xs text-muted-foreground">v1.0.0</span>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
