"use client";

import {
  useState,
  useRef,
  useEffect,
  useMemo,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Plus, Mic, ArrowUp, X, Square, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature, localizeFeature } from "@/data/featureTemplates";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLanguage } from "@/providers/LanguageProvider";

interface ChatPromptInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  onSubmit?: (value: string) => void;
  className?: string;
  // Feature mode (like web dev)
  selectedFeature?: Feature | null;
  onClearFeature?: () => void;
  // Loading state
  isLoading?: boolean;
  onStop?: () => void;
  // File upload
  onUploadClick?: () => void;
  onLibraryClick?: () => void;
  hasFiles?: boolean;
  onOpenFilePanel?: () => void;
  // Disable input
  disabled?: boolean;
  // Web Dev mode (legacy support)
  webDevMode?: boolean;
  isModeLocked?: boolean;
  onEnableWebDevMode?: () => void;
  // Google Drive
  onGoogleDriveClick?: () => void;
}

export interface ChatPromptInputRef {
  focus: () => void;
  clear: () => void;
}

export const ChatPromptInput = forwardRef<
  ChatPromptInputRef,
  ChatPromptInputProps
>(
  (
    {
      placeholder = "",
      value: controlledValue,
      onChange,
      onSubmit,
      className,
      selectedFeature,
      onClearFeature,
      isLoading = false,
      onStop,
      onUploadClick,
      onLibraryClick,
      hasFiles = false,
      onOpenFilePanel,
      disabled = false,
      webDevMode = false,
      isModeLocked = false,
      onEnableWebDevMode,
      onGoogleDriveClick,
    },
    ref
  ) => {
    const { t } = useLanguage();
    const localizedFeature = useMemo(
      () => (selectedFeature ? localizeFeature(selectedFeature, t) : null),
      [selectedFeature, t]
    );
    const [internalValue, setInternalValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Use controlled or uncontrolled value
    const value =
      controlledValue !== undefined ? controlledValue : internalValue;
    const setValue = (v: string) => {
      if (controlledValue !== undefined && onChange) {
        onChange(v);
      } else {
        setInternalValue(v);
      }
    };

    // Expose methods
    useImperativeHandle(ref, () => ({
      focus: () => textareaRef.current?.focus(),
      clear: () => setValue(""),
    }));

    // Auto-resize textarea
    useEffect(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        textareaRef.current.style.height = `${Math.min(
          textareaRef.current.scrollHeight,
          200
        )}px`;
      }
    }, [value]);

    const handleSubmit = () => {
      if (value.trim() && onSubmit && !isLoading && !disabled) {
        onSubmit(value.trim());
        setValue("");
      }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    // Determine placeholder based on mode
    const effectivePlaceholder =
      localizedFeature?.placeholder ||
      (webDevMode
        ? t("chat.webdev_placeholder")
        : placeholder || t("chat.default_placeholder"));

    return (
      <div
        className={cn(
          "relative w-full",
          "rounded-2xl bg-input-bg",
          "border border-border",
          "transition-all duration-200",
          isFocused && "border-ring shadow-glow",
          className
        )}
      >
        {/* Top row: Feature tag + Textarea */}
        <div className="flex items-start gap-2 px-4 pb-0 pt-3">
          {/* Web Dev Mode Tag (legacy) */}
          {webDevMode && (
            <div
              className={cn(
                "group relative mt-1 flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150",
                "hover:ring-current/25 hover:shadow-xs hover:ring-1",
                "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-full before:bg-foreground/10 before:opacity-0 before:transition-opacity before:duration-150 before:content-['']",
                "hover:before:opacity-100",
                "bg-blue-500/15 text-blue-600 dark:text-blue-400"
              )}
            >
              <span className="relative z-10">{t("chat.webdev_mode")}</span>
              {!isModeLocked && (
                <button
                  type="button"
                  onClick={onClearFeature}
                  className="hover:bg-current/45 relative z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-all duration-150 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
                  aria-label={t("chat.clear_selected_feature")}
                >
                  <X className="h-2.5 w-2.5" />
                </button>
              )}
            </div>
          )}

          {/* Selected Feature Tag (AnyAI style) */}
          {localizedFeature && !webDevMode && (
            <div
              className={cn(
                "group relative mt-1 flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150",
                "hover:ring-current/25 hover:shadow-xs hover:ring-1",
                "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-full before:bg-foreground/10 before:opacity-0 before:transition-opacity before:duration-150 before:content-['']",
                "hover:before:opacity-100",
                localizedFeature.id === "image" &&
                  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
                localizedFeature.id === "web-dev" &&
                  "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                localizedFeature.id === "slides" &&
                  "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                localizedFeature.id === "resume" &&
                  "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                localizedFeature.id === "prompt-optimize" &&
                  "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                localizedFeature.id === "fortune" &&
                  "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                localizedFeature.id === "deai" &&
                  "bg-rose-500/15 text-rose-600 dark:text-rose-400"
              )}
            >
              <span className="relative z-10">{localizedFeature.title}</span>
              <button
                onClick={onClearFeature}
                type="button"
                className="hover:bg-current/45 relative z-10 flex h-4 w-4 cursor-pointer items-center justify-center rounded-full transition-all duration-150 hover:scale-125 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 active:scale-95"
                aria-label={t("chat.clear_selected_feature")}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </div>
          )}

          {/* Textarea */}
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            onKeyDown={handleKeyDown}
            disabled={disabled || isLoading}
            placeholder={isLoading ? "Running..." : effectivePlaceholder}
            className="max-h-[200px] min-h-[40px] min-w-0 flex-1 resize-none border-none bg-transparent text-base leading-7 text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
            rows={1}
          />
        </div>

        {/* Bottom row: Actions */}
        <div className="flex items-center justify-between gap-2 px-3 pb-3 pt-1">
          {/* Left: Plus menu + File actions */}
          <div className="flex items-center gap-1">
            {/* Plus Button with dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <Plus className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-56"
              >
                {onGoogleDriveClick && (
                  <DropdownMenuItem onClick={onGoogleDriveClick}>
                    <svg
                      className="mr-2 h-4 w-4"
                      viewBox="0 0 87.3 78"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M6.6 66.85L3.75 61.5 28.2 20.25l29.1 0 24.55 41.2-29.2 0-24.5 0z"
                        fill="#0066da"
                      />
                      <path
                        d="M57.3 20.25L32.8 61.5l2.9 5.35L58.2 26.35l29.1 0-27-46.1z"
                        fill="#00ac47"
                      />
                      <path
                        d="M.15 61.5l27-46.1 29.15 0-27 46.1z"
                        fill="#ffba00"
                      />
                    </svg>
                    {t("chat.add_from_google_drive")}
                  </DropdownMenuItem>
                )}
                {onLibraryClick && (
                  <DropdownMenuItem onClick={onLibraryClick}>
                    <FolderOpen className="mr-2 h-4 w-4" />
                    {t("chat.choose_from_library")}
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                {onUploadClick && (
                  <DropdownMenuItem onClick={onUploadClick}>
                    <svg
                      className="mr-2 h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                    </svg>
                    {t("chat.add_local_file")}
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* File Panel button - show when has files */}
            {hasFiles && onOpenFilePanel && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onOpenFilePanel}
                className="h-9 w-9 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
                title="View files"
              >
                <FolderOpen className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Right: Voice + Send/Stop */}
          <div className="flex items-center gap-1">
            {/* Voice Button */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <Mic className="h-5 w-5" />
            </Button>

            {/* Send/Stop Button */}
            <Button
              type={isLoading ? "button" : "submit"}
              size="icon"
              variant={isLoading ? "destructive" : "default"}
              onClick={isLoading ? onStop : handleSubmit}
              disabled={!isLoading && (!value.trim() || disabled)}
              className={cn(
                "h-9 w-9 rounded-full shadow-sm transition-all duration-200",
                !isLoading && value.trim()
                  ? "text-primary-foreground hover:bg-primary/90 bg-primary"
                  : isLoading
                  ? ""
                  : "bg-muted text-muted-foreground opacity-50"
              )}
            >
              {isLoading ? (
                <Square className="h-4 w-4 fill-current" />
              ) : (
                <ArrowUp className="h-5 w-5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    );
  }
);

ChatPromptInput.displayName = "ChatPromptInput";
