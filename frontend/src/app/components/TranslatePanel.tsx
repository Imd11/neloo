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
import { useSidebar } from "@/app/context/SidebarContext";
import { useLanguage } from "@/providers/LanguageProvider";

// Supported languages
const LANGUAGES = [
    { code: "auto", label: "Auto detect" },
    { code: "English", label: "English" },
    { code: "Chinese (Simplified)", label: "Simplified Chinese" },
    { code: "Chinese (Traditional)", label: "Traditional Chinese" },
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
    { code: "general", label: "General", description: "Natural and fluent wording" },
    { code: "business_email", label: "Business", description: "Professional and polite wording" },
    { code: "academic", label: "Academic", description: "Rigorous academic wording" },
    { code: "technical", label: "Technical", description: "Accurate technical language" },
    { code: "social_media", label: "Social", description: "Relaxed conversational wording" },
];

// Rotating headlines for translation mode
const HEADLINES = [
    "Translate with your selected model",
    "Keep the meaning, change the language",
    "Make every sentence travel clearly",
];

interface TranslatePanelProps {
    onBack: () => void;
    modelId?: string | null;
}

export function TranslatePanel({ onBack, modelId }: TranslatePanelProps) {
    const { t } = useLanguage();
    const { collapsed, width, collapsedWidth } = useSidebar();
    const sidebarWidth = collapsed ? collapsedWidth : width;

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
            toast.error(t("translate.empty_error"));
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
                    source_language: sourceLang,
                    target_language: targetLang,
                    style: selectedStyle,
                    model_id: modelId,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || t("translate.request_failed"));
            }

            const data = await response.json();
            setTranslatedText(data.translation);
        } catch (error) {
            console.error("Translation error:", error);
            toast.error(t("translate.failed_error"));
        } finally {
            setLoading(false);
        }
    }, [sourceText, sourceLang, targetLang, selectedStyle, modelId, t]);

    const handleCopy = useCallback(async () => {
        if (!translatedText) return;

        try {
            await navigator.clipboard.writeText(translatedText);
            setCopied(true);
            toast.success(t("translate.copied"));
            setTimeout(() => setCopied(false), 2000);
        } catch {
            toast.error(t("translate.copy_failed"));
        }
    }, [translatedText, t]);

    return (
        <div className="relative flex flex-col items-center justify-center h-full px-4 py-8 max-w-5xl mx-auto">
            {/* Back Button - Fixed position, below TopBar and to the right of sidebar */}
            <button
                onClick={onBack}
                className="fixed top-14 p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors z-10"
                style={{ left: sidebarWidth + 16 }}
                aria-label={t("common.back")}
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
                        placeholder={t("translate.source_placeholder")}
                        className="min-h-[240px] resize-none bg-muted/50 border-border rounded-xl p-4 text-base"
                    />
                </div>

                {/* Target Panel */}
                <div className="relative">
                    <Textarea
                        value={translatedText}
                        readOnly
                        placeholder={t("translate.result_placeholder")}
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
                className="px-12 py-4 text-lg bg-foreground text-background hover:bg-foreground/90 dark:bg-foreground dark:text-background dark:hover:bg-foreground/90"
            >
                {loading ? (
                    <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {t("translate.translating")}
                    </>
                ) : (
                    t("translate.action")
                )}
            </Button>
        </div>
    );
}
