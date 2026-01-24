import { useState, useEffect } from "react";
import { Plus, Mic, ArrowUp, X, Upload, FolderOpen } from "lucide-react";
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

interface PromptInputProps {
    placeholder?: string;
    initialValue?: string;
    onSubmit?: (value: string) => void;
    className?: string;
    selectedFeature?: Feature | null;
    onClearFeature?: () => void;
    disabled?: boolean;
    onUploadClick?: () => void;
    onLibraryClick?: () => void;
    onGoogleDriveClick?: () => void;
}

export function PromptInput({
    placeholder = "描述你想要创建的内容...",
    initialValue = "",
    onSubmit,
    className,
    selectedFeature,
    onClearFeature,
    disabled,
    onUploadClick,
    onLibraryClick,
    onGoogleDriveClick
}: PromptInputProps) {
    const [value, setValue] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);

    // Update value if initialValue changes
    useEffect(() => {
        if (initialValue) {
            setValue(initialValue);
        }
    }, [initialValue]);

    const handleSubmit = () => {
        if (value.trim() && onSubmit) {
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

    return (
        <div
            className={cn(
                "relative w-full",
                "bg-input-bg rounded-3xl",
                "border border-border",
                "transition-all duration-200",
                isFocused && "border-ring shadow-glow",
                className
            )}
        >
            <div className="flex items-center gap-2 px-4 py-3">
                {/* Plus Button with Dropdown Menu - only show if any handlers are provided */}
                {(onGoogleDriveClick || onLibraryClick || onUploadClick) && (
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button
                                variant="icon"
                                size="icon-sm"
                                className="shrink-0 text-muted-foreground hover:text-foreground"
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
                            {(onGoogleDriveClick || onLibraryClick) && onUploadClick && (
                                <DropdownMenuSeparator />
                            )}
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
                )}

                {/* Selected Feature Tag */}
                {selectedFeature && (
                    <div className={cn(
                        "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 cursor-default overflow-hidden transition-all duration-150",
                        "hover:shadow-xs hover:ring-1 hover:ring-current/25",
                        "before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-foreground/10 before:opacity-0 before:transition-opacity before:duration-150 before:pointer-events-none before:z-0",
                        "hover:before:opacity-100",
                        selectedFeature.id === "web-dev" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        selectedFeature.id === "slides" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                        selectedFeature.id === "resume" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        selectedFeature.id === "prompt-optimize" && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                        selectedFeature.id === "fortune" && "bg-amber-500/15 text-amber-600 dark:text-amber-400",
                        selectedFeature.id === "deai" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                    )}>
                        <span className="relative z-10">{selectedFeature.title}</span>
                        <button
                            onClick={onClearFeature}
                            type="button"
                            className="relative z-10 flex items-center justify-center w-4 h-4 rounded-full cursor-pointer transition-all duration-150 hover:bg-current/45 hover:scale-125 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label="清除已选功能"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </div>
                )}

                {/* Input */}
                <input
                    type="text"
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    onFocus={() => setIsFocused(true)}
                    onBlur={() => setIsFocused(false)}
                    onKeyDown={handleKeyDown}
                    disabled={disabled}
                    placeholder={selectedFeature?.placeholder || placeholder}
                    className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-none outline-none ring-0 focus:ring-0 focus:outline-none border-none min-w-0 translate-y-[1px] disabled:opacity-50 disabled:cursor-not-allowed"
                />

                {/* Voice Button */}
                <Button
                    variant="icon"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                    <Mic className="w-5 h-5" />
                </Button>

                {/* Send Button */}
                <Button
                    variant="send"
                    size="icon-sm"
                    onClick={handleSubmit}
                    disabled={!value.trim() || disabled}
                    className={cn(
                        "shrink-0 transition-all duration-200",
                        !value.trim() && "opacity-50 cursor-not-allowed"
                    )}
                >
                    <ArrowUp className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
