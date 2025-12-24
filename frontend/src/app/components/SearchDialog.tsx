"use client";

import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, MessageSquare, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import type { ThreadItem } from "@/app/hooks/useThreads";
import { useThreads } from "@/app/hooks/useThreads";

interface SearchDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onThreadSelect: (threadId: string) => void;
}

const STATUS_COLORS: Record<ThreadItem["status"], string> = {
  idle: "bg-green-500",
  busy: "bg-blue-500",
  interrupted: "bg-orange-500",
  error: "bg-red-600",
};

function getThreadColor(status: ThreadItem["status"]): string {
  return STATUS_COLORS[status] ?? "bg-gray-400";
}

function formatTime(date: Date): string {
  return format(date, "yyyy-MM-dd HH:mm");
}

export function SearchDialog({
  open,
  onOpenChange,
  onThreadSelect,
}: SearchDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");

  const threads = useThreads({ limit: 100 });

  const flattened = useMemo(() => {
    return threads.data?.flat() ?? [];
  }, [threads.data]);

  // Filter threads based on search query
  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) {
      return flattened;
    }

    const query = searchQuery.toLowerCase();
    return flattened.filter(
      (thread) =>
        thread.title.toLowerCase().includes(query) ||
        thread.description?.toLowerCase().includes(query)
    );
  }, [flattened, searchQuery]);

  // Reset search when dialog closes
  useEffect(() => {
    if (!open) {
      setSearchQuery("");
    }
  }, [open]);

  const handleSelect = (threadId: string) => {
    onThreadSelect(threadId);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>搜索任务</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="搜索任务标题或描述..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
            autoFocus
          />
        </div>

        <ScrollArea className="h-[400px]">
          {threads.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!threads.isLoading && filteredThreads.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <MessageSquare className="mb-2 h-12 w-12 text-gray-300" />
              <p className="text-sm text-muted-foreground">
                {searchQuery ? "未找到匹配的任务" : "暂无任务"}
              </p>
            </div>
          )}

          {!threads.isLoading && filteredThreads.length > 0 && (
            <div className="flex flex-col gap-1 p-1">
              {filteredThreads.map((thread) => (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => handleSelect(thread.id)}
                  className={cn(
                    "w-full cursor-pointer rounded-lg px-3 py-3 text-left transition-colors duration-200",
                    "hover:bg-accent",
                    "border border-transparent bg-transparent"
                  )}
                >
                  <div className="flex items-center justify-between">
                    <h3 className="truncate text-sm font-semibold">
                      {thread.title}
                    </h3>
                    <span className="ml-2 flex-shrink-0 text-xs text-muted-foreground">
                      {formatTime(thread.updatedAt)}
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <p className="flex-1 truncate text-sm text-muted-foreground">
                      {thread.description}
                    </p>
                    <div className="ml-2 flex-shrink-0">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          getThreadColor(thread.status)
                        )}
                      />
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
