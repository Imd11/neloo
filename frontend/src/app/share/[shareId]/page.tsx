"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { getConfig } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { MessageSquare, ArrowRight, Loader2 } from "lucide-react";

interface SharedMessage {
    type: string;
    content: string | { type: string; text?: string }[];
}

interface SharedConversation {
    title: string;
    messages: SharedMessage[];
    shared_at: string;
    target_ai_message_id?: string | null;
}

function extractMessageContent(msg: SharedMessage): string {
    if (typeof msg.content === "string") {
        return msg.content;
    }
    if (Array.isArray(msg.content)) {
        return msg.content
            .filter((block) => block.type === "text" && block.text)
            .map((block) => block.text)
            .join("\n");
    }
    return "";
}

export default function SharePage() {
    const params = useParams();
    const shareId = params.shareId as string;

    const [conversation, setConversation] = useState<SharedConversation | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function loadConversation() {
            try {
                const config = getConfig();
                if (!config) {
                    throw new Error("配置加载失败");
                }
                const response = await fetch(
                    `${config.deploymentUrl}/api/share/${shareId}`
                );

                if (!response.ok) {
                    const data = await response.json().catch(() => ({}));
                    throw new Error(data.detail || "加载对话失败");
                }

                const data = await response.json();
                setConversation(data);
            } catch (err) {
                setError(err instanceof Error ? err.message : "加载失败");
            } finally {
                setLoading(false);
            }
        }

        if (shareId) {
            loadConversation();
        }
    }, [shareId]);

    // Loading state
    if (loading) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <header className="flex h-14 items-center justify-between border-b border-border px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <span>Neloo</span>
                    </Link>
                    <Button asChild>
                        <Link href="/">进入应用</Link>
                    </Button>
                </header>
                <div className="flex flex-1 items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
            </div>
        );
    }

    // Error state
    if (error) {
        return (
            <div className="flex min-h-screen flex-col bg-background">
                <header className="flex h-14 items-center justify-between border-b border-border px-6">
                    <Link href="/" className="flex items-center gap-2 font-semibold">
                        <MessageSquare className="h-5 w-5 text-primary" />
                        <span>Neloo</span>
                    </Link>
                    <Button asChild>
                        <Link href="/">进入应用</Link>
                    </Button>
                </header>
                <div className="flex flex-1 flex-col items-center justify-center gap-4">
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-foreground">无法加载对话</h1>
                        <p className="mt-2 text-muted-foreground">{error}</p>
                    </div>
                    <Button asChild>
                        <Link href="/">返回首页</Link>
                    </Button>
                </div>
            </div>
        );
    }

    // Success state
    return (
        <div className="flex min-h-screen flex-col bg-background">
            {/* Header */}
            <header className="flex h-14 items-center justify-between border-b border-border px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold">
                    <MessageSquare className="h-5 w-5 text-primary" />
                    <span>Neloo</span>
                </Link>
                <Button asChild>
                    <Link href="/">进入应用</Link>
                </Button>
            </header>

            {/* Content */}
            <main className="flex-1 overflow-auto">
                <div className="mx-auto max-w-3xl px-4 py-8">
                    {/* Title section */}
                    <div className="mb-8 border-b border-border pb-6">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <span>{conversation!.target_ai_message_id ? "📌 分享的消息" : "📤 分享的对话"}</span>
                            <span>•</span>
                            <span>
                                {new Date(conversation!.shared_at).toLocaleDateString("zh-CN", {
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                })}
                            </span>
                        </div>
                        <h1 className="mt-2 text-2xl font-bold text-foreground">
                            {conversation!.title}
                        </h1>
                    </div>

                    {/* Messages */}
                    <div className="space-y-6">
                        {conversation!.messages.map((msg, index) => {
                                const content = extractMessageContent(msg);
                                if (!content) return null;

                                const isUser = msg.type === "human";

                                return (
                                    <div
                                        key={index}
                                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                                    >
                                        <div
                                            className={`max-w-[85%] ${isUser
                                                ? "rounded-xl rounded-br-none border border-border bg-muted px-4 py-3"
                                                : "text-foreground"
                                                }`}
                                        >
                                            {isUser ? (
                                                <p className="whitespace-pre-wrap text-sm">{content}</p>
                                            ) : (
                                                <MarkdownContent content={content} />
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                    </div>

                    {/* CTA */}
                    <div className="mt-12 flex justify-center border-t border-border pt-8">
                        <Button size="lg" asChild>
                            <Link href="/" className="flex items-center gap-2">
                                开始自己的对话
                                <ArrowRight className="h-4 w-4" />
                            </Link>
                        </Button>
                    </div>
                </div>
            </main>
        </div>
    );
}
