"use client";

import { useState, useCallback, useRef, useEffect } from "react";
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
  accessToken?: string | null;
  maxFiles?: number;
  // Note: threadId is no longer required for upload - files are staged independently
  threadId?: string | null;
  autoUpload?: boolean;
}

interface StagedFile {
  fileId: string;
  filename: string;
  size: number;
  sandboxPath: string;
  status: "pending" | "uploading" | "uploaded" | "error";
}

interface UseDataFileUploadReturn {
  // State
  files: DataFile[];
  isUploading: boolean;
  uploadedFiles: UploadedFileInfo[];
  stagedFiles: StagedFile[];  // Files ready to be committed

  // Actions
  addFiles: (fileList: FileList | File[]) => void;
  removeFile: (fileId: string) => void;
  uploadFiles: () => Promise<UploadedFileInfo[]>;
  clearFiles: () => void;
  commitFiles: (threadId: string) => Promise<void>;

  // Input helpers
  inputRef: React.RefObject<HTMLInputElement | null>;
  triggerFileSelect: () => void;
  acceptAttribute: string;
}

/**
 * Hook for managing data file uploads with two-phase upload pattern.
 *
 * Key changes from previous implementation:
 * - Files are uploaded immediately when selected (no thread dependency)
 * - Files are staged in user's space, bound to userId (from JWT)
 * - Thread association happens only when message is sent (commitFiles)
 * - This eliminates empty thread creation and improves UX
 */
export function useDataFileUpload({
  apiUrl,
  accessToken,
  maxFiles = 5,
  threadId,
  autoUpload = true,  // Default to true for immediate upload
}: UseDataFileUploadOptions): UseDataFileUploadReturn {
  const [files, setFiles] = useState<DataFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileInfo[]>([]);
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  // Track which files have been initiated for upload
  const uploadingFileIds = useRef<Set<string>>(new Set());

  /**
   * Get authorization headers
   */
  const getHeaders = useCallback((): Record<string, string> => {
    if (accessToken) {
      return { "Authorization": `Bearer ${accessToken}` };
    }
    return { "X-User-Id": "default" };
  }, [accessToken]);

  /**
   * Initialize upload session for a file (Phase 1)
   */
  const initUpload = useCallback(async (file: File): Promise<{ fileId: string; uploadUrl: string } | null> => {
    try {
      const response = await fetch(`${apiUrl}/uploads/init`, {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          size: file.size,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to initialize upload");
      }

      const data = await response.json();
      return {
        fileId: data.file_id,
        uploadUrl: data.upload_url,
      };
    } catch (error) {
      console.error("Failed to init upload:", error);
      return null;
    }
  }, [apiUrl, getHeaders]);

  /**
   * Upload file data (Phase 2)
   */
  const uploadFileData = useCallback(async (
    fileId: string,
    uploadUrl: string,
    file: File,
  ): Promise<StagedFile | null> => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiUrl}${uploadUrl}`, {
        method: "POST",
        headers: getHeaders(),
        body: formData,
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Upload failed");
      }

      const data = await response.json();
      return {
        fileId: data.file_id,
        filename: data.filename,
        size: data.size,
        sandboxPath: data.sandbox_path,
        status: "uploaded" as const,
      };
    } catch (error) {
      console.error("Failed to upload file data:", error);
      return null;
    }
  }, [apiUrl, getHeaders]);

  /**
   * Upload a single file using two-phase pattern
   */
  const uploadSingleFile = useCallback(async (dataFile: DataFile): Promise<StagedFile | null> => {
    // Prevent duplicate uploads
    if (uploadingFileIds.current.has(dataFile.id)) {
      return null;
    }
    uploadingFileIds.current.add(dataFile.id);

    // Update status to uploading
    setFiles((prev) =>
      prev.map((f) =>
        f.id === dataFile.id ? { ...f, status: "uploading" as const } : f
      )
    );

    try {
      // Phase 1: Initialize upload
      const initResult = await initUpload(dataFile.file);
      if (!initResult) {
        throw new Error("Failed to initialize upload");
      }

      // Phase 2: Upload file data
      const staged = await uploadFileData(
        initResult.fileId,
        initResult.uploadUrl,
        dataFile.file,
      );

      if (!staged) {
        throw new Error("Failed to upload file");
      }

      // Update file status to uploaded
      setFiles((prev) =>
        prev.map((f) =>
          f.id === dataFile.id
            ? {
                ...f,
                status: "uploaded" as const,
                storagePath: staged.sandboxPath,
                sandboxPath: staged.sandboxPath,
              }
            : f
        )
      );

      // Add to staged files
      setStagedFiles((prev) => [...prev, staged]);

      return staged;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Upload failed";

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

      return null;
    } finally {
      uploadingFileIds.current.delete(dataFile.id);
    }
  }, [initUpload, uploadFileData]);

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
      }
    },
    [files, maxFiles]
  );

  /**
   * Remove a file from the queue
   */
  const removeFile = useCallback((fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
    setStagedFiles((prev) => prev.filter((f) => f.fileId !== fileId));
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
      const staged = await uploadSingleFile(dataFile);
      if (staged) {
        results.push({
          filename: staged.filename,
          originalFilename: staged.filename,
          storagePath: staged.sandboxPath,
          sandboxPath: staged.sandboxPath,
          size: staged.size,
        });
      }
    }

    setUploadedFiles(results);
    setIsUploading(false);

    return results;
  }, [files, uploadedFiles, uploadSingleFile]);

  /**
   * Auto-upload pending files when autoUpload is enabled
   * Key difference: No threadId dependency!
   */
  useEffect(() => {
    if (!autoUpload) return;
    if (isUploading) return;
    if (!files.some((f) => f.status === "pending")) return;

    void uploadFiles();
  }, [autoUpload, isUploading, files, uploadFiles]);

  /**
   * Commit staged files to a thread
   * This is called when the message is sent
   */
  const commitFiles = useCallback(async (targetThreadId: string): Promise<void> => {
    const uploadedStaged = stagedFiles.filter((f) => f.status === "uploaded");
    if (uploadedStaged.length === 0) return;

    try {
      const response = await fetch(`${apiUrl}/uploads/commit`, {
        method: "POST",
        headers: {
          ...getHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          file_ids: uploadedStaged.map((f) => f.fileId),
          thread_id: targetThreadId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.detail || "Failed to commit files");
      }

      const data = await response.json();
      if (!data.success) {
        console.warn("Some files failed to commit:", data.errors);
      }
    } catch (error) {
      console.error("Failed to commit files:", error);
      toast.error("Failed to associate files with message", {
        description: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }, [apiUrl, getHeaders, stagedFiles]);

  /**
   * Clear all files
   */
  const clearFiles = useCallback(() => {
    setFiles([]);
    setUploadedFiles([]);
    setStagedFiles([]);
    uploadingFileIds.current.clear();
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
    stagedFiles,
    addFiles,
    removeFile,
    uploadFiles,
    clearFiles,
    commitFiles,
    inputRef,
    triggerFileSelect,
    acceptAttribute: getAcceptAttribute(),
  };
}
