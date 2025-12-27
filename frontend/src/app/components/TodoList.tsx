"use client";

import React from "react";
import type { TodoItem } from "@/app/types/types";

export function TodoList({ todos }: { todos: TodoItem[] }) {
  if (!todos.length) return null;
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="mb-2 text-sm font-medium">Tasks</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {todos.map((t) => (
          <li key={t.id} className="flex items-start gap-2">
            <span className="mt-1 inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground/60" />
            <span>{t.content}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
