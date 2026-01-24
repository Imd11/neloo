"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";

// Headlines with {name} placeholder for personalization
const headlines = [
    "你好{name}，我能为你做什么？",
    "你好{name}，准备好开始了吗？",
    "{name}，今天想要完成什么？",
    "你好{name}，有什么可以帮助你的？",
    "{name}，让我们一起创造吧",
    "你好{name}，开始你的下一个项目",
    "{name}，需要灵感吗？",
    "你好{name}，让想法变成现实",
    "{name}，探索无限可能",
    "你好{name}，你的创意助手已就绪",
    "{name}，有问题尽管问",
    "你好{name}，一起解决难题",
];

interface RotatingHeadlineProps {
    className?: string;
}

export function RotatingHeadline({ className }: RotatingHeadlineProps) {
  const { user } = useAuth();

    // Extract username: prefer display_name from user_metadata, then email prefix
    const userName = useMemo(() => {
        if (user?.user_metadata?.display_name) {
            return user.user_metadata.display_name as string;
        }
        if (user?.email) {
            return user.email.split("@")[0];
        }
        return "朋友";
    }, [user?.user_metadata?.display_name, user?.email]);

  const storageKey = useMemo(() => {
    const id = user?.id ?? userName;
    return `meloo:headlineIndex:${id}`;
  }, [user?.id, userName]);

  const [headlineIndex, setHeadlineIndex] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      const parsed = stored ? Number(stored) : NaN;
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < headlines.length) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return Math.floor(Math.random() * headlines.length);
  });

  // Keep the headline stable across route navigations (same session/tab).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      const parsed = stored ? Number(stored) : NaN;
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < headlines.length) {
        setHeadlineIndex(parsed);
        return;
      }
      const next = Math.floor(Math.random() * headlines.length);
      window.sessionStorage.setItem(storageKey, String(next));
      setHeadlineIndex(next);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const headline = useMemo(() => {
    const safeIndex =
      headlineIndex >= 0 && headlineIndex < headlines.length ? headlineIndex : 0;
    return headlines[safeIndex].replace("{name}", userName);
  }, [headlineIndex, userName]);

    return (
        <h1
            className={cn(
                "text-3xl md:text-4xl font-medium text-foreground text-center",
                "fade-in",
                className
            )}
            style={{ fontFamily: "'Lora', 'Noto Serif SC', Georgia, serif" }}
        >
            {headline}
        </h1>
    );
}
