"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const STORAGE_KEY = "sidebar-width";
const DEFAULT_WIDTH = 240;
const MIN_WIDTH = 180;
const MAX_WIDTH = 400;
const COLLAPSED_WIDTH = 48;

interface SidebarContextType {
    collapsed: boolean;
    setCollapsed: (collapsed: boolean) => void;
    toggle: () => void;
    width: number;
    setWidth: (width: number) => void;
    minWidth: number;
    maxWidth: number;
    collapsedWidth: number;
    hideTopBar: boolean;
    setHideTopBar: (hide: boolean) => void;
    isMobile: boolean;
}

const SidebarContext = createContext<SidebarContextType | undefined>(undefined);

export function SidebarProvider({ children }: { children: ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);
    const [hideTopBar, setHideTopBar] = useState(false);
    const [width, setWidthState] = useState(() => {
        // Check if window is defined (client-side)
        if (typeof window !== "undefined") {
            const saved = localStorage.getItem(STORAGE_KEY);
            return saved ? Math.min(Math.max(parseInt(saved, 10), MIN_WIDTH), MAX_WIDTH) : DEFAULT_WIDTH;
        }
        return DEFAULT_WIDTH;
    });

    const toggle = () => setCollapsed(!collapsed);

    const setWidth = (newWidth: number) => {
        const clampedWidth = Math.min(Math.max(newWidth, MIN_WIDTH), MAX_WIDTH);
        setWidthState(clampedWidth);
        if (typeof window !== "undefined") {
            localStorage.setItem(STORAGE_KEY, String(clampedWidth));
        }
    };

    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => {
            setIsMobile(window.innerWidth < 768);
            if (window.innerWidth < 768) {
                setCollapsed(true);
            }
        };

        // Initial check
        checkMobile();

        // Event listener
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    return (
        <SidebarContext.Provider value={{
            collapsed,
            setCollapsed,
            toggle,
            width,
            setWidth,
            minWidth: MIN_WIDTH,
            maxWidth: MAX_WIDTH,
            collapsedWidth: COLLAPSED_WIDTH,
            hideTopBar,
            setHideTopBar,
            isMobile
        }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    const context = useContext(SidebarContext);
    if (!context) {
        throw new Error("useSidebar must be used within a SidebarProvider");
    }
    return context;
}
