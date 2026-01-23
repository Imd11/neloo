"use client";

import { useMemo } from "react";
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

    // Get one random headline on mount (stable across re-renders)
    const headline = useMemo(() => {
        const randomIndex = Math.floor(Math.random() * headlines.length);
        return headlines[randomIndex].replace("{name}", userName);
    }, [userName]);

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
