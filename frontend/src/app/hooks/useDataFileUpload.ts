"use client";

import { useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import {
  DataFile,
  UploadedFileInfo,
  validateDataFile,
  generateFileId,
  getAcceptAttribute,
} from "@/lib/data-file-utils";

interface UseDataFileUploadOptions {
  apiUrl: string;
  userId?: string;
  maxFiles?: number;
}

interface UseDataFileUploadReturn {
  // State
  files: DataFile[];
  isUploading: boolean;
  uploadedFiles: UploadedFileInfo[];

  // Actions
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (fileId: string) => void;
  uploadFiles: () => Promise<UploadedFileInfo[]>;
  clearFiles: () => void;

  // Input helpers
  inputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: () => void;
  acceptAttribute: string;
}

/**
 * Hook for managing data file uploads
 *
 * Handles file validation, upload to backend, and state management.
 */
export function useDataFileUpload({
  apiUrl,
  userId,
  maxFiles = 5,
}: UseDataFileUploadOptions): UseDataFileUploadReturn {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  /**
   * Add files to the upload queue
   */
  const addFiles = useCallback(
    (fileList: FileList | File[]) => {
      const newFiles: DataFile[] = [];
      const errors: string[] = [];

      const fileArray = Array.from(fileList);

      // Check total file count
      if (files.length + fileArray.length > maxFiles) {
        toast.error("Too many files", {
          description: `Maximum ${maxFiles} files allowed. You have ${files.length} file(s) already.`,
        });
        return;
      }

      for (const file of fileArray) {
        const validation = validateDataFile(file);

        if (!validation.valid) {
          errors.push(`${file.name}: ${validation.error}`);
          continue;
        }

        // Check for duplicates
        const isDuplicate = files.some((f) => f.file.name === file.name);
        if (isDuplicate) {
          errors.push(`${file.name}: File already added`);
          continue;
        }

        newFiles.push({
          file,
          id: generateFileId(),
          status: "pending",
        });
      }

      if (errors.length > 0) {
        toast.error("Some files could not be added", {
          description: errors.join("; "),
        });
      }

      if (newFiles.length > 0) {
        setFiles((prev) => [...prev, ...newFiles]);
        toast.success("Files added", {
          description: `${newFiles.length} file(s) ready for upload`,
        });
      }
    },
    [files, maxFiles]
  );

  /**
   * Remove a file from the queue
   */
  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setUploadedFiles((prev) =>
      prev.filter((f) => !f.filename.includes(fileId))
    );
  }, []);

  /**
   * Upload all pending files
   */
  const uploadFiles = useCallback(async (): Promise<UploadedFileInfo[]> => {
    const pendingFiles = files.filter((f) => f.status === "pending");

    if (pendingFiles.length === 0) {
      return uploadedFiles;
    }

    setIsUploading(true);
    const results: UploadedFileInfo[] = [...uploadedFiles];

    for (const dataFile of pendingFiles) {
      // Update status to uploading
      setFiles((prev) =>
        prev.map((f) =>
          f.id === dataFile.id ? { ...f, status: "uploading" as const } : f
        )
      );

      try {
        const formData = new FormData();
        formData.append("file", dataFile.file);

        const response = await fetch(`${apiUrl}/files/upload`, {
          method: "POST",
          headers: userId ? { "X-User-Id": userId } : undefined,
          body: formData,
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || "Upload failed");
        }

        const result = await response.json();

        // Update status to uploaded
        setFiles((prev) =>
          prev.map((f) =>
            f.id === dataFile.id
              ? {
                  ...f,
                  status: "uploaded" as const,
                  storagePath: result.storage_path,
                  sandboxPath: result.sandbox_path,
                }
              : f
          )
        );

        const uploadedFile: UploadedFileInfo = {
          filename: result.filename,
          originalFilename: result.original_filename,
          storagePath: result.storage_path,
          sandboxPath: result.sandbox_path,
          size: result.size,
        };

        results.push(uploadedFile);
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Upload failed";

        // Update status to error
        setFiles((prev) =>
          prev.map((f) =>
            f.id === dataFile.id
              ? { ...f, status: "error" as const, error: errorMessage }
              : f
          )
        );

        toast.error(`Failed to upload ${dataFile.file.name}`, {
          description: errorMessage,
        });
      }
    }

    setUploadedFiles(results);
    setIsUploading(false);

    return results;
  }, [files, uploadedFiles, apiUrl, userId]);

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadedFiles([]);
  }, []);

  /**
   * Trigger file selection dialog
   */
  const triggerFileSelect = useCallback(() => {
    inputRef.current?.click();
  }, []);

  return {
    files,
    isUploading,
    uploadedFiles,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles,
    inputRef,
    triggerFileSelect,
    acceptAttribute: getAcceptAttribute(),
  };
}
