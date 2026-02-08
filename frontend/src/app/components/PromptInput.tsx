import { useState, useEffect, useRef } from "react";
import { Plus, Mic, ArrowUp, X, FolderOpen, FileText, Image, Music, Table, File, Presentation, Loader2, ChevronDown, LayoutTemplate } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature, Template } from "@/data/featureTemplates";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// File preview item interface
export interface FilePreviewItem {
    id: string;
    name: string;
    size: number;
    type: string;  // MIME type or extension
    status: 'pending' | 'uploading' | 'uploaded' | 'error';
    error?: string;
}

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
    // Multi-file preview support
    files?: FilePreviewItem[];
    onRemoveFile?: (fileId: string) => void;
    // Legacy single file support (deprecated, use files instead)
    resumeFile?: File | null;
    // Template selection callback
    onSelectTemplate?: (template: Template) => void;
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
    onGoogleDriveClick,
    files = [],
    onRemoveFile,
    resumeFile,
    onSelectTemplate,
}: PromptInputProps) {
    const [value, setValue] = useState(initialValue);
    const [isFocused, setIsFocused] = useState(false);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);

    // Update value if initialValue changes
    useEffect(() => {
        if (initialValue) {
            setValue(initialValue);
        }
    }, [initialValue]);

    // Reset selected template when feature changes
    useEffect(() => {
        setSelectedTemplate(null);
    }, [selectedFeature?.id]);

    // Autosize textarea (up to a max height), so long prompts remain viewable/editable.
    useEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = "auto";
        const maxHeight = 160;
        el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    }, [value]);

    // Format file size
    const formatFileSize = (bytes: number): string => {
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    };

    // Get file type info (icon, color, label) based on file name or MIME type
    const getFileTypeInfo = (fileName: string, mimeType?: string) => {
        const ext = fileName.toLowerCase().split('.').pop() || '';

        // PDF
        if (ext === 'pdf' || mimeType?.includes('pdf')) {
            return { Icon: FileText, color: 'red', label: 'PDF' };
        }
        // PPT/PPTX
        if (['ppt', 'pptx'].includes(ext) || mimeType?.includes('presentation')) {
            return { Icon: Presentation, color: 'orange', label: ext.toUpperCase() };
        }
        // DOC/DOCX
        if (['doc', 'docx'].includes(ext) || mimeType?.includes('document')) {
            return { Icon: FileText, color: 'blue', label: ext.toUpperCase() };
        }
        // Images
        if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext) || mimeType?.startsWith('image/')) {
            return { Icon: Image, color: 'green', label: '图片' };
        }
        // Audio
        if (['mp3', 'wav', 'm4a', 'ogg', 'flac'].includes(ext) || mimeType?.startsWith('audio/')) {
            return { Icon: Music, color: 'purple', label: '音频' };
        }
        // Data files
        if (['csv', 'xlsx', 'xls', 'parquet'].includes(ext)) {
            return { Icon: Table, color: 'emerald', label: ext.toUpperCase() };
        }
        // Text
        if (['txt', 'rtf'].includes(ext) || mimeType?.startsWith('text/')) {
            return { Icon: FileText, color: 'gray', label: 'TXT' };
        }
        // Default
        return { Icon: File, color: 'gray', label: '文件' };
    };

    // Check if there are any files (new format or legacy)
    const hasUploadedFiles = files.some(f => f.status === 'uploaded') || resumeFile;

    const handleSubmit = () => {
        // Allow submit if there's text OR files
        if ((value.trim() || hasUploadedFiles) && onSubmit) {
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

    // Get template-related data
    const featureTemplates = selectedFeature?.templates || [];
    const hasTemplates = featureTemplates.length > 0;

    const handleTemplateSelect = (template: Template) => {
        setSelectedTemplate(template);
        onSelectTemplate?.(template);
    };

    return (
        <div
            className={cn(
                "relative w-full flex flex-col",
                "bg-input-bg rounded-3xl",
                "border border-border",
                "transition-all duration-200",
                isFocused && "border-ring shadow-glow",
                className
            )}
        >
            {/* File Preview Tags - Compact pill style */}
            {(files.length > 0 || resumeFile) && (
                <div className="px-5 pt-3 pb-0 flex flex-wrap gap-1.5">
                    {/* Multi-file format */}
                    {files.map((file) => {
                        const { Icon, color } = getFileTypeInfo(file.name, file.type);
                        const iconColor = {
                            red: 'text-red-500',
                            orange: 'text-orange-500',
                            blue: 'text-blue-500',
                            green: 'text-green-500',
                            purple: 'text-purple-500',
                            emerald: 'text-emerald-500',
                            gray: 'text-gray-500',
                        }[color] || 'text-gray-500';

                        return (
                            <div
                                key={file.id}
                                className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-muted/50 rounded-full text-xs"
                            >
                                {file.status === 'uploading' ? (
                                    <Loader2 className={cn("w-3.5 h-3.5 animate-spin shrink-0", iconColor)} />
                                ) : (
                                    <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
                                )}
                                <span className="font-medium text-foreground truncate max-w-[140px]">
                                    {file.name}
                                </span>
                                {file.status === 'uploading' && (
                                    <span className="text-muted-foreground shrink-0">上传中</span>
                                )}
                                <button
                                    onClick={() => onRemoveFile?.(file.id)}
                                    type="button"
                                    className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 cursor-pointer transition-all duration-150 hover:bg-foreground/10 hover:scale-110"
                                    aria-label="移除文件"
                                >
                                    <X className="w-2.5 h-2.5 text-muted-foreground" />
                                </button>
                            </div>
                        );
                    })}

                    {/* Legacy single file support (resumeFile) */}
                    {resumeFile && files.length === 0 && (() => {
                        const { Icon, color } = getFileTypeInfo(resumeFile.name, resumeFile.type);
                        const iconColor = {
                            red: 'text-red-500',
                            orange: 'text-orange-500',
                            blue: 'text-blue-500',
                            green: 'text-green-500',
                            purple: 'text-purple-500',
                            emerald: 'text-emerald-500',
                            gray: 'text-gray-500',
                        }[color] || 'text-gray-500';

                        return (
                            <div className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 bg-muted/50 rounded-full text-xs">
                                <Icon className={cn("w-3.5 h-3.5 shrink-0", iconColor)} />
                                <span className="font-medium text-foreground truncate max-w-[140px]">
                                    {resumeFile.name}
                                </span>
                                <button
                                    onClick={() => onRemoveFile?.('')}
                                    type="button"
                                    className="flex items-center justify-center w-4 h-4 rounded-full shrink-0 cursor-pointer transition-all duration-150 hover:bg-foreground/10 hover:scale-110"
                                    aria-label="移除文件"
                                >
                                    <X className="w-2.5 h-2.5 text-muted-foreground" />
                                </button>
                            </div>
                        );
                    })()}
                </div>
            )}

            {/* Row 1: Textarea (top ~70%) */}
            <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                onKeyDown={handleKeyDown}
                disabled={disabled}
                placeholder={selectedFeature?.placeholder || placeholder}
                rows={2}
                aria-label="提示词输入"
                className="w-full resize-none bg-transparent text-foreground placeholder:text-muted-foreground text-base leading-6 outline-none ring-0 focus:ring-0 focus:outline-none border-none px-5 pt-4 pb-1 max-h-[160px] overflow-y-auto disabled:opacity-50 disabled:cursor-not-allowed"
            />

            {/* Row 2: Controls bar (bottom) */}
            <div className="flex items-center gap-1.5 px-3 pb-3 pt-1">
                {/* Left side controls */}
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    {/* Plus Button with Dropdown Menu */}
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
                            selectedFeature.id === "image" && "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
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

                    {/* Template Selector - only show when feature has templates */}
                    {selectedFeature && hasTemplates && (
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <button
                                    type="button"
                                    className={cn(
                                        "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm shrink-0 transition-all duration-150",
                                        "border border-border/60 hover:border-border hover:bg-muted/50",
                                        "text-muted-foreground hover:text-foreground",
                                        selectedTemplate && "text-foreground bg-muted/30"
                                    )}
                                >
                                    <LayoutTemplate className="w-3.5 h-3.5" />
                                    <span className="max-w-[120px] truncate">
                                        {selectedTemplate ? selectedTemplate.title : "选择模板"}
                                    </span>
                                    <ChevronDown className="w-3 h-3 opacity-60" />
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-56 max-h-[300px] overflow-y-auto">
                                {featureTemplates.map((template) => (
                                    <DropdownMenuItem
                                        key={template.id}
                                        onClick={() => handleTemplateSelect(template)}
                                        className={cn(
                                            selectedTemplate?.id === template.id && "bg-accent"
                                        )}
                                    >
                                        <div className="flex flex-col gap-0.5">
                                            <span className="font-medium">{template.title}</span>
                                            {template.description && (
                                                <span className="text-xs text-muted-foreground">{template.description}</span>
                                            )}
                                        </div>
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                    )}
                </div>

                {/* Right side controls */}
                <div className="flex items-center gap-1">
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
                        disabled={(!value.trim() && !hasUploadedFiles) || disabled}
                        className={cn(
                            "shrink-0 transition-all duration-200",
                            (!value.trim() && !hasUploadedFiles) && "opacity-50 cursor-not-allowed"
                        )}
                    >
                        <ArrowUp className="w-4 h-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
}
