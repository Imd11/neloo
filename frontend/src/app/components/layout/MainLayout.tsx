"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSidebar } from "@/app/context/SidebarContext";
import { AppSidebar, type AppSidebarProps } from "../AppSidebar";
import { TopBar } from "./TopBar";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
    children: React.ReactNode;
    sidebarProps?: AppSidebarProps;
}

export function MainLayout({ children, sidebarProps }: MainLayoutProps) {
    const { collapsed, width, setWidth, collapsedWidth, hideTopBar } = useSidebar();
    const [isDragging, setIsDragging] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const newWidth = e.clientX - rect.left;
        setWidth(newWidth);
    }, [setWidth]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
    }, []);

    // Attach/detach global mouse events when dragging
    useEffect(() => {
        if (isDragging) {
            document.addEventListener("mousemove", handleMouseMove);
            document.addEventListener("mouseup", handleMouseUp);
            return () => {
                document.removeEventListener("mousemove", handleMouseMove);
                document.removeEventListener("mouseup", handleMouseUp);
            };
        }
    }, [isDragging, handleMouseMove, handleMouseUp]);

    return (
        <div ref={containerRef} className="flex h-screen w-full bg-background overflow-hidden font-sans">
            {/* Sidebar with dynamic width */}
            <div
                className={cn(
                    "relative flex-shrink-0 transition-[width] duration-200 ease-out hidden md:block", // Hidden on mobile initially
                    // Mobile handling logic would go here if not using a Sheet/Drawer approach for mobile sidebar
                )}
                style={{ width: collapsed ? collapsedWidth : width }}
            >
                <AppSidebar {...sidebarProps} />

                {/* Resize handle - only show when not collapsed */}
                {!collapsed && (
                    <div
                        onMouseDown={handleMouseDown}
                        className={cn(
                            "absolute top-0 right-0 w-1 h-full cursor-col-resize z-10",
                            "hover:bg-primary/20 transition-colors",
                            isDragging && "bg-primary/30"
                        )}
                    />
                )}
            </div>

            {/* Main Content */}
            <div className="flex-1 flex flex-col min-w-0">
                {!hideTopBar && <TopBar />}
                <main className="flex-1 overflow-y-auto bg-background selection:bg-primary/10" style={{ scrollbarGutter: 'stable' }}>
                    {children}
                </main>
            </div>

            {/* Overlay to prevent selection while dragging */}
            {isDragging && (
                <div className="fixed inset-0 z-50 cursor-col-resize" />
            )}
        </div>
    );
}
