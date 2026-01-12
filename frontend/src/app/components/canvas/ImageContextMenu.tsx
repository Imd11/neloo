import { useEffect, useRef } from "react";
import { Copy, Trash2, ArrowUpToLine, ArrowDownToLine, Download, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onBringToFront: () => void;
    onSendToBack: () => void;
    onDownload: () => void;
    onAIEdit?: () => void;
}

export function ImageContextMenu({
    x,
    y,
    onClose,
    onDelete,
    onDuplicate,
    onBringToFront,
    onSendToBack,
    onDownload,
    onAIEdit,
}: ImageContextMenuProps) {
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                onClose();
            }
        };

        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        document.addEventListener('keydown', handleEscape);

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('keydown', handleEscape);
        };
    }, [onClose]);

    const menuItems = [
        { icon: Wand2, label: "AI 改图", onClick: onAIEdit, highlight: true },
        { divider: true },
        { icon: Copy, label: "复制", shortcut: "⌘D", onClick: onDuplicate },
        { icon: Download, label: "下载", onClick: onDownload },
        { divider: true },
        { icon: ArrowUpToLine, label: "置于顶层", onClick: onBringToFront },
        { icon: ArrowDownToLine, label: "置于底层", onClick: onSendToBack },
        { divider: true },
        { icon: Trash2, label: "删除", shortcut: "⌫", onClick: onDelete, danger: true },
    ];

    return (
        <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] bg-popover border border-border rounded-lg shadow-xl py-1.5 animate-scale-in"
            style={{
                left: x,
                top: y,
            }}
        >
            {menuItems.map((item, index) => {
                if ((item as any).divider) {
                    return <div key={index} className="h-px bg-border my-1" />;
                }

                const mItem = item as any;
                const Icon = mItem.icon!;
                return (
                    <button
                        key={mItem.label}
                        onClick={mItem.onClick}
                        className={cn(
                            "w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors",
                            mItem.danger
                                ? "text-destructive hover:bg-destructive/10"
                                : mItem.highlight
                                    ? "text-primary font-medium hover:bg-primary/10"
                                    : "text-foreground hover:bg-hover-bg"
                        )}
                    >
                        <Icon className="w-4 h-4" />
                        <span className="flex-1 text-left">{mItem.label}</span>
                        {mItem.shortcut && (
                            <span className="text-xs text-muted-foreground">{mItem.shortcut}</span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
