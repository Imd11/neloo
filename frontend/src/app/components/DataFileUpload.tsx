"use client";

import {
  Plus,
  X,
  FileSpreadsheet,
  Loader2,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  DataFile,
  formatFileSize,
  getFileTypeLabel,
} from "@/lib/data-file-utils";
import { useLanguage } from "@/providers/LanguageProvider";

interface DataFileUploadProps {
  files: DataFile[];
  isUploading: boolean;
  isImporting?: boolean;
  onTriggerSelect: () => void;
  onTriggerLibrary?: () => void;
  onRemoveFile: (fileId: string) => void;
  onTriggerGoogleDrive?: () => void;
  disabled?: boolean;
}

/**
 * Data File Upload Component
 *
 * Displays an upload button with dropdown menu and chips for selected files.
 * Supports CSV, Excel, Stata, SPSS, and Parquet formats.
 */
export function DataFileUpload({
  files,
  isUploading,
  isImporting = false,
  onTriggerSelect,
  onTriggerLibrary,
  onRemoveFile,
  onTriggerGoogleDrive,
  disabled = false,
}: DataFileUploadProps) {
  const { t } = useLanguage();
  const isProcessing = isUploading || isImporting;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {/* Upload Button with Dropdown - Plus icon like AnyAI */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={disabled || isProcessing}
            className="h-9 w-9 shrink-0 rounded-full text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            {isProcessing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Plus className="h-5 w-5" />
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-56"
        >
          {onTriggerGoogleDrive && (
            <DropdownMenuItem onClick={onTriggerGoogleDrive}>
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
              <span>{t("chat.add_from_google_drive")}</span>
            </DropdownMenuItem>
          )}
          {onTriggerLibrary && (
            <DropdownMenuItem onClick={onTriggerLibrary}>
              <FolderOpen className="mr-2 h-4 w-4" />
              <span>{t("chat.choose_from_library")}</span>
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onTriggerSelect}>
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
            <span>{t("chat.add_local_file")}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* File Chips */}
      {files.map((dataFile) => (
        <FileChip
          key={dataFile.id}
          dataFile={dataFile}
          onRemove={() => onRemoveFile(dataFile.id)}
          disabled={disabled || isProcessing}
        />
      ))}
    </div>
  );
}

interface FileChipProps {
  dataFile: DataFile;
  onRemove: () => void;
  disabled?: boolean;
}

function FileChip({ dataFile, onRemove, disabled }: FileChipProps) {
  const { file, status, error, displaySize } = dataFile;
  const typeLabel = getFileTypeLabel(file.name);
  // Use displaySize if available (for library imports), otherwise use file.size
  const sizeLabel = formatFileSize(displaySize ?? file.size);

  // Truncate filename if too long
  const maxNameLength = 20;
  const displayName =
    file.name.length > maxNameLength
      ? `${file.name.slice(0, maxNameLength - 3)}...`
      : file.name;

  return (
    <div
      className={cn(
        "flex items-center gap-1 rounded-full px-2 py-1 text-xs",
        "border bg-muted/50",
        status === "error" && "border-destructive bg-destructive/10",
        status === "uploaded" && "border-green-500/50 bg-green-500/10",
        status === "uploading" && "border-blue-500/50 bg-blue-500/10"
      )}
      title={error || `${file.name} (${sizeLabel})`}
    >
      {/* Icon */}
      {status === "uploading" ? (
        <Loader2 className="h-3 w-3 animate-spin text-blue-500" />
      ) : (
        <FileSpreadsheet
          className={cn(
            "h-3 w-3",
            status === "error" && "text-destructive",
            status === "uploaded" && "text-green-500",
            status === "pending" && "text-muted-foreground"
          )}
        />
      )}

      {/* Filename */}
      <span
        className={cn(
          "max-w-[150px] truncate",
          status === "error" && "text-destructive"
        )}
      >
        {displayName}
      </span>

      {/* Type and Size */}
      <span className="text-muted-foreground">
        ({typeLabel}, {sizeLabel})
      </span>

      {/* Remove Button */}
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        className={cn(
          "ml-1 rounded-full p-0.5 hover:bg-muted",
          "text-muted-foreground hover:text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          disabled && "cursor-not-allowed opacity-50"
        )}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Remove {file.name}</span>
      </button>
    </div>
  );
}

export default DataFileUpload;
