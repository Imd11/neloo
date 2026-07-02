"use client";

import { useEffect, useMemo, useState, useRef, useCallback, KeyboardEvent } from "react";
import { format } from "date-fns";
import { Loader2, MessageSquare, Trash2, Pencil, Check, X } from "lucide-react";
import { useQueryState } from "nuqs";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { ThreadItem } from "@/app/hooks/useThreads";
import { useThreads } from "@/app/hooks/useThreads";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";
import { toast } from "sonner";

type StatusFilter = "all" | "idle" | "busy" | "interrupted" | "error";

const GROUP_LABELS = {
  interrupted: "thread.needs_attention",
  today: "thread.today",
  yesterday: "thread.yesterday",
  week: "thread.this_week",
  older: "thread.older",
} as const;

const STATUS_COLORS: Record<ThreadItem["status"], string> = {
  idle: "bg-green-500",
  busy: "bg-blue-500",
  interrupted: "bg-orange-500",
  error: "bg-red-600",
};

function getThreadColor(status: ThreadItem["status"]): string {
  return STATUS_COLORS[status] ?? "bg-gray-400";
}

function formatTime(date: Date, now = new Date()): string {
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return format(date, "HH:mm");
  if (days === 1) return "Yesterday";
  if (days < 7) return format(date, "EEEE");
  return format(date, "MM/dd");
}

function StatusFilterItem({
  status,
  label,
  badge,
}: {
  status: ThreadItem["status"];
  label: string;
  badge?: number;
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={cn(
          "inline-block size-2 rounded-full",
          getThreadColor(status)
        )}
      />
      {label}
      {badge !== undefined && badge > 0 && (
        <span className="ml-1 inline-flex items-center justify-center rounded-full bg-red-600 px-1.5 py-0.5 text-xs font-bold leading-none text-white">
          {badge}
        </span>
      )}
    </span>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <p className="text-sm text-red-600">Failed to load threads</p>
      <p className="mt-1 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="space-y-2 p-4">
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-16 w-full"
        />
      ))}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <MessageSquare className="mb-2 h-12 w-12 text-gray-300" />
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

interface ThreadListProps {
  className?: string;
  onThreadSelect?: (id: string) => void;
  onMutateReady?: (mutate: () => void) => void;
  onInterruptCountChange?: (count: number) => void;
}

export function ThreadList({
  onThreadSelect,
  onMutateReady,
  onInterruptCountChange,
}: ThreadListProps) {
  const [currentThreadId, setCurrentThreadId] = useQueryState("threadId");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const editInputRef = useRef<HTMLInputElement>(null);
  const config = getConfig();
  const { session } = useAuth();
  const { t } = useLanguage();

  const threads = useThreads({
    status: statusFilter === "all" ? undefined : statusFilter,
    limit: 20,
  });

  const flattened = useMemo(() => {
    return threads.data?.flat() ?? [];
  }, [threads.data]);

  const isLoadingMore =
    threads.size > 0 && threads.data?.[threads.size - 1] == null;
  const isEmpty = threads.data?.at(0)?.length === 0;
  const isReachingEnd = isEmpty || (threads.data?.at(-1)?.length ?? 0) < 20;

  // Group threads by time and status
  const grouped = useMemo(() => {
    const now = new Date();
    const groups: Record<keyof typeof GROUP_LABELS, ThreadItem[]> = {
      interrupted: [],
      today: [],
      yesterday: [],
      week: [],
      older: [],
    };

    flattened.forEach((thread) => {
      if (thread.status === "interrupted") {
        groups.interrupted.push(thread);
        return;
      }

      const diff = now.getTime() - thread.updatedAt.getTime();
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));

      if (days === 0) {
        groups.today.push(thread);
      } else if (days === 1) {
        groups.yesterday.push(thread);
      } else if (days < 7) {
        groups.week.push(thread);
      } else {
        groups.older.push(thread);
      }
    });

    return groups;
  }, [flattened]);

  const interruptedCount = useMemo(() => {
    return flattened.filter((t) => t.status === "interrupted").length;
  }, [flattened]);

  const _handleDeleteThread = useCallback(
    async (threadId: string) => {
      if (!config?.deploymentUrl) return;
      if (!session?.access_token) {
        toast.error(t("common.login_required"));
        return;
      }

      const ok = window.confirm(t("thread.confirm_delete"));
      if (!ok) return;

      try {
        const resp = await fetch(
          `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}`,
          {
            method: "DELETE",
            headers: { Authorization: `Bearer ${session.access_token}` },
          }
        );

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `HTTP ${resp.status}`);
        }

        // If deleting the currently open thread, reset to a new thread.
        if (currentThreadId === threadId) {
          await setCurrentThreadId(null);
        }

        await threads.mutate();
      } catch (e) {
        toast.error(t("thread.delete_failed"), {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [config?.deploymentUrl, currentThreadId, session?.access_token, setCurrentThreadId, threads, t]
  );

  const startEditingTitle = useCallback(
    (threadId: string, currentTitle: string) => {
      setEditingThreadId(threadId);
      setEditingTitle(currentTitle);
      // Focus input after render
      setTimeout(() => {
        editInputRef.current?.focus();
        editInputRef.current?.select();
      }, 0);
    },
    []
  );

  const cancelEditing = useCallback(() => {
    setEditingThreadId(null);
    setEditingTitle("");
  }, []);

  const saveTitle = useCallback(
    async (threadId: string) => {
      if (!config?.deploymentUrl || !session?.access_token) return;

      const newTitle = editingTitle.trim();
      if (!newTitle) {
        toast.error(t("thread.title_empty"));
        return;
      }

      try {
        const resp = await fetch(
          `${config.deploymentUrl}/api/threads/${encodeURIComponent(threadId)}`,
          {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session.access_token}`,
            },
            body: JSON.stringify({ title: newTitle }),
          }
        );

        if (!resp.ok) {
          const text = await resp.text();
          throw new Error(text || `HTTP ${resp.status}`);
        }

        await threads.mutate();
        setEditingThreadId(null);
        setEditingTitle("");
      } catch (e) {
        toast.error(t("thread.title_update_failed"), {
          description: e instanceof Error ? e.message : String(e),
        });
      }
    },
    [config?.deploymentUrl, session?.access_token, editingTitle, threads, t]
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLInputElement>, threadId: string) => {
      if (e.key === "Enter") {
        e.preventDefault();
        saveTitle(threadId);
      } else if (e.key === "Escape") {
        e.preventDefault();
        cancelEditing();
      }
    },
    [saveTitle, cancelEditing]
  );

  // Expose thread list revalidation to parent component
  // Use refs to create a stable callback that always calls the latest mutate function
  const onMutateReadyRef = useRef(onMutateReady);
  const mutateRef = useRef(threads.mutate);

  useEffect(() => {
    onMutateReadyRef.current = onMutateReady;
  }, [onMutateReady]);

  useEffect(() => {
    mutateRef.current = threads.mutate;
  }, [threads.mutate]);

  const mutateFn = useCallback(() => {
    mutateRef.current();
  }, []);

  useEffect(() => {
    onMutateReadyRef.current?.(mutateFn);
    // Only run once on mount to avoid infinite loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Notify parent of interrupt count changes
  useEffect(() => {
    onInterruptCountChange?.(interruptedCount);
  }, [interruptedCount, onInterruptCountChange]);

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Header with title and filter */}
      <div className="grid flex-shrink-0 grid-cols-[1fr_auto] items-center gap-3 border-b border-border p-4">
        <h2 className="text-lg font-semibold tracking-tight">{t("thread.history_title")}</h2>
        <div className="flex items-center gap-2">
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as StatusFilter)}
          >
            <SelectTrigger className="w-fit">
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">{t("thread.all_status")}</SelectItem>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{t("thread.active_group")}</SelectLabel>
                <SelectItem value="idle">
                  <StatusFilterItem
                    status="idle"
                    label={t("thread.idle")}
                  />
                </SelectItem>
                <SelectItem value="busy">
                  <StatusFilterItem
                    status="busy"
                    label={t("thread.running")}
                  />
                </SelectItem>
              </SelectGroup>
              <SelectSeparator />
              <SelectGroup>
                <SelectLabel>{t("thread.needs_attention")}</SelectLabel>
                <SelectItem value="interrupted">
                  <StatusFilterItem
                    status="interrupted"
                    label={t("thread.interrupted")}
                    badge={interruptedCount}
                  />
                </SelectItem>
                <SelectItem value="error">
                  <StatusFilterItem
                    status="error"
                    label={t("thread.error")}
                  />
                </SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <ScrollArea className="h-0 flex-1">
        {threads.error && <ErrorState message={threads.error.message} />}

        {!threads.error && !threads.data && threads.isLoading && (
          <LoadingState />
        )}

        {!threads.error && !threads.isLoading && isEmpty && <EmptyState message={t("thread.empty")} />}

        {!threads.error && !isEmpty && (
          <div className="box-border w-full max-w-full overflow-hidden p-2">
            {(
              Object.keys(GROUP_LABELS) as Array<keyof typeof GROUP_LABELS>
            ).map((group) => {
              const groupThreads = grouped[group];
              if (groupThreads.length === 0) return null;

              return (
                <div
                  key={group}
                  className="mb-4"
                >
                  <h4 className="m-0 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {t(GROUP_LABELS[group])}
                  </h4>
                  <div className="flex flex-col gap-1">
                    {groupThreads.map((thread) => (
                      <div
                        key={thread.id}
                        onClick={() => onThreadSelect?.(thread.id)}
                        className={cn(
                          "group grid w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-3 text-left transition-colors duration-200",
                          "hover:bg-accent",
                          currentThreadId === thread.id
                            ? "border border-primary bg-accent hover:bg-accent"
                            : "border border-transparent bg-transparent"
                        )}
                        aria-current={currentThreadId === thread.id}
                        role="button"
                        tabIndex={0}
                      >
                        <div className="min-w-0 flex-1">
                          {/* Title + Timestamp Row */}
                          <div className="mb-1 flex items-center justify-between">
                            {editingThreadId === thread.id ? (
                              <div className="flex flex-1 items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                <input
                                  ref={editInputRef}
                                  type="text"
                                  value={editingTitle}
                                  onChange={(e) => setEditingTitle(e.target.value)}
                                  onKeyDown={(e) => handleKeyDown(e, thread.id)}
                                  className="h-6 flex-1 rounded border border-input bg-background px-2 text-sm font-semibold focus:outline-none focus:ring-1 focus:ring-ring"
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => saveTitle(thread.id)}
                                  aria-label="Save title"
                                >
                                  <Check className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={cancelEditing}
                                  aria-label="Cancel editing"
                                >
                                  <X className="h-3 w-3 text-muted-foreground" />
                                </Button>
                              </div>
                            ) : (
                              <>
                                <h3 className="truncate text-sm font-semibold">
                                  {thread.title}
                                </h3>
                                <div className="ml-2 flex flex-shrink-0 items-center gap-1">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingTitle(thread.id, thread.title);
                                    }}
                                    aria-label="Edit title"
                                  >
                                    <Pencil className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                  <span className="text-xs text-muted-foreground">
                                    {formatTime(thread.updatedAt)}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          {/* Description + Status Row */}
                          <div className="flex items-center justify-between">
                            <p className="flex-1 truncate text-sm text-muted-foreground">
                              {thread.description}
                            </p>
                            <div className="ml-2 flex-shrink-0">
                              <div className="flex items-center gap-2">
                                <div
                                  className={cn(
                                    "h-2 w-2 rounded-full",
                                    getThreadColor(thread.status)
                                  )}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className="h-7 w-7 opacity-0 transition-opacity group-hover:opacity-100"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void _handleDeleteThread(thread.id);
                                  }}
                                  aria-label="Delete thread"
                                >
                                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                                </Button>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}

            {!isReachingEnd && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => threads.setSize(threads.size + 1)}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      {t("thread.loading")}
                    </>
                  ) : (
                    t("thread.load_more")
                  )}
                </Button>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
