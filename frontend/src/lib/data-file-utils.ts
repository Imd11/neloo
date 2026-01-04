/**
 * Data File Utilities
 *
 * Utilities for validating and handling data files for upload.
 */

// Supported file extensions
export const ALLOWED_EXTENSIONS = [
  // Data files
  ".csv",
  ".xlsx",
  ".xls",
  ".dta",
  ".sav",
  ".parquet",
  // Image files (for multimodal)
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
] as const;

// MIME types for supported files
export const ALLOWED_MIME_TYPES: Record<string, string[]> = {
  // Data files
  ".csv": ["text/csv", "application/csv"],
  ".xlsx": [
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ],
  ".xls": ["application/vnd.ms-excel"],
  ".dta": ["application/octet-stream", "application/x-stata-dta"],
  ".sav": ["application/octet-stream", "application/x-spss-sav"],
  ".parquet": ["application/octet-stream", "application/x-parquet"],
  // Image files
  ".png": ["image/png"],
  ".jpg": ["image/jpeg"],
  ".jpeg": ["image/jpeg"],
  ".gif": ["image/gif"],
  ".webp": ["image/webp"],
};

// Maximum file size (100 MB)
export const MAX_FILE_SIZE = 100 * 1024 * 1024;

// File type labels for display
export const FILE_TYPE_LABELS: Record<string, string> = {
  // Data files
  ".csv": "CSV",
  ".xlsx": "Excel",
  ".xls": "Excel",
  ".dta": "Stata",
  ".sav": "SPSS",
  ".parquet": "Parquet",
  // Image files
  ".png": "PNG",
  ".jpg": "JPEG",
  ".jpeg": "JPEG",
  ".gif": "GIF",
  ".webp": "WebP",
};

export interface DataFile {
  file: File;
  id: string;
  status: "pending" | "uploading" | "uploaded" | "error";
  progress?: number;
  error?: string;
  storagePath?: string;
  sandboxPath?: string;
  /** Override size for display (used for library imports where File.size is 0) */
  displaySize?: number;
}

export interface UploadedFileInfo {
  fileId?: string;  // Used for tracking/removal
  filename: string;
  originalFilename: string;
  storagePath: string;
  sandboxPath: string;
  size: number;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(filename: string): string {
  const lastDot = filename.lastIndexOf(".");
  if (lastDot === -1) return "";
  return filename.slice(lastDot).toLowerCase();
}

/**
 * Check if file extension is supported
 */
export function isExtensionSupported(filename: string): boolean {
  const ext = getFileExtension(filename);
  return (ALLOWED_EXTENSIONS as readonly string[]).includes(ext);
}

/**
 * Validate file for upload
 */
export function validateDataFile(file: File): {
  valid: boolean;
  error?: string;
} {
  // Check file extension
  if (!isExtensionSupported(file.name)) {
    const ext = getFileExtension(file.name) || "unknown";
    return {
      valid: false,
      error: `File type "${ext}" is not supported. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}`,
    };
  }

  // Check file size
  if (file.size > MAX_FILE_SIZE) {
    const sizeMB = Math.round(file.size / (1024 * 1024));
    const maxMB = MAX_FILE_SIZE / (1024 * 1024);
    return {
      valid: false,
      error: `File too large (${sizeMB} MB). Maximum size is ${maxMB} MB.`,
    };
  }

  return { valid: true };
}

/**
 * Format file size for display
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Get file type label for display
 */
export function getFileTypeLabel(filename: string): string {
  const ext = getFileExtension(filename);
  return FILE_TYPE_LABELS[ext] || "Data";
}

/**
 * Generate a unique ID for a file
 */
export function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Get accept attribute for file input
 */
export function getAcceptAttribute(): string {
  const mimeTypes = Object.values(ALLOWED_MIME_TYPES).flat();
  const extensions = ALLOWED_EXTENSIONS.map((ext) => ext);
  return [...mimeTypes, ...extensions].join(",");
}

/**
 * Format file info for message attachment
 */
export function formatFilesForMessage(files: UploadedFileInfo[]): string {
  if (files.length === 0) return "";

  const lines = files.map(
    (f) => `- ${f.originalFilename} (${f.sandboxPath})`
  );

  return `\n\n[Uploaded Data Files]\n${lines.join("\n")}`;
}
