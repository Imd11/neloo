"use client";

import { Paperclip, X, FileSpreadsheet, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DataFile,
  formatFileSize,
  getFileTypeLabel,
} from "@/lib/data-file-utils";

interface DataFileUploadProps {
  files: DataFile[];
  isUploading: boolean;
  onTriggerSelect: () => void;
  onRemoveFile: (fileId: string) => void;
  disabled?: boolean;
}

/**
 * Data File Upload Component
 *
 * Displays an upload button and chips for selected files.
 */
export function DataFileUpload({
  files,
  isUploading,
  onTriggerSelect,
  onRemoveFile,
  disabled = false,
}: DataFileUploadProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Upload Button */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onTriggerSelect}
        disabled={disabled || isUploading}
        className="h-8 px-2 text-muted-foreground hover:text-foreground"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin mr-1" />
        ) : (
          <Paperclip className="h-4 w-4 mr-1" />
        )}
        <span className="text-xs">Upload Data</span>
      </Button>

      {/* File Chips */}
      {files.map((dataFile) => (
        <FileChip
          key={dataFile.id}
          dataFile={dataFile}
          onRemove={() => onRemoveFile(dataFile.id)}
          disabled={disabled || isUploading}
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
  const { file, status, error } = dataFile;
  const typeLabel = getFileTypeLabel(file.name);
  const sizeLabel = formatFileSize(file.size);

  // Truncate filename if too long
  const maxNameLength = 20;
  const displayName =
    file.name.length > maxNameLength
      ? `${file.name.slice(0, maxNameLength - 3)}...`
      : file.name;

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2 py-1 rounded-full text-xs",
        "bg-muted/50 border",
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
          "ml-1 p-0.5 rounded-full hover:bg-muted",
          "text-muted-foreground hover:text-foreground",
          "focus:outline-none focus:ring-1 focus:ring-ring",
          disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Remove {file.name}</span>
      </button>
    </div>
  );
}

export default DataFileUpload;
