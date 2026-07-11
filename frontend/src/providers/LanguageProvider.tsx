"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

// 支持的语言列表
export const SUPPORTED_LOCALES = ["zh-CN", "zh-TW", "en", "ja"] as const;
export type Locale = (typeof SUPPORTED_LOCALES)[number];

// 语言显示名称
export const LOCALE_NAMES: Record<Locale, string> = {
    "zh-CN": "简体中文",
    "zh-TW": "繁體中文",
    "en": "English",
    "ja": "日本語",
};

type MessageValue = string | { [key: string]: MessageValue };
type Messages = Record<string, MessageValue>;

interface LanguageContextType {
    locale: Locale;
    setLocale: (locale: Locale) => void;
    t: (key: string, params?: Record<string, string | number>) => string;
    isLoading: boolean;
}

const LanguageContext = createContext<LanguageContextType | null>(null);

// 本地存储 key
const LOCALE_STORAGE_KEY = "preferred-locale";

// 加载翻译文件
async function loadMessages(locale: Locale): Promise<Messages> {
    try {
        const messages = await import(`@/locales/${locale}.json`);
        return messages.default;
    } catch (error) {
        console.error(`Failed to load locale ${locale}:`, error);
        // 回退到简体中文
        const fallback = await import("@/locales/zh-CN.json");
        return fallback.default;
    }
}

interface LanguageProviderProps {
    children: ReactNode;
    defaultLocale?: Locale;
}

export function LanguageProvider({ children, defaultLocale = "zh-CN" }: LanguageProviderProps) {
    const [locale, setLocaleState] = useState<Locale>(() => {
        if (typeof window === "undefined") return defaultLocale;
        const savedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
        return savedLocale && SUPPORTED_LOCALES.includes(savedLocale) ? savedLocale : defaultLocale;
    });
    const [messages, setMessages] = useState<Messages>({});
    const [isLoading, setIsLoading] = useState(true);

    // 初始化：从本地存储读取语言设置
    useEffect(() => {
        const savedLocale = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null;
        if (savedLocale && SUPPORTED_LOCALES.includes(savedLocale)) {
            setLocaleState(savedLocale);
        }
    }, []);

    // 加载翻译文件
    useEffect(() => {
        setIsLoading(true);
        loadMessages(locale).then((msgs) => {
            setMessages(msgs);
            setIsLoading(false);
        });
    }, [locale]);

    // 切换语言
    const setLocale = useCallback((newLocale: Locale) => {
        setLocaleState(newLocale);
        localStorage.setItem(LOCALE_STORAGE_KEY, newLocale);
    }, []);

    // 翻译函数
    const t = useCallback(
        (key: string, params?: Record<string, string | number>): string => {
            // 支持点号分隔的嵌套 key，如 "settings.title"
            const keys = key.split(".");
            let value: unknown = messages;

            for (const k of keys) {
                if (value && typeof value === "object" && k in value) {
                    value = (value as Record<string, unknown>)[k];
                } else {
                    // 找不到翻译，返回 key
                    return key;
                }
            }

            if (typeof value !== "string") {
                return key;
            }

            // 替换参数 {param}
            if (params) {
                return value.replace(/\{(\w+)\}/g, (_, paramKey) => {
                    return params[paramKey]?.toString() ?? `{${paramKey}}`;
                });
            }

            return value;
        },
        [messages]
    );

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t, isLoading }}>
            {children}
        </LanguageContext.Provider>
    );
}

// Hook: 使用语言 context
export function useLanguage() {
    const context = useContext(LanguageContext);
    if (!context) {
        throw new Error("useLanguage must be used within a LanguageProvider");
    }
    return context;
}

// Hook: 安全版本，如果没有 Provider 也不会报错
export function useLanguageSafe() {
    const context = useContext(LanguageContext);

    // 默认的 t 函数，直接返回 key
    const defaultT = (key: string): string => key;

    if (!context) {
        return {
            locale: "zh-CN" as Locale,
            setLocale: () => { },
            t: defaultT,
            isLoading: false,
        };
    }

    return context;
}
