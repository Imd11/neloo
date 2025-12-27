"use client";

import React, { useMemo, useCallback } from "react";
import { CheckCircle, Circle, Clock } from "lucide-react";
import type { TodoItem } from "@/app/types/types";

export function TodoList({ todos }: { todos: TodoItem[] }) {
  const getStatusIcon = useCallback((status: TodoItem["status"]) => {
    switch (status) {
      case "completed":
        return (
          <CheckCircle
            size={14}
            className="mt-0.5 flex-shrink-0 text-emerald-500 dark:text-emerald-400"
          />
        );
      case "in_progress":
        return (
          <Clock
            size={14}
            className="mt-0.5 flex-shrink-0 text-amber-500 dark:text-amber-400"
          />
        );
      default:
        return (
          <Circle
            size={12}
            className="mt-0.5 flex-shrink-0 text-muted-foreground/60"
          />
        );
    }
  }, []);

  const groupedTodos = useMemo(() => {
    return {
      in_progress: todos.filter((t) => t.status === "in_progress"),
      pending: todos.filter((t) => t.status === "pending"),
      completed: todos.filter((t) => t.status === "completed"),
    };
  }, [todos]);

  const groupedLabels: Record<string, string> = {
    in_progress: "In Progress",
    pending: "Pending",
    completed: "Completed",
  };

  if (!todos.length) return null;

  return (
    <div className="space-y-4">
      {(Object.entries(groupedTodos) as [string, TodoItem[]][]).map(
        ([status, statusTodos]) => {
          if (statusTodos.length === 0) return null;
          return (
            <div key={status}>
              <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {groupedLabels[status]}
              </h3>
              <div className="space-y-1.5">
                {statusTodos.map((todo, index) => (
                  <div
                    key={`${status}_${todo.id}_${index}`}
                    className="flex items-start gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent/30"
                  >
                    {getStatusIcon(todo.status)}
                    <span className="flex-1 break-words leading-relaxed text-foreground/90">
                      {todo.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        }
      )}
    </div>
  );
}
