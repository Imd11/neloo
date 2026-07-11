"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

// Headlines with {name} placeholder for personalization
const headlineKeys = [
    "home.headline_1",
    "home.headline_2",
    "home.headline_3",
    "home.headline_4",
    "home.headline_5",
    "home.headline_6",
    "home.headline_7",
    "home.headline_8",
    "home.headline_9",
    "home.headline_10",
    "home.headline_11",
    "home.headline_12",
];

interface RotatingHeadlineProps {
    className?: string;
}

export function RotatingHeadline({ className }: RotatingHeadlineProps) {
  const { user } = useAuth();
  const { t } = useLanguage();

    // Extract username: prefer display_name from user_metadata, then email prefix
    const userName = useMemo(() => {
        if (user?.user_metadata?.display_name) {
            return user.user_metadata.display_name as string;
        }
        if (user?.email) {
            return user.email.split("@")[0];
        }
        return t("home.guest_name");
    }, [t, user?.user_metadata?.display_name, user?.email]);

  const storageKey = useMemo(() => {
    const id = user?.id ?? userName;
    return `meloo:headlineIndex:${id}`;
  }, [user?.id, userName]);

  const [headlineIndex, setHeadlineIndex] = useState<number>(() => {
    if (typeof window === "undefined") return 0;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      const parsed = stored ? Number(stored) : NaN;
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < headlineKeys.length) {
        return parsed;
      }
    } catch {
      // ignore
    }
    return Math.floor(Math.random() * headlineKeys.length);
  });

  // Keep the headline stable across route navigations (same session/tab).
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.sessionStorage.getItem(storageKey);
      const parsed = stored ? Number(stored) : NaN;
      if (!Number.isNaN(parsed) && parsed >= 0 && parsed < headlineKeys.length) {
        setHeadlineIndex(parsed);
        return;
      }
      const next = Math.floor(Math.random() * headlineKeys.length);
      window.sessionStorage.setItem(storageKey, String(next));
      setHeadlineIndex(next);
    } catch {
      // ignore
    }
  }, [storageKey]);

  const headline = useMemo(() => {
    const safeIndex =
      headlineIndex >= 0 && headlineIndex < headlineKeys.length ? headlineIndex : 0;
    return t(headlineKeys[safeIndex], { name: userName });
  }, [headlineIndex, t, userName]);

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
