"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquarePlus,
  Search,
  Image,
  Video,
  FolderOpen,
  Settings,
  PanelLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/app/context/SidebarContext";
import { ThemeToggle } from "@/components/auth/ThemeToggle";
import { ThreadList } from "./ThreadList";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import { useAuth } from "@/providers/AuthProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SettingsDialog } from "./SettingsDialog";
import { UserProfileDialog } from "./UserProfileDialog";

// Define nav items - "search" has special behavior
const navItems = [
  { icon: MessageSquarePlus, label: "新建对话", path: "/", action: "new" },
  { icon: Search, label: "搜索", path: null, action: "search" },
  { icon: Image, label: "生图", path: "/image" },
  { icon: Video, label: "生视频", path: "/video" },
  { icon: FolderOpen, label: "库", path: "/library" },
];

export interface AppSidebarProps {
  onNewThread?: () => void;
  onSearch?: () => void;
  onLibrary?: () => void;
  onThreadSelect?: (id: string) => void;
  onMutateReady?: (mutate: () => void) => void;
  onInterruptCountChange?: (count: number) => void;
}

export function AppSidebar({
  onNewThread,
  onSearch,
  onLibrary,
  onThreadSelect,
  onMutateReady,
  onInterruptCountChange,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const { user } = useAuth();

  const [logoHovered, setLogoHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  // Icon column width
  const iconColWidth = "w-12";

  const handleNavClick = (item: typeof navItems[0]) => {
    if (item.action === "new") {
      onNewThread?.();
      if (pathname !== "/") router.push("/");
    } else if (item.action === "search") {
      onSearch?.();
    } else if (item.path) {
      if (item.label === "库") onLibrary?.();
      // Regular navigation is handled by Link or router
    }
  };

  const userInitials = user?.email
    ? user.email.split("@")[0].substring(0, 2).toUpperCase()
    : "U";

  const userEmail = user?.email || "User";

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "h-full w-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden text-sidebar-foreground",
          collapsed && "transition-[width] duration-200 ease-out"
        )}
      >
        {/* Logo Row */}
        <div className="flex items-center h-14 px-2">
          {/* Icon Column - fixed width */}
          <div className={cn(iconColWidth, "flex-shrink-0 flex items-center justify-center")}>
            <div
              className="relative w-8 h-8 cursor-pointer flex items-center justify-center"
              onMouseEnter={() => setLogoHovered(true)}
              onMouseLeave={() => setLogoHovered(false)}
              onClick={collapsed ? toggle : undefined}
            >
              {/* Logo */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg bg-foreground flex items-center justify-center transition-opacity duration-150",
                  collapsed && logoHovered ? "opacity-0" : "opacity-100"
                )}
              >
                <span className="text-background font-bold text-sm">M</span>
              </div>
              {/* Expand button when collapsed */}
              {collapsed && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "absolute inset-0 rounded-lg bg-sidebar-accent flex items-center justify-center transition-opacity duration-150",
                        logoHovered ? "opacity-100" : "opacity-0"
                      )}
                    >
                      <PanelLeft className="w-4 h-4 text-foreground" />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">
                    <p>打开边栏</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
          {/* Text Column - expandable */}
          <div
            className={cn(
              "flex items-center justify-between flex-1 pr-2 transition-opacity duration-200 ml-2",
              collapsed ? "opacity-0 pointer-events-none w-0" : "opacity-100"
            )}
          >
            <span className="font-semibold text-lg tracking-tight">Mello</span>
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7 text-muted-foreground hover:text-foreground"
              onClick={toggle}
            >
              <PanelLeft className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="py-2 px-2 space-y-1">
          {navItems.map((item) => {
            const isActive = item.path ? pathname === item.path : false;

            const content = (
              <div
                className={cn(
                  "group relative flex items-center h-10 transition-colors cursor-pointer rounded-lg",
                  isActive
                    ? "text-sidebar-accent-foreground font-medium"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50"
                )}
                onClick={() => handleNavClick(item)}
              >
                {/* Active Indicator Background */}
                {!collapsed && isActive && (
                  <div
                    aria-hidden
                    className="absolute inset-0 bg-sidebar-accent rounded-lg"
                  />
                )}

                {/* Icon Column */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        iconColWidth,
                        "relative z-10 flex-shrink-0 flex items-center justify-center h-10 rounded-lg transition-colors",
                        // Collapsed state logic
                        collapsed && isActive && "bg-sidebar-accent",
                        collapsed && !isActive && "hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className={cn("w-5 h-5", isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground")} />
                    </div>
                  </TooltipTrigger>
                  {collapsed && (
                    <TooltipContent side="right">
                      <p>{item.label}</p>
                    </TooltipContent>
                  )}
                </Tooltip>

                {/* Text Column */}
                <span
                  className={cn(
                    "relative z-10 text-sm whitespace-nowrap transition-opacity duration-200 ml-1",
                    collapsed ? "opacity-0 w-0 hidden" : "opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </div>
            );

            // Wrap in Link if it's a navigational item without special action
            if (item.path && item.action !== "new") {
              return (
                <Link key={item.path} href={item.path}>
                  {content}
                </Link>
              );
            }

            return <div key={item.label}>{content}</div>;
          })}
        </nav>

        {/* Divider */}
        <div
          className={cn(
            "mx-4 my-2 h-px bg-sidebar-border/60 transition-opacity duration-200",
            collapsed ? "opacity-0" : "opacity-100"
          )}
        />

        {/* History Section (Using existing ThreadList logic) */}
        {!collapsed && (
          <div className="flex-1 overflow-hidden flex flex-col px-3">
            <div className="text-xs text-sidebar-muted uppercase tracking-wider px-2 mb-2 font-medium">
              最近
            </div>
            <div className="flex-1 overflow-hidden relative">
              {/* Embed existing ThreadList - styling might need tweaks inside ThreadList component */}
              <ThreadList
                onThreadSelect={onThreadSelect}
                onMutateReady={onMutateReady}
                onInterruptCountChange={onInterruptCountChange}
                className="h-full"
              />
            </div>
          </div>
        )}

        {/* Spacer when collapsed */}
        {collapsed && <div className="flex-1" />}

        {/* Bottom Section: Settings & User */}
        <div className="p-2 space-y-1 mt-auto border-t border-sidebar-border/40">
          {/* Settings */}
          <div
            onClick={() => setSettingsOpen(true)}
            className="group relative flex items-center h-10 rounded-lg hover:bg-sidebar-accent/50 cursor-pointer text-sidebar-foreground transition-colors"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(iconColWidth, "flex-shrink-0 flex items-center justify-center")}>
                  <Settings className="w-5 h-5 text-muted-foreground group-hover:text-foreground" />
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">设置</TooltipContent>}
            </Tooltip>
            {!collapsed && <span className="text-sm ml-1">设置</span>}
          </div>

          {/* Theme Toggle Button reused purely as icon/text row? 
              Actually, let's keep it as separate row for theme if we want, 
              OR integrate into settings. 
              The original design had "Theme" here. 
          */}
          <div className="group relative flex items-center h-10 rounded-lg hover:bg-sidebar-accent/50 cursor-pointer text-sidebar-foreground transition-colors">
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(iconColWidth, "flex-shrink-0 flex items-center justify-center")}>
                  <div className="scale-75 origin-center pointer-events-auto">
                    <ThemeToggle />
                  </div>
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">主题</TooltipContent>}
            </Tooltip>
            {!collapsed && (
              <div className="flex items-center gap-2 ml-1">
                <span className="text-sm">配色</span>
              </div>
            )}
          </div>

          {/* User Profile */}
          <div
            onClick={() => setProfileOpen(true)}
            className="group relative flex items-center h-12 rounded-lg hover:bg-sidebar-accent/50 cursor-pointer text-sidebar-foreground transition-colors mt-1"
          >
            <Tooltip>
              <TooltipTrigger asChild>
                <div className={cn(iconColWidth, "flex-shrink-0 flex items-center justify-center")}>
                  <Avatar className="h-8 w-8 rounded-lg bg-sidebar-accent flex items-center justify-center">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </div>
              </TooltipTrigger>
              {collapsed && <TooltipContent side="right">个人资料</TooltipContent>}
            </Tooltip>
            {!collapsed && (
              <div className="ml-1 min-w-0">
                <div className="text-sm font-medium truncate">{userEmail}</div>
                <div className="text-xs text-muted-foreground truncate">Free Plan</div>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Dialogs */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </TooltipProvider>
  );
}
