import { useState, useEffect, useRef } from "react";
import {
  Plus,
  Mic,
  ArrowUp,
  X,
  FolderOpen,
  FileText,
  Image,
  Music,
  Table,
  File,
  Presentation,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Feature } from "@/data/featureTemplates";
import { useLanguage } from "@/providers/LanguageProvider";
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
  type: string; // MIME type or extension
  status: "pending" | "uploading" | "uploaded" | "error";
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
}

export function PromptInputCompact({
  placeholder = "",
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
}: PromptInputProps) {
  const { t } = useLanguage();
  const [value, setValue] = useState(initialValue);
  const [isFocused, setIsFocused] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Update value if initialValue changes
  useEffect(() => {
    if (initialValue) {
      setValue(initialValue);
    }
  }, [initialValue]);

  // Autosize textarea (up to a max height), so long prompts remain viewable/editable.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 200;
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
    const ext = fileName.toLowerCase().split(".").pop() || "";

    // PDF
    if (ext === "pdf" || mimeType?.includes("pdf")) {
      return { Icon: FileText, color: "red", label: "PDF" };
    }
    // PPT/PPTX
    if (["ppt", "pptx"].includes(ext) || mimeType?.includes("presentation")) {
      return { Icon: Presentation, color: "orange", label: ext.toUpperCase() };
    }
    // DOC/DOCX
    if (["doc", "docx"].includes(ext) || mimeType?.includes("document")) {
      return { Icon: FileText, color: "blue", label: ext.toUpperCase() };
    }
    // Images
    if (
      ["png", "jpg", "jpeg", "gif", "webp"].includes(ext) ||
      mimeType?.startsWith("image/")
    ) {
      return { Icon: Image, color: "green", label: t("chat.file_type_image") };
    }
    // Audio
    if (
      ["mp3", "wav", "m4a", "ogg", "flac"].includes(ext) ||
      mimeType?.startsWith("audio/")
    ) {
      return { Icon: Music, color: "purple", label: t("chat.file_type_audio") };
    }
    // Data files
    if (["csv", "xlsx", "xls", "parquet"].includes(ext)) {
      return { Icon: Table, color: "emerald", label: ext.toUpperCase() };
    }
    // Text
    if (["txt", "rtf"].includes(ext) || mimeType?.startsWith("text/")) {
      return { Icon: FileText, color: "gray", label: "TXT" };
    }
    // Default
    return { Icon: File, color: "gray", label: t("chat.file_type_file") };
  };

  // Check if there are any files (new format or legacy)
  const hasUploadedFiles =
    files.some((f) => f.status === "uploaded") || resumeFile;

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

  return (
    <div
      className={cn(
        "relative w-full",
        "rounded-3xl bg-input-bg",
        "border border-border",
        "transition-all duration-200",
        isFocused && "border-ring shadow-glow",
        className
      )}
    >
      {/* File Preview Cards - Multi-file support */}
      {(files.length > 0 || resumeFile) && (
        <div className="flex flex-wrap gap-2 px-4 pb-2 pt-3">
          {/* New multi-file format */}
          {files.map((file) => {
            const { Icon, color, label } = getFileTypeInfo(
              file.name,
              file.type
            );
            const colorClasses =
              {
                red: "bg-red-500/15 text-red-500",
                orange: "bg-orange-500/15 text-orange-500",
                blue: "bg-blue-500/15 text-blue-500",
                green: "bg-green-500/15 text-green-500",
                purple: "bg-purple-500/15 text-purple-500",
                emerald: "bg-emerald-500/15 text-emerald-500",
                gray: "bg-gray-500/15 text-gray-500",
              }[color] || "bg-gray-500/15 text-gray-500";

            return (
              <div
                key={file.id}
                className="relative inline-flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5"
              >
                {/* File Icon with status overlay */}
                <div
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                    colorClasses.split(" ")[0]
                  )}
                >
                  {file.status === "uploading" ? (
                    <Loader2
                      className={cn(
                        "h-5 w-5 animate-spin",
                        colorClasses.split(" ")[1]
                      )}
                    />
                  ) : (
                    <Icon
                      className={cn("h-5 w-5", colorClasses.split(" ")[1])}
                    />
                  )}
                </div>
                {/* File Info */}
                <div className="flex min-w-0 flex-col">
                  <span className="max-w-[180px] truncate text-sm font-medium text-foreground">
                    {file.name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {label} · {formatFileSize(file.size)}
                    {file.status === "uploading" && t("chat.uploading_dots")}
                    {file.status === "error" && t("chat.upload_failed")}
                  </span>
                </div>
                {/* Remove Button */}
                <button
                  onClick={() => onRemoveFile?.(file.id)}
                  type="button"
                  className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted-foreground/20"
                  aria-label={t("chat.remove_file")}
                >
                  <X className="h-3 w-3 text-muted-foreground" />
                </button>
              </div>
            );
          })}

          {/* Legacy single file support (resumeFile) */}
          {resumeFile &&
            files.length === 0 &&
            (() => {
              const { Icon, color, label } = getFileTypeInfo(
                resumeFile.name,
                resumeFile.type
              );
              const colorClasses =
                {
                  red: "bg-red-500/15 text-red-500",
                  orange: "bg-orange-500/15 text-orange-500",
                  blue: "bg-blue-500/15 text-blue-500",
                  green: "bg-green-500/15 text-green-500",
                  purple: "bg-purple-500/15 text-purple-500",
                  emerald: "bg-emerald-500/15 text-emerald-500",
                  gray: "bg-gray-500/15 text-gray-500",
                }[color] || "bg-gray-500/15 text-gray-500";

              return (
                <div className="relative inline-flex items-center gap-3 rounded-xl bg-muted/50 px-3 py-2.5">
                  <div
                    className={cn(
                      "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                      colorClasses.split(" ")[0]
                    )}
                  >
                    <Icon
                      className={cn("h-5 w-5", colorClasses.split(" ")[1])}
                    />
                  </div>
                  <div className="flex min-w-0 flex-col">
                    <span className="max-w-[180px] truncate text-sm font-medium text-foreground">
                      {resumeFile.name}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {label} · {formatFileSize(resumeFile.size)}
                    </span>
                  </div>
                  <button
                    onClick={() => onRemoveFile?.("")}
                    type="button"
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-muted transition-colors hover:bg-muted-foreground/20"
                    aria-label={t("chat.remove_file")}
                  >
                    <X className="h-3 w-3 text-muted-foreground" />
                  </button>
                </div>
              );
            })()}
        </div>
      )}

      <div className="flex items-end gap-2 px-4 py-3">
        {/* Plus Button with Dropdown Menu - only show if any handlers are provided */}
        {(onGoogleDriveClick || onLibraryClick || onUploadClick) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="icon"
                size="icon-sm"
                className="shrink-0 text-muted-foreground hover:text-foreground"
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
              {(onGoogleDriveClick || onLibraryClick) && onUploadClick && (
                <DropdownMenuSeparator />
              )}
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
        )}

        {/* Selected Feature Tag */}
        {selectedFeature && (
          <div
            className={cn(
              "group relative flex shrink-0 cursor-default items-center gap-1.5 overflow-hidden rounded-full px-3 py-1.5 text-sm font-medium transition-all duration-150",
              "hover:ring-current/25 hover:shadow-xs hover:ring-1",
              "before:pointer-events-none before:absolute before:inset-0 before:z-0 before:rounded-full before:bg-foreground/10 before:opacity-0 before:transition-opacity before:duration-150 before:content-['']",
              "hover:before:opacity-100",
              selectedFeature.id === "image" &&
                "bg-cyan-500/15 text-cyan-700 dark:text-cyan-400",
              selectedFeature.id === "web-dev" &&
                "bg-blue-500/15 text-blue-600 dark:text-blue-400",
              selectedFeature.id === "slides" &&
                "bg-orange-500/15 text-orange-600 dark:text-orange-400",
              selectedFeature.id === "resume" &&
                "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
              selectedFeature.id === "prompt-optimize" &&
                "bg-violet-500/15 text-violet-600 dark:text-violet-400",
              selectedFeature.id === "fortune" &&
                "bg-amber-500/15 text-amber-600 dark:text-amber-400",
              selectedFeature.id === "deai" &&
                "bg-rose-500/15 text-rose-600 dark:text-rose-400"
            )}
          >
            <span className="relative z-10">{selectedFeature.title}</span>
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

        {/* Input */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={selectedFeature?.placeholder || placeholder}
          rows={1}
          aria-label={t("chat.prompt_input")}
          className="max-h-[200px] min-w-0 flex-1 translate-y-[1px] resize-none overflow-y-auto border-none bg-transparent py-1 text-base leading-5 text-foreground outline-none ring-0 placeholder:text-muted-foreground focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-50"
        />

        {/* Voice Button */}
        <Button
          variant="icon"
          size="icon-sm"
          className="shrink-0 text-muted-foreground hover:text-foreground"
        >
          <Mic className="h-5 w-5" />
        </Button>

        {/* Send Button */}
        <Button
          variant="send"
          size="icon-sm"
          onClick={handleSubmit}
          disabled={(!value.trim() && !hasUploadedFiles) || disabled}
          className={cn(
            "shrink-0 transition-all duration-200",
            !value.trim() &&
              !hasUploadedFiles &&
              "cursor-not-allowed opacity-50"
          )}
        >
          <ArrowUp className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
