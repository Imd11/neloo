"use client";

import { useState, useEffect, useMemo } from "react";
import { Search, MessageSquarePlus, X, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  return format(date, "yyyy/MM/dd");
}

export function SearchDialog({
  open,
  onOpenChange,
  onThreadSelect,
}: SearchDialogProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const threads = useThreads({ limit: 100 });

  const flattened = useMemo(() => {
    return threads.data?.flat() ?? [];
  }, [threads.data]);

  // Filter and group results
  const filteredResults = useMemo(() => {
    interface SearchResult {
      id: string;
      title: string;
      subtitle?: string;
      date?: string;
      type: "new" | "history";
      status?: ThreadItem["status"];
    }

    const results: SearchResult[] = [];

    // Always show "新建对话" option at the top
    results.push({ id: "new", title: "新建对话", type: "new" });

    // Filter history based on query
    const filtered = flattened.filter(item =>
      item.title.toLowerCase().includes(query.toLowerCase()) ||
      (item.description && item.description.toLowerCase().includes(query.toLowerCase()))
    );

    filtered.forEach(item => {
      results.push({
        id: item.id,
        title: item.title,
        subtitle: item.description,
        date: formatTime(item.updatedAt),
        type: "history",
        status: item.status,
      });
    });

    return results;
  }, [query, flattened]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredResults.length]);

  // Reset query when dialog closes
  useEffect(() => {
    if (!open) {
      setQuery("");
      setSelectedIndex(0);
    }
  }, [open]);

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          setSelectedIndex(i => Math.min(i + 1, filteredResults.length - 1));
          break;
        case "ArrowUp":
          e.preventDefault();
          setSelectedIndex(i => Math.max(i - 1, 0));
          break;
        case "Enter":
          e.preventDefault();
          const selected = filteredResults[selectedIndex];
          if (selected) {
            handleSelect(selected.id, selected.type);
          }
          break;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, filteredResults, selectedIndex]);

  const handleSelect = (id: string, type: string) => {
    if (type === "new") {
      // Handle new conversation
      onOpenChange(false);
    } else {
      onThreadSelect(id);
      onOpenChange(false);
    }
  };

  // Group results by type
  const groupedResults = useMemo(() => {
    const groups: { label: string; items: typeof filteredResults }[] = [];

    // First, the "new" type item
    const newItem = filteredResults.find(r => r.type === "new");
    if (newItem) {
      groups.push({ label: "", items: [newItem] });
    }

    // Then group history
    const historyItems = filteredResults.filter(r => r.type === "history");
    if (historyItems.length > 0) {
      groups.push({ label: "更早的", items: historyItems });
    }

    return groups;
  }, [filteredResults]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 gap-0 overflow-hidden bg-popover border-border [&>button:last-child]:hidden">
        {/* Search Input */}
        <div className="flex items-center px-4 border-b border-border">
          <Search className="w-5 h-5 text-muted-foreground flex-shrink-0" />
          <input
            type="text"
            placeholder="搜索聊天..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="flex-1 px-3 py-4 text-base bg-transparent text-foreground placeholder:text-muted-foreground focus:outline-none"
            autoFocus
          />
          <button
            onClick={() => onOpenChange(false)}
            className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results List */}
        <ScrollArea className="max-h-[400px]">
          {threads.isLoading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}

          {!threads.isLoading && (
            <div className="py-2">
              {groupedResults.map((group, groupIndex) => {
                // Calculate the starting index for this group
                let startIndex = 0;
                for (let i = 0; i < groupIndex; i++) {
                  startIndex += groupedResults[i].items.length;
                }

                return (
                  <div key={groupIndex}>
                    {group.label && (
                      <div className="px-4 py-2 text-xs text-muted-foreground">
                        {group.label}
                      </div>
                    )}
                    {group.items.map((item, itemIndex) => {
                      const absoluteIndex = startIndex + itemIndex;
                      const isSelected = absoluteIndex === selectedIndex;

                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelect(item.id, item.type)}
                          onMouseEnter={() => setSelectedIndex(absoluteIndex)}
                          className={cn(
                            "flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors",
                            isSelected ? "bg-accent" : "hover:bg-accent/50"
                          )}
                        >
                          {/* Icon */}
                          <div className="flex-shrink-0 mt-0.5">
                            {item.type === "new" ? (
                              <MessageSquarePlus className="w-5 h-5 text-muted-foreground" />
                            ) : (
                              <div className={cn(
                                "w-5 h-5 rounded-full border-2 flex items-center justify-center",
                                item.status ? "" : "border-muted-foreground/50"
                              )}>
                                {item.status && (
                                  <div className={cn("w-2 h-2 rounded-full", getThreadColor(item.status))} />
                                )}
                              </div>
                            )}
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-foreground truncate">{item.title}</div>
                            {item.subtitle && (
                              <div className="text-xs text-muted-foreground truncate mt-0.5">
                                {item.subtitle}
                              </div>
                            )}
                          </div>

                          {/* Date */}
                          {item.date && (
                            <div className="flex-shrink-0 text-xs text-muted-foreground">
                              {item.date}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {/* Empty state */}
              {filteredResults.length === 1 && filteredResults[0].type === "new" && query && (
                <div className="px-4 py-6 text-center text-sm text-muted-foreground">
                  未找到匹配的聊天记录
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
