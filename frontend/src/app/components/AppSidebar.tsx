import { useState, useMemo, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import {
  MessageSquarePlus,
  Search,
  Image,
  Presentation,
  FolderOpen,
  PanelLeft,
  Pin,
  Pencil,
  Trash2,
  Loader2,
  MoreHorizontal,
  Settings,
  Share2,
  Bot,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/app/context/SidebarContext";
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
import { useAgentContext } from "@/providers/AgentProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SettingsDialog } from "./SettingsDialog";
import { UserProfileDialog } from "./UserProfileDialog";
import { AgentDialog } from "./AgentDialog";
import { useThreads } from "@/app/hooks/useThreads";
import { getConfig } from "@/lib/config";
import { toast } from "sonner";
import { format } from "date-fns";
import { useLanguage } from "@/providers/LanguageProvider";

export interface AppSidebarProps {
  onNewThread?: () => void;
  onSearch?: () => void;
  onLibrary?: () => void;
  onThreadSelect?: (id: string) => void;
  onMutateReady?: (mutate: () => void) => void;
  onInterruptCountChange?: (count: number) => void;
  onUseAgent?: (agentId: string, agentName: string, systemPrompt: string) => void;
  activeThreadId?: string | null;
}

export function AppSidebar({
  onNewThread,
  onSearch,
  onLibrary,
  onThreadSelect,
  onMutateReady,
  onInterruptCountChange,
  onUseAgent,
  activeThreadId,
}: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { collapsed, toggle } = useSidebar();
  const { user, session } = useAuth();
  const { setActiveAgent } = useAgentContext();
  const config = getConfig();
  const { t } = useLanguage();

  // Define nav items - "search" has special behavior
  const navItems: { icon: typeof MessageSquarePlus; label: string; path: string | null; action: string }[] = [
    { icon: MessageSquarePlus, label: t("sidebar.new_chat"), path: "/", action: "new" },
    { icon: Search, label: t("sidebar.search"), path: null, action: "search" },
    { icon: Bot, label: t("sidebar.agents"), path: null, action: "agent" },
    { icon: FolderOpen, label: t("sidebar.library"), path: null, action: "library" },
  ];

  const [logoHovered, setLogoHovered] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [agentOpen, setAgentOpen] = useState(false);

  // Real threads data
  const threads = useThreads({ limit: 20 });

  // Local state for actions
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState<{ id: string; title: string } | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  // Share dialog state
  const [shareDialogOpen, setShareDialogOpen] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [shareLoading, setShareLoading] = useState(false);

  // Load pinned IDs from local storage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("pinned-threads");
      if (saved) {
        try {
          setPinnedIds(JSON.parse(saved));
        } catch (e) {
          console.error("Failed to parse pinned threads", e);
        }
      }
    }
  }, []);

  // Save pinned IDs when changed
  useEffect(() => {
    if (typeof window !== "undefined") {
      localStorage.setItem("pinned-threads", JSON.stringify(pinnedIds));
    }
  }, [pinnedIds]);

  // Flatten and sort threads
  const sortedHistory = useMemo(() => {
    const flatThreads = threads.data?.flat() ?? [];

    // Sort: pinned items first, then by date (newest first)
    return [...flatThreads].sort((a, b) => {
      const aPinned = pinnedIds.includes(a.id);
      const bPinned = pinnedIds.includes(b.id);

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });
  }, [threads.data, pinnedIds]);

  const handlePin = (threadId: string) => {
    setPinnedIds(prev =>
      prev.includes(threadId)
        ? prev.filter(id => id !== threadId)
        : [...prev, threadId]
    );
  };

  const handleRename = async (threadId: string, currentTitle: string) => {
    const newTitle = prompt(t("sidebar.rename_prompt"), currentTitle);
    if (!newTitle || !newTitle.trim()) return;

    if (!config?.deploymentUrl || !session?.access_token) return;

    try {
      const resp = await fetch(
        `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ title: newTitle.trim() }),
        }
      );

      if (!resp.ok) throw new Error("Failed to update title");

      await threads.mutate();
      toast.success(t("sidebar.rename_success"));
    } catch (e) {
      toast.error(t("sidebar.rename_failed"));
    }
  };

  const handleDeleteClick = (item: { id: string; title: string }) => {
    setItemToDelete(item);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete || !config?.deploymentUrl || !session?.access_token) return;

    try {
      const resp = await fetch(
        `${config.deploymentUrl}/api/threads/${encodeURIComponent(itemToDelete.id)}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${session.access_token}` },
        }
      );

      if (!resp.ok) throw new Error("Failed to delete thread");

      await threads.mutate();
      // If the deleted thread was active (checked via URL or prop), we might want to redirect.
      // For now, just deleting from list is enough.
      toast.success(t("sidebar.delete_success"));
    } catch (e) {
      toast.error(t("sidebar.delete_failed"));
    } finally {
      setDeleteDialogOpen(false);
      setItemToDelete(null);
    }
  };

  // Handle share entire thread - opens dialog with share link
  const handleShareThread = async (threadId: string) => {
    if (!config?.deploymentUrl || !session?.access_token) {
      toast.error(t("sidebar.share_failed"), { description: t("sidebar.share_login_required") });
      return;
    }

    setShareLoading(true);
    setShareDialogOpen(true);
    setShareUrl(null);

    try {
      const response = await fetch(
        `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}/share`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ target_ai_message_id: null }),  // null = share entire conversation
        }
      );

      if (!response.ok) {
        const error = await response.json().catch(() => ({}));
        throw new Error(error.detail || t("sidebar.share_create_failed"));
      }

      const data = await response.json();
      const url = `${window.location.origin}/share/${data.share_id}`;
      setShareUrl(url);

      // Also copy to clipboard automatically
      await navigator.clipboard.writeText(url);
    } catch (error) {
      console.error("Failed to share thread:", error);
      setShareDialogOpen(false);
      toast.error(t("sidebar.share_failed"), {
        description: error instanceof Error ? error.message : t("sidebar.try_again_later"),
      });
    } finally {
      setShareLoading(false);
    }
  };

  // Icon column width
  const iconColWidth = "w-12";

  const handleNavClick = (item: (typeof navItems)[number]) => {
    if (item.action === "new") {
      onNewThread?.();
      if (pathname !== "/") router.push("/");
    } else if (item.action === "search") {
      onSearch?.();
    } else if (item.action === "agent") {
      setAgentOpen(true);
    } else if (item.action === "library") {
      onLibrary?.();
    }
  };

  // Get display name from user_metadata, fallback to email prefix
  const userDisplayName = (user?.user_metadata?.display_name as string) || user?.email?.split("@")[0] || "User";

  const userInitials = userDisplayName.substring(0, 2).toUpperCase();

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
              {/* Logo Image */}
              <div
                className={cn(
                  "absolute inset-0 rounded-lg overflow-hidden transition-opacity duration-150",
                  collapsed && logoHovered ? "opacity-0" : "opacity-100"
                )}
              >
                <img
                  src="/meloo-logo.png"
                  alt="Neloo"
                  className="w-full h-full object-cover"
                />
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
                    <p>{t("sidebar.open_sidebar")}</p>
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
            <span
              className="font-semibold text-foreground text-sm"
              style={{ fontFamily: "'Nunito', sans-serif" }}
            >
              Neloo
            </span>
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
            {t("sidebar.history")}
          </div>
          <div className="flex-1 overflow-y-auto space-y-0.5">
            {threads.isLoading && !threads.data && (
              <div className="flex justify-center p-4">
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              </div>
            )}

            {sortedHistory.map((item) => {
              const isPinned = pinnedIds.includes(item.id);
              const isMenuOpen = openMenuId === item.id;
              const isActive = activeThreadId === item.id;

              return (
                <div
                  key={item.id}
                  className={cn(
                    "group relative w-full flex items-center px-2 py-2 rounded-lg text-sm text-sidebar-foreground cursor-pointer",
                    "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
                    "transition-colors duration-150",
                    isMenuOpen && "bg-sidebar-accent text-sidebar-accent-foreground",
                    isActive && "bg-sidebar-accent text-sidebar-accent-foreground"
                  )}
                  onClick={() => onThreadSelect?.(item.id)}
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    {item.type === "image" ? (
                      <Image className="w-4 h-4 flex-shrink-0 text-sidebar-muted group-hover:text-sidebar-accent-foreground" />
                    ) : item.type === "slides" ? (
                      <Presentation className="w-4 h-4 flex-shrink-0 text-sidebar-muted group-hover:text-sidebar-accent-foreground" />
                    ) : (
                      <MessageSquarePlus className="w-4 h-4 flex-shrink-0 text-sidebar-muted group-hover:text-sidebar-accent-foreground" />
                    )}
                    <span className="truncate">{item.title}</span>
                  </div>

                  {/* Right Actions - visible on hover or when menu is open */}
                  <div className={cn(
                    "flex items-center gap-1 transition-opacity",
                    isMenuOpen ? "opacity-100" : "opacity-0 group-hover:opacity-100"
                  )}>
                    {isPinned && <Pin className="w-3 h-3 text-sidebar-muted mr-1" />}

                    <DropdownMenu open={isMenuOpen} onOpenChange={(open) => setOpenMenuId(open ? item.id : null)}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 hover:bg-foreground/15"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent side="right" align="start" className="w-32">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleShareThread(item.id); }}>
                          <Share2 className="w-4 h-4 mr-2" />
                          {t("sidebar.share")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handlePin(item.id); }}>
                          <Pin className="w-4 h-4 mr-2" />
                          {isPinned ? t("sidebar.unpin") : t("sidebar.pin")}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); handleRename(item.id, item.title); }}>
                          <Pencil className="w-4 h-4 mr-2" />
                          {t("sidebar.rename")}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => { e.stopPropagation(); handleDeleteClick(item); }}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t("sidebar.delete")}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
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
                    <p>{t("sidebar.settings")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <span
                className={cn(
                  "relative z-10 text-sm whitespace-nowrap transition-opacity duration-200",
                  collapsed ? "opacity-0" : "opacity-100"
                )}
              >
                {t("sidebar.settings")}
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
                    <p>{t("sidebar.share")}</p>
                  </TooltipContent>
                )}
              </Tooltip>

              <span
                className={cn(
                  "relative z-10 text-sm whitespace-nowrap transition-opacity duration-200",
                  collapsed ? "opacity-0" : "opacity-100"
                )}
              >
                {t("sidebar.share")}
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
                <div className="text-sm text-foreground truncate">{userDisplayName}</div>
              </div>
            </div>
          </div>
        </div>

      </aside>

      {/* Agent Dialog */}
      <AgentDialog
        open={agentOpen}
        onOpenChange={setAgentOpen}
        onUseAgent={(agentId, agentName, systemPrompt) => {
          // Set active agent in shared context for message injection
          setActiveAgent({
            id: agentId,
            name: agentName,
            systemPrompt: systemPrompt,
          });
          setAgentOpen(false);
        }}
      />

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />

      {/* User Profile Dialog */}
      <UserProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sidebar.delete_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sidebar.delete_description", { title: itemToDelete?.title ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("sidebar.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Share Dialog */}
      <AlertDialog open={shareDialogOpen} onOpenChange={setShareDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("sidebar.share_title")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("sidebar.share_description")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            {shareLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : shareUrl ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={shareUrl}
                  readOnly
                  className="flex-1 rounded-md border border-border bg-muted px-3 py-2 text-sm"
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    await navigator.clipboard.writeText(shareUrl);
                    toast.success(t("sidebar.copied"));
                  }}
                >
                  {t("sidebar.copy")}
                </Button>
              </div>
            ) : null}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.close")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  );
}
