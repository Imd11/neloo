"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ContextMenuProps {
    trigger: React.ReactNode;
    children: React.ReactNode;
    disabled?: boolean;
    fixedPosition?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function ContextMenu({ trigger, children, disabled, fixedPosition = false, onOpenChange }: ContextMenuProps) {
    const [visible, setVisible] = useState(false);
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const menuRef = useRef<HTMLDivElement>(null);
    const triggerRef = useRef<HTMLDivElement>(null);

    const handleClick = (e: React.MouseEvent) => {
        if (disabled) return;
        e.preventDefault();
        e.stopPropagation();
        setVisible(true);
        onOpenChange?.(true);

        if (fixedPosition) {
            const triggerElement = e.currentTarget.firstChild as HTMLElement;
            if (triggerElement) {
                const rect = triggerElement.getBoundingClientRect();
                setPosition({
                    x: rect.right + 8,
                    y: rect.top
                });
            } else {
                setPosition({ x: e.clientX, y: e.clientY });
            }
        } else {
            setPosition({ x: e.clientX, y: e.clientY });
        }
    };

    useEffect(() => {
        if (disabled) {
            setVisible(false);
            onOpenChange?.(false);
        }
    }, [disabled, onOpenChange]);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setVisible(false);
                onOpenChange?.(false);
            }
        };

        const handleScroll = () => {
            if (visible) {
                setVisible(false);
                onOpenChange?.(false);
            }
        }

        if (visible) {
            document.addEventListener("mousedown", handleClickOutside);
            window.addEventListener("scroll", handleScroll, true);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [visible, onOpenChange]);

    return (
        <div ref={triggerRef} onClick={handleClick} className="contents">
            {trigger}
            {visible && typeof document !== 'undefined' && createPortal(
                <div
                    ref={menuRef}
                    className="fixed z-50 min-w-[160px] overflow-hidden rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md animate-in fade-in zoom-in-95 duration-100"
                    style={{ top: position.y, left: position.x }}
                >
                    {children}
                </div>,
                document.body
            )}
        </div>
    );
}

export function ContextMenuItem({
    children,
    onClick,
    className
}: {
    children: React.ReactNode;
    onClick?: () => void;
    className?: string
}) {
    return (
        <div
            onClick={(e) => {
                e.stopPropagation();
                onClick?.();
            }}
            className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none hover:bg-accent hover:text-accent-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50 ${className ?? ""}`}
        >
            {children}
        </div>
    );
}
