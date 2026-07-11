import { useEffect, useRef } from "react";
import { Trash2, Download, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/providers/LanguageProvider";

interface ImageContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onDelete: () => void;
  onDownload: () => void;
  onAIEdit?: () => void;
}

export function ImageContextMenu({
  x,
  y,
  onClose,
  onDelete,
  onDownload,
  onAIEdit,
}: ImageContextMenuProps) {
  const { t } = useLanguage();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [onClose]);

  const menuItems = [
    {
      icon: Wand2,
      label: t("canvas.ai_edit_image"),
      onClick: onAIEdit,
      highlight: true,
    },
    { divider: true },
    { icon: Download, label: t("canvas.download_image"), onClick: onDownload },
    { divider: true },
    {
      icon: Trash2,
      label: t("common.delete"),
      onClick: onDelete,
      danger: true,
    },
  ];

  return (
    <div
      ref={menuRef}
      className="animate-scale-in fixed z-50 min-w-[180px] rounded-lg border border-border bg-popover py-1.5 shadow-xl"
      style={{
        left: x,
        top: y,
      }}
    >
      {menuItems.map((item, index) => {
        if ((item as any).divider) {
          return (
            <div
              key={index}
              className="my-1 h-px bg-border"
            />
          );
        }

        const mItem = item as any;
        const Icon = mItem.icon!;
        return (
          <button
            key={mItem.label}
            onClick={mItem.onClick}
            className={cn(
              "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors",
              mItem.danger
                ? "text-destructive hover:bg-destructive/10"
                : mItem.highlight
                ? "hover:bg-primary/10 font-medium text-primary"
                : "text-foreground hover:bg-hover-bg"
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1 text-left">{mItem.label}</span>
            {mItem.shortcut && (
              <span className="text-xs text-muted-foreground">
                {mItem.shortcut}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
