import { useState, useEffect } from "react";
import { Plus, Mic, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature } from "@/data/featureTemplates";

interface PromptInputProps {
    placeholder?: string;
    initialValue?: string;
    onSubmit?: (value: string) => void;
    className?: string;
    selectedFeature?: Feature | null;
    onClearFeature?: () => void;
    disabled?: boolean;
}

export function PromptInput({
    placeholder = "描述你想要创建的内容...",
    initialValue = "",
    onSubmit,
    className,
    selectedFeature,
    onClearFeature,
    disabled
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
                {/* Plus Button */}
                <Button
                    variant="icon"
                    size="icon-sm"
                    className="shrink-0 text-muted-foreground hover:text-foreground"
                >
                    <Plus className="w-5 h-5" />
                </Button>

                {/* Selected Feature Tag */}
                {selectedFeature && (
                    <div className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0",
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
