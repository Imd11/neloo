import { useState, useRef, useEffect } from "react";
import { Plus, Mic, ArrowUp, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature } from "@/data/featureTemplates";

interface PlaceholderSegment {
    type: "text" | "placeholder";
    content: string;
    value?: string;
}

interface TemplatePromptInputProps {
    placeholder?: string;
    onSubmit?: (value: string) => void;
    className?: string;
    selectedFeature?: Feature | null;
    onClearFeature?: () => void;
    onPlusClick?: () => void;
}

// 五行算命的模板文本
const FORTUNE_TEMPLATE = [
    { type: "text" as const, content: "我出生于阳历" },
    { type: "placeholder" as const, content: "xxxx", value: "" },
    { type: "text" as const, content: "年" },
    { type: "placeholder" as const, content: "xx", value: "" },
    { type: "text" as const, content: "月" },
    { type: "placeholder" as const, content: "xx", value: "" },
    { type: "text" as const, content: "日" },
    { type: "placeholder" as const, content: "xx", value: "" },
    { type: "text" as const, content: "时" },
    { type: "placeholder" as const, content: "xx", value: "" },
    { type: "text" as const, content: "分，性别为" },
    { type: "placeholder" as const, content: "男/女", value: "" },
    { type: "text" as const, content: "，出生地为" },
    { type: "placeholder" as const, content: "省、市、区/县", value: "" },
    { type: "text" as const, content: "。\n前事验证信息（可选但推荐，用于模型微调）：" },
    { type: "placeholder" as const, content: '例如："2021年考研成功"', value: "" },
];

export function TemplatePromptInput({
    placeholder = "输入你的任务...",
    onSubmit,
    className,
    selectedFeature,
    onClearFeature,
    onPlusClick,
}: TemplatePromptInputProps) {
    const [value, setValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [segments, setSegments] = useState<PlaceholderSegment[]>([]);
    const [editingIndex, setEditingIndex] = useState<number | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const editInputRef = useRef<HTMLInputElement>(null);

    // 当选择五行算命时，初始化模板
    useEffect(() => {
        if (selectedFeature?.id === "fortune") {
            setSegments(FORTUNE_TEMPLATE.map(seg => ({ ...seg })));
            setValue("");
        } else {
            setSegments([]);
        }
    }, [selectedFeature]);

    // 自动聚焦到编辑框
    useEffect(() => {
        if (editingIndex !== null && editInputRef.current) {
            editInputRef.current.focus();
            editInputRef.current.select();
        }
    }, [editingIndex]);

    const handleSubmit = () => {
        if (selectedFeature?.id === "fortune") {
            // 组装完整的文本
            const fullText = segments
                .map((seg) =>
                    seg.type === "placeholder" ? (seg.value || seg.content) : seg.content
                )
                .join("");
            if (onSubmit) {
                onSubmit(fullText);
            }
        } else if (value.trim() && onSubmit) {
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

    const handlePlaceholderClick = (index: number) => {
        setEditingIndex(index);
    };

    const handlePlaceholderChange = (index: number, newValue: string) => {
        setSegments((prev) =>
            prev.map((seg, i) =>
                i === index ? { ...seg, value: newValue } : seg
            )
        );
    };

    const handlePlaceholderBlur = () => {
        setEditingIndex(null);
    };

    const handlePlaceholderKeyDown = (e: React.KeyboardEvent, index: number) => {
        if (e.key === "Enter") {
            e.preventDefault();
            setEditingIndex(null);
        } else if (e.key === "Tab") {
            e.preventDefault();
            // 找到下一个占位符
            const placeholderIndices = segments
                .map((seg, i) => (seg.type === "placeholder" ? i : -1))
                .filter((i) => i !== -1);
            const currentPos = placeholderIndices.indexOf(index);
            if (currentPos < placeholderIndices.length - 1) {
                setEditingIndex(placeholderIndices[currentPos + 1]);
            } else {
                setEditingIndex(null);
            }
        }
    };

    const isFortuneMode = selectedFeature?.id === "fortune";

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
            <div
                className={cn(
                    "flex gap-2 px-4 py-3",
                    isFortuneMode ? "items-start" : "items-center"
                )}
            >
                {/* Plus Button */}
                <Button
                    variant="icon"
                    size="icon-sm"
                    className={cn(
                        "shrink-0 text-muted-foreground hover:text-foreground",
                        isFortuneMode && "mt-0.5"
                    )}
                    onClick={onPlusClick}
                >
                    <Plus className="w-5 h-5" />
                </Button>

                {/* Selected Feature Tag (非fortune模式) */}
                {selectedFeature && !isFortuneMode && (
                    <div className={cn(
                        "group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium shrink-0 overflow-hidden transition-all duration-150 hover:shadow-xs",
                        "before:content-[''] before:absolute before:inset-0 before:rounded-full before:bg-current/10 before:opacity-0 before:transition-opacity before:duration-150 before:pointer-events-none before:z-0",
                        "hover:before:opacity-100",
                        selectedFeature.id === "web-dev" && "bg-blue-500/15 text-blue-600 dark:text-blue-400",
                        selectedFeature.id === "slides" && "bg-orange-500/15 text-orange-600 dark:text-orange-400",
                        selectedFeature.id === "resume" && "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
                        selectedFeature.id === "prompt-optimize" && "bg-violet-500/15 text-violet-600 dark:text-violet-400",
                        selectedFeature.id === "deai" && "bg-rose-500/15 text-rose-600 dark:text-rose-400",
                    )}>
                        <span className="relative z-10">{selectedFeature.title}</span>
                        <button
                            onClick={onClearFeature}
                            className="relative z-10 flex items-center justify-center w-4 h-4 rounded-full transition-all duration-150 hover:bg-current/35 hover:scale-125 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                            aria-label="清除已选功能"
                        >
                            <X className="w-2.5 h-2.5" />
                        </button>
                    </div>
                )}

                {/* 模板内容区域 */}
                <div className="flex-1 min-w-0">
                    {isFortuneMode ? (
                        <div className="relative">
                            {/* Fortune Feature Tag */}
                            <div className="flex items-center gap-1.5 mb-2">
                                <div className="group relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-500/15 text-amber-600 dark:text-amber-400 overflow-hidden transition-all duration-150 hover:shadow-xs">
                                    <span className="relative z-10">{selectedFeature.title}</span>
                                    <button
                                        onClick={onClearFeature}
                                        className="relative z-10 flex items-center justify-center w-4 h-4 rounded-full transition-all duration-150 hover:bg-current/35 hover:scale-125 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                                        aria-label="清除已选功能"
                                    >
                                        <X className="w-2.5 h-2.5" />
                                    </button>
                                </div>
                            </div>

                            {/* 模板文本区域 */}
                            <div
                                className="text-base leading-relaxed text-foreground"
                                onFocus={() => setIsFocused(true)}
                                onBlur={() => setIsFocused(false)}
                            >
                                {segments.map((segment, index) => {
                                    if (segment.type === "text") {
                                        // 处理换行符
                                        const parts = segment.content.split('\n');
                                        return (
                                            <span key={index} className="text-foreground">
                                                {parts.map((part, partIndex) => (
                                                    <span key={partIndex}>
                                                        {partIndex > 0 && <br />}
                                                        {part}
                                                    </span>
                                                ))}
                                            </span>
                                        );
                                    }

                                    const hasValue = segment.value && segment.value.trim() !== "";
                                    const isEditing = editingIndex === index;

                                    // 使用统一的样式，无论是编辑状态还是非编辑状态
                                    const displayText = hasValue ? segment.value : segment.content;

                                    return (
                                        <span
                                            key={index}
                                            onClick={() => !isEditing && handlePlaceholderClick(index)}
                                            className="inline-block bg-placeholder-accent/15 text-placeholder-accent rounded mx-0.5 cursor-pointer relative"
                                        >
                                            {/* 始终显示的文本容器（负责撑开宽高），编辑时隐藏但保留占位 */}
                                            <span
                                                className={cn(
                                                    "inline-block px-1.5 py-0.5 text-base leading-relaxed whitespace-pre",
                                                    isEditing && "invisible"
                                                )}
                                            >
                                                {displayText}
                                            </span>

                                            {/* 编辑时的输入框，绝对定位覆盖在上面（padding/line-height 与上面一致，避免抖动） */}
                                            {isEditing && (
                                                <input
                                                    ref={editInputRef}
                                                    type="text"
                                                    value={segment.value || ""}
                                                    onChange={(e) => handlePlaceholderChange(index, e.target.value)}
                                                    onBlur={handlePlaceholderBlur}
                                                    onKeyDown={(e) => handlePlaceholderKeyDown(e, index)}
                                                    placeholder={segment.content}
                                                    className="absolute inset-0 w-full h-full bg-transparent text-placeholder-accent outline-none border-none text-base leading-relaxed placeholder:text-placeholder-accent px-1.5 py-0.5 m-0 appearance-none"
                                                    style={{ caretColor: "currentColor", font: "inherit" }}
                                                />
                                            )}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    ) : (
                        <input
                            ref={inputRef}
                            type="text"
                            value={value}
                            onChange={(e) => setValue(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder={selectedFeature?.placeholder || placeholder}
                            className="w-full bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-5 outline-none"
                        />
                    )}
                </div>

                {/* Voice Button */}
                <Button
                    variant="icon"
                    size="icon-sm"
                    className={cn(
                        "shrink-0 text-muted-foreground hover:text-foreground",
                        isFortuneMode && "mt-0.5"
                    )}
                >
                    <Mic className="w-5 h-5" />
                </Button>

                {/* Send Button */}
                <Button
                    variant="send"
                    size="icon-sm"
                    onClick={handleSubmit}
                    className={cn("shrink-0", isFortuneMode && "mt-0.5")}
                >
                    <ArrowUp className="w-4 h-4" />
                </Button>
            </div>
        </div>
    );
}
