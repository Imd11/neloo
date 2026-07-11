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
import { buildBearerHeaders } from "@/lib/authHeaders";
import { cn } from "@/lib/utils";
import { useSidebar } from "@/app/context/SidebarContext";
import { useAuth } from "@/providers/AuthProvider";
import { useLanguage } from "@/providers/LanguageProvider";

const LANGUAGE_CODES = [
    "auto",
    "English",
    "Chinese (Simplified)",
    "Chinese (Traditional)",
    "Japanese",
    "Korean",
    "French",
    "German",
    "Spanish",
    "Portuguese",
    "Russian",
    "Arabic",
    "Italian",
    "Dutch",
    "Thai",
    "Vietnamese",
];

const STYLE_CODES = ["general", "business_email", "academic", "technical", "social_media"];
const HEADLINE_KEYS = ["translate.headline_1", "translate.headline_2", "translate.headline_3"];

interface TranslatePanelProps {
    onBack: () => void;
    modelId?: string | null;
}

export function TranslatePanel({ onBack, modelId }: TranslatePanelProps) {
    const { t } = useLanguage();
    const { session, loading: authLoading } = useAuth();
    const { collapsed, width, collapsedWidth } = useSidebar();
    const sidebarWidth = collapsed ? collapsedWidth : width;

    const [sourceText, setSourceText] = useState("");
    const [translatedText, setTranslatedText] = useState("");
    const [sourceLang, setSourceLang] = useState("auto");
    const [targetLang, setTargetLang] = useState("English");
    const [selectedStyle, setSelectedStyle] = useState("general");
    const [loading, setLoading] = useState(false);
    const [copied, setCopied] = useState(false);
    const [headlineKey] = useState(() => HEADLINE_KEYS[Math.floor(Math.random() * HEADLINE_KEYS.length)]);

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
        if (authLoading || !session.access_token) return;

        setLoading(true);
        setTranslatedText("");

        try {
            const config = getConfig();
            const baseUrl = config?.deploymentUrl || "";

            const response = await fetch(`${baseUrl}/api/translate`, {
                method: "POST",
                headers: buildBearerHeaders(session.access_token),
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
    }, [sourceText, sourceLang, targetLang, selectedStyle, modelId, t, authLoading, session.access_token]);

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
                {t(headlineKey)}
            </h1>

            {/* Language Selectors */}
            <div className="flex items-center gap-3 mb-6">
                <Select value={sourceLang} onValueChange={setSourceLang}>
                    <SelectTrigger className="w-[160px]">
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {LANGUAGE_CODES.map((code) => (
                            <SelectItem key={code} value={code}>
                                {t(`translate.languages.${code}`)}
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
                        {LANGUAGE_CODES.filter((code) => code !== "auto").map((code) => (
                            <SelectItem key={code} value={code}>
                                {t(`translate.languages.${code}`)}
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
                {STYLE_CODES.map((style) => (
                    <button
                        key={style}
                        onClick={() => setSelectedStyle(style)}
                        className={cn(
                            "flex flex-col items-center px-4 py-3 rounded-xl border transition-all",
                            "hover:bg-muted/50",
                            selectedStyle === style
                                ? "bg-muted border-foreground/30"
                                : "bg-background border-border"
                        )}
                    >
                        <span className="font-medium text-sm text-foreground">{t(`translate.styles.${style}.label`)}</span>
                        <span className="text-xs text-muted-foreground mt-0.5">{t(`translate.styles.${style}.description`)}</span>
                    </button>
                ))}
            </div>

            {/* Translate Button */}
            <Button
                onClick={handleTranslate}
                disabled={loading || authLoading || !session.access_token || !sourceText.trim()}
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
