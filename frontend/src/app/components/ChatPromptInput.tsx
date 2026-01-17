'use client';

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Plus, Mic, ArrowUp, X, Square, Upload, FolderOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature } from "@/data/featureTemplates";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ChatPromptInputProps {
    placeholder?: string;
    value?: string;
    onChange?: (value: string) => void;
    onSubmit?: (value: string) => void;
    className?: string;
    // Feature mode (like "网页开发")
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

export const ChatPromptInput = forwardRef<ChatPromptInputRef, ChatPromptInputProps>(({
    placeholder = "描述你想要创建的内容...",
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
}, ref) => {
    const [internalValue, setInternalValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Use controlled or uncontrolled value
    const value = controlledValue !== undefined ? controlledValue : internalValue;
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
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
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
    const effectivePlaceholder = selectedFeature?.placeholder
        || (webDevMode ? "描述你想要开发的网页..." : placeholder);

    return (
        <div
            className={cn(
                "relative w-full",
                "bg-input-bg rounded-2xl",
                "border border-border",
                "transition-all duration-200",
                isFocused && "border-ring shadow-glow",
                className
            )}
        >
            {/* Top row: Feature tag + Textarea */}
            <div className="flex items-start gap-2 px-4 pt-3 pb-0">
                {/* Web Dev Mode Tag (legacy) */}
                {webDevMode && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 bg-blue-500/15 text-blue-600 dark:text-blue-400 mt-1">
                        <span>网页开发</span>
                        {!isModeLocked && (
                            <button
                                type="button"
                                onClick={onClearFeature}
                                className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-current/25 hover:scale-125 active:scale-95 transition-all duration-150"
                            >
                                <X className="w-2.5 h-2.5" />
                            </button>
                        )}
                    </div>
                )}

                {/* Selected Feature Tag (AnyAI style) */}
                {selectedFeature && !webDevMode && (
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 mt-1",
                        selectedFeature.id === "web-dev" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        selectedFeature.id === "slides" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                        selectedFeature.id === "resume" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        selectedFeature.id === "prompt-optimize" && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                        selectedFeature.id === "fortune" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        selectedFeature.id === "deai" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                    )}>
                        <span>{selectedFeature.title}</span>
                        <button
                            onClick={onClearFeature}
                            className="flex items-center justify-center w-4 h-4 rounded-full hover:bg-current/25 hover:scale-125 active:scale-95 transition-all duration-150"
                        >
                            <X className="w-2.5 h-2.5" />
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
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-7 outline-none ring-0 focus:ring-0 focus:outline-none border-none min-w-0 min-h-[40px] max-h-[200px] resize-none disabled:opacity-50 disabled:cursor-not-allowed"
                    rows={1}
                />
            </div>

            {/* Bottom row: Actions */}
            <div className="flex justify-between items-center gap-2 px-3 pb-3 pt-1">
                {/* Left: Plus menu + File actions */}
                <div className="flex items-center gap-1">
                    {/* Plus Button with dropdown */}
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon"
                                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                            >
                                <Plus className="w-5 h-5" />
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="w-56">
                            {onGoogleDriveClick && (
                                <DropdownMenuItem onClick={onGoogleDriveClick}>
                                    <svg className="w-4 h-4 mr-2" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                                        <path d="M6.6 66.85L3.75 61.5 28.2 20.25l29.1 0 24.55 41.2-29.2 0-24.5 0z" fill="#0066da" />
                                        <path d="M57.3 20.25L32.8 61.5l2.9 5.35L58.2 26.35l29.1 0-27-46.1z" fill="#00ac47" />
                                        <path d="M.15 61.5l27-46.1 29.15 0-27 46.1z" fill="#ffba00" />
                                    </svg>
                                    从 Google Drive 文件中添加
                                </DropdownMenuItem>
                            )}
                            {onLibraryClick && (
                                <DropdownMenuItem onClick={onLibraryClick}>
                                    <FolderOpen className="w-4 h-4 mr-2" />
                                    从库中选择
                                </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            {onUploadClick && (
                                <DropdownMenuItem onClick={onUploadClick}>
                                    <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                                    </svg>
                                    从本地文件中添加
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
                            className="h-9 w-9 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted"
                            title="View files"
                        >
                            <FolderOpen className="w-4 h-4" />
                        </Button>
                    )}
                </div>

                {/* Right: Voice + Send/Stop */}
                <div className="flex items-center gap-1">
                    {/* Voice Button */}
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full"
                    >
                        <Mic className="w-5 h-5" />
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
                                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                                : (isLoading ? "" : "bg-muted text-muted-foreground opacity-50")
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
});

ChatPromptInput.displayName = "ChatPromptInput";
