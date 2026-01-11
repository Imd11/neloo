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
  Share2,
  MoreHorizontal,
  PanelLeft,
  Pin,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/app/context/SidebarContext";
import { ThreadList } from "./ThreadList";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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

interface HistoryItem {
  id: number;
  title: string;
  pinned?: boolean;
}

const initialHistoryItems: HistoryItem[] = [
  { id: 1, title: "翻译图中英文" },
  { id: 2, title: "倍率解释与应用" },
  { id: 3, title: "翻译建议" },
  { id: 4, title: "GitHub推送选择建议" },
  { id: 5, title: "Supabase 文件上传路径" },
  { id: 6, title: "React 组件优化" },
  { id: 7, title: "API 接口设计" },
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
  const [historyItems, setHistoryItems] = useState<HistoryItem[]>(initialHistoryItems);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<HistoryItem | null>(null);
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);

  // Sort: pinned items first, then by id
  const sortedHistory = [...historyItems].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return 0;
  });

  const handlePin = (item: HistoryItem) => {
    setHistoryItems(prev =>
      prev.map(h => (h.id === item.id ? { ...h, pinned: !h.pinned } : h))
    );
  };

  const handleRename = (item: HistoryItem) => {
    const newTitle = prompt("请输入新标题", item.title);
    if (newTitle && newTitle.trim()) {
      setHistoryItems(prev =>
        prev.map(h => (h.id === item.id ? { ...h, title: newTitle.trim() } : h))
      );
    }
  };

  const handleDeleteClick = (item: HistoryItem) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (itemToDelete) {
      setHistoryItems(prev => prev.filter(h => h.id !== itemToDelete.id));
    }
    setDeleteDialogOpen(false);
    setItemToDelete(null);
  };

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
          "h-full w-full bg-sidebar border-r border-sidebar-border flex flex-col overflow-hidden",
          collapsed && "transition-[width] duration-200 ease-out"
        )}
      >
        {/* Logo Row */}
        <div className="flex items-center h-12">
          {/* Icon Column - fixed width */}
          <div className={cn(iconColWidth, "flex-shrink-0 flex items-center justify-center")}>
            <div
              className="relative w-7 h-7 cursor-pointer"
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
                <span className="text-background font-bold text-xs">M</span>
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
              "flex items-center justify-between flex-1 pr-2 transition-opacity duration-200",
              collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
            )}
          >
            <span className="font-semibold text-foreground text-sm">MAI</span>
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
        <nav className="py-2 space-y-0.5">
          {navItems.map((item) => {
            const isActive = item.path ? pathname === item.path : false;

            const row = (
              <div
                className={cn(
                  "group relative flex items-center h-10 transition-colors",
                  isActive
                    ? "text-sidebar-accent-foreground"
                    : "text-sidebar-foreground"
                )}
                onClick={() => handleNavClick(item)}
              >
                {/* Expanded state: background covers the whole row but does NOT affect layout */}
                {!collapsed && (
                  <div
                    aria-hidden
                    className={cn(
                      "pointer-events-none absolute inset-y-0 left-1 right-1 rounded-lg transition-colors duration-150",
                      isActive
                        ? "bg-sidebar-accent"
                        : "bg-transparent group-hover:bg-sidebar-accent/50"
                    )}
                  />
                )}

                {/* Icon Column */}
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        iconColWidth,
                        "relative z-10 flex-shrink-0 flex items-center justify-center h-10 rounded-lg transition-colors",
                        // Collapsed state: background only on the icon cell
                        collapsed && isActive && "bg-sidebar-accent",
                        collapsed && !isActive && "hover:bg-sidebar-accent/50"
                      )}
                    >
                      <item.icon className="w-[18px] h-[18px]" />
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
                    "relative z-10 text-sm whitespace-nowrap transition-opacity duration-200",
                    collapsed ? "opacity-0" : "opacity-100"
                  )}
                >
                  {item.label}
                </span>
              </div>
            );

            if (item.path && item.action !== "new" && item.action !== "search") {
              return (
                <Link key={item.path} href={item.path} className="block cursor-pointer">
                  {row}
                </Link>
              );
            }

            return (
              <div key={item.label} className="block cursor-pointer">
                {row}
              </div>
            );
          })}
        </nav>

        {/* Divider */}
        <div
          className={cn(
            "mx-3 my-2 h-px bg-sidebar-border transition-opacity duration-200",
            collapsed ? "opacity-0" : "opacity-100"
          )}
        />

        {/* History Section */}
        <div
          className={cn(
            "flex-1 overflow-hidden flex flex-col px-3 transition-opacity duration-200",
            collapsed ? "opacity-0 pointer-events-none" : "opacity-100"
          )}
        >
          <div className="text-xs text-sidebar-muted uppercase tracking-wider px-2 mb-2">
            历史任务
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {sortedHistory.map((item) => {
              const isMenuOpen = openMenuId === item.id;
              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative w-full flex items-center px-2 py-2 rounded-lg text-sm text-sidebar-foreground",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "transition-colors duration-150",
                    isMenuOpen && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                >
                  <span className="flex-1 truncate text-left">{item.title}</span>

                  {/* Pin icon - always visible when pinned */}
                  {item.pinned && (
                    <Pin className="w-3 h-3 text-muted-foreground flex-shrink-0 mr-1" />
                  )}

                  {/* Three-dot menu - visible on hover or when menu is open */}
                  <DropdownMenu open={isMenuOpen} onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "flex-shrink-0 p-1.5 rounded-md cursor-pointer",
                          "bg-transparent hover:bg-foreground/15 active:bg-foreground/20",
                          "transition-colors duration-150",
                          isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                        )}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <MoreHorizontal className="w-4 h-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent side="right" align="start" className="w-32">
                      <DropdownMenuItem onClick={() => { }}>
                        <Share2 className="w-4 h-4 mr-2" />
                        分享
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handlePin(item)}>
                        <Pin className="w-4 h-4 mr-2" />
                        {item.pinned ? "取消置顶" : "置顶"}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleRename(item)}>
                        <Pencil className="w-4 h-4 mr-2" />
                        重命名
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDeleteClick(item)}
                        className="text-destructive focus:text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        删除
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </div>

        {/* Spacer when collapsed */}
        {collapsed && <div className="flex-1" />}

        {/* Divider */}
        <div
          className={cn(
            "mx-3 my-2 h-px bg-sidebar-border transition-opacity duration-200",
            collapsed ? "opacity-0" : "opacity-100"
          )}
        />

        {/* Bottom Section */}
        <div className="py-2 space-y-0.5">
          {/* Settings */}
          <div onClick={() => setSettingsOpen(true)} className="block cursor-pointer">
            <div className="group relative flex items-center h-10 transition-colors text-sidebar-foreground">
              {!collapsed && (
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-1 right-1 rounded-lg transition-colors duration-150",
                    "bg-transparent group-hover:bg-sidebar-accent/50"
                  )}
                />
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      iconColWidth,
                      "relative z-10 flex-shrink-0 flex items-center justify-center h-10 rounded-lg transition-colors",
                      collapsed && "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Settings className="w-[18px] h-[18px]" />
                  </div>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>设置</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <span
                className={cn(
                  "relative z-10 text-sm whitespace-nowrap transition-opacity duration-200",
                  collapsed ? "opacity-0" : "opacity-100"
                )}
              >
                设置
              </span>
            </div>
          </div>

          {/* Share */}
          <div className="block cursor-pointer">
            <div className="group relative flex items-center h-10 transition-colors text-sidebar-foreground">
              {!collapsed && (
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-1 right-1 rounded-lg transition-colors duration-150",
                    "bg-transparent group-hover:bg-sidebar-accent/50"
                  )}
                />
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      iconColWidth,
                      "relative z-10 flex-shrink-0 flex items-center justify-center h-10 rounded-lg transition-colors",
                      collapsed && "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <Share2 className="w-[18px] h-[18px]" />
                  </div>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>分享</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <span
                className={cn(
                  "relative z-10 text-sm whitespace-nowrap transition-opacity duration-200",
                  collapsed ? "opacity-0" : "opacity-100"
                )}
              >
                分享
              </span>
            </div>
          </div>

          {/* User Profile */}
          <div onClick={() => setProfileOpen(true)} className="block cursor-pointer">
            <div className="group relative flex items-center h-10 transition-colors">
              {!collapsed && (
                <div
                  aria-hidden
                  className={cn(
                    "pointer-events-none absolute inset-y-0 left-1 right-1 rounded-lg transition-colors duration-150",
                    "bg-transparent group-hover:bg-sidebar-accent/50"
                  )}
                />
              )}

              {/* Avatar in icon column */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      iconColWidth,
                      "relative z-10 flex-shrink-0 flex items-center justify-center h-10 rounded-lg transition-colors",
                      collapsed && "hover:bg-sidebar-accent/50"
                    )}
                  >
                    <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-[10px] text-white font-medium">
                      {userInitials}
                    </div>
                  </div>
                </TooltipTrigger>
                {collapsed && (
                  <TooltipContent side="right">
                    <p>{userEmail}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              {/* User info */}
              <div
                className={cn(
                  "relative z-10 flex-1 min-w-0 transition-opacity duration-200",
                  collapsed ? "opacity-0" : "opacity-100"
                )}
              >
                <div className="text-sm text-foreground truncate">{userEmail}</div>
              </div>
            </div>
          </div>
        </div>

      </aside>

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* User Profile Dialog */}
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认删除</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除「{itemToDelete?.title}」吗？此操作无法撤销。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              删除
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
