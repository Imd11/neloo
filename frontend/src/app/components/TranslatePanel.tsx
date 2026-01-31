"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { ArrowLeftRight, ArrowLeft, Copy, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { getConfig } from "@/lib/config";
import { getSupabaseClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

// Supported languages
const LANGUAGES = [
    { code: "auto", label: "自动检测" },
    { code: "English", label: "English" },
    { code: "Chinese (Simplified)", label: "简体中文" },
    { code: "Chinese (Traditional)", label: "繁體中文" },
    { code: "Japanese", label: "日本語" },
    { code: "Korean", label: "한국어" },
    { code: "French", label: "Français" },
    { code: "German", label: "Deutsch" },
    { code: "Spanish", label: "Español" },
    { code: "Portuguese", label: "Português" },
    { code: "Russian", label: "Русский" },
    { code: "Arabic", label: "العربية" },
    { code: "Italian", label: "Italiano" },
    { code: "Dutch", label: "Nederlands" },
    { code: "Thai", label: "ไทย" },
    { code: "Vietnamese", label: "Tiếng Việt" },
];

// Translation styles
const STYLES = [
    { code: "general", label: "通用", description: "自然通顺的表达" },
    { code: "business_email", label: "商务邮件", description: "专业礼貌的用语" },
    { code: "academic", label: "学术论文", description: "严谨规范的表达" },
    { code: "technical", label: "技术文档", description: "准确简洁的语言" },
    { code: "social_media", label: "社交媒体", description: "轻松亲切的口语" },
];

// Rotating headlines for translation mode
const HEADLINES = [
    "让AI成为你的语言伙伴",
    "让世界听懂你的声音",
    "跨越语言的桥梁",
    "译出你心中所想",
    "智能翻译，让沟通无界",
    "语言的尽头，是理解的开始",
];

interface TranslatePanelProps {
    onBack: () => void;
}

export function TranslatePanel({ onBack }: TranslatePanelProps) {
    const [sourceText, setSourceText] = useState("");
    const [translatedText, setTranslatedText] = useState("");
    const [sourceLang, setSourceLang] = useState("auto");
    const [targetLang, setTargetLang] = useState("English");
    const [selectedStyle, setSelectedStyle] = useState("general");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [headline] = useState(() => HEADLINES[Math.floor(Math.random() * HEADLINES.length)]);

    const handleSwapLanguages = useCallback(() => {
        if (sourceLang !== "auto") {
            const temp = sourceLang;
            setSourceLang(targetLang);
            setTargetLang(temp);
            // Also swap the text
            const tempText = sourceText;
            setSourceText(translatedText);
            setTranslatedText(tempText);
        }
    }, [sourceLang, targetLang, sourceText, translatedText]);

    const handleTranslate = useCallback(async () => {
        if (!sourceText.trim()) {
            toast.error("请输入要翻译的文本");
            return;
        }

        setLoading(true);
        setTranslatedText("");

        try {
            const config = getConfig();
            const baseUrl = config?.deploymentUrl || "";

            // Get auth token
            const supabase = getSupabaseClient();
            const { data: { session } } = await supabase.auth.getSession();

            const response = await fetch(`${baseUrl}/api/translate`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(session?.access_token && { "Authorization": `Bearer ${session.access_token}` }),
                },
                body: JSON.stringify({
                    text: sourceText,
                    target_language: targetLang,
                    style: selectedStyle,
                }),
            });

            if (!response.ok) {
                throw new Error("翻译请求失败");
            }

            const data = await response.json();
            setTranslatedText(data.translation);
        } catch (error) {
            console.error("Translation error:", error);
            toast.error("翻译失败，请重试");
        } finally {
            setLoading(false);
        }
    }, [sourceText, targetLang, selectedStyle]);

    const handleCopy = useCallback(async () => {
        if (!translatedText) return;

        try {
            await navigator.clipboard.writeText(translatedText);
            setCopied(true);
            toast.success("已复制到剪贴板");
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error("复制失败");
        }
    }, [translatedText]);

    return (
        <div className="relative flex flex-col items-center justify-center h-full px-4 py-8 max-w-5xl mx-auto">
            {/* Back Button - Top Left */}
            <button
                onClick={onBack}
                className="absolute top-0 left-0 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                aria-label="返回"
            >
                <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Headline */}
            <h1
                className="text-3xl md:text-4xl font-medium text-foreground mb-8 text-center fade-in"
                style={{ fontFamily: "'Lora', 'Noto Serif SC', Georgia, serif" }}
            >
                {headline}
            </h1>

            {/* Language Selectors */}
            <div className="flex items-center gap-3 mb-6">
                <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LANGUAGES.map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                                {lang.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>

                <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleSwapLanguages}
                    disabled={sourceLang === "auto"}
                    className="hover:bg-muted"
                >
                    <ArrowLeftRight className="w-4 h-4" />
                </Button>

                <Select value={targetLang} onValueChange={setTargetLang}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LANGUAGES.filter(l => l.code !== "auto").map((lang) => (
                            <SelectItem key={lang.code} value={lang.code}>
                                {lang.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Text Panels */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full mb-6">
                {/* Source Panel */}
                <div className="relative">
                    <Textarea
                        value={sourceText}
                        onChange={(e) => setSourceText(e.target.value)}
                        placeholder="输入要翻译的文本..."
                        className="min-h-[240px] resize-none bg-muted/50 border-border rounded-xl p-4 text-base"
                    />
                </div>

                {/* Target Panel */}
                <div className="relative">
                    <Textarea
                        value={translatedText}
                        readOnly
                        placeholder="翻译结果"
                        className="min-h-[240px] resize-none bg-muted/50 border-border rounded-xl p-4 text-base"
                    />
                    {translatedText && (
                        <Button
                            variant="ghost"
                            size="icon"
                            onClick={handleCopy}
                            className="absolute bottom-3 right-3 hover:bg-background"
                        >
                            {copied ? (
                                <Check className="w-4 h-4 text-green-500" />
                            ) : (
                                <Copy className="w-4 h-4" />
                            )}
                        </Button>
                    )}
                </div>
            </div>

            {/* Style Cards */}
            <div className="flex flex-wrap justify-center gap-3 w-full mb-6">
                {STYLES.map((style) => (
                    <button
                        key={style.code}
                        onClick={() => setSelectedStyle(style.code)}
                        className={cn(
                            "flex flex-col items-center px-4 py-3 rounded-xl border transition-all",
                            "hover:bg-muted/50",
                            selectedStyle === style.code
                                ? "bg-muted border-foreground/30"
                                : "bg-background border-border"
                        )}
                    >
                        <span className="font-medium text-sm text-foreground">{style.label}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">{style.description}</span>
                    </button>
                ))}
            </div>

            {/* Translate Button */}
            <Button
                onClick={handleTranslate}
                disabled={loading || !sourceText.trim()}
                className="px-10 py-3 text-base bg-foreground text-background hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        翻译中...
                    </>
                ) : (
                    "翻译"
                )}
            </Button>
        </div>
    );
}

