"use client";

import React, { useCallback, useMemo, useState } from "react";
import { Loader2, Send } from "lucide-react";
import { toast } from "sonner";
import { useQueryState } from "nuqs";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatFilesForMessage } from "@/lib/data-file-utils";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";
import { useClient } from "@/providers/ClientProvider";
import { useDataFileUpload } from "@/app/hooks/useDataFileUpload";
import { DataFileUpload } from "@/app/components/DataFileUpload";

interface ChatInputProps {
  onSubmit: (content: string) => void;
  isLoading: boolean;
  disabled?: boolean;
  assistant?: any;
}

export function ChatInput({
  onSubmit,
  isLoading,
  disabled = false,
}: ChatInputProps) {
  const config = getConfig();
  const apiUrl = config?.deploymentUrl || "";
  const { session } = useAuth();
  const client = useClient();

  const [threadId, setThreadId] = useQueryState("threadId");
  const [input, setInput] = useState("");

  // Note: With the new two-phase upload, files upload immediately without thread dependency
  const fileUpload = useDataFileUpload({
    apiUrl,
    accessToken: session?.access_token,
    maxFiles: 5,
    threadId,  // Still passed but not required for upload
    autoUpload: true,  // Files upload immediately when selected
  });

  const ensureThreadId = useCallback(async (): Promise<string> => {
    if (threadId) return threadId;
    const created = await client.threads.create({});
    const id =
      (created as any)?.thread_id ||
      (created as any)?.threadId ||
      (created as any)?.id;
    if (!id || typeof id !== "string") {
      throw new Error("Failed to create thread");
    }
    setThreadId(id);
    return id;
  }, [client, threadId, setThreadId]);

  const pendingCount = useMemo(
    () => fileUpload.files.filter((f) => f.status === "pending").length,
    [fileUpload.files]
  );

  const uploadingCount = useMemo(
    () => fileUpload.files.filter((f) => f.status === "uploading").length,
    [fileUpload.files]
  );

  const hasFiles = fileUpload.files.length > 0;
  const hasPendingOrUploading = fileUpload.isUploading || pendingCount > 0 || uploadingCount > 0;
  const submitDisabled =
    disabled || isLoading || hasPendingOrUploading || (!input.trim() && !hasFiles);

  const handleFileInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const selected = e.target.files;
      if (!selected || selected.length === 0) return;

      // Copy files before clearing the input value
      const fileArray = Array.from(selected);

      // Clear input value to allow selecting the same file again
      e.target.value = "";

      // Add files - they will auto-upload immediately (no thread dependency)
      fileUpload.addFiles(fileArray);
    },
    [fileUpload]
  );

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (submitDisabled) return;

      if (fileUpload.isUploading || pendingCount > 0 || uploadingCount > 0) {
        toast.message("Uploading files...", {
          description: "Please wait for uploads to finish before sending.",
        });
        return;
      }

      try {
        // Ensure thread exists before sending message
        const currentThreadId = await ensureThreadId();

        // Commit staged files to the thread (associates files with thread)
        if (fileUpload.stagedFiles.length > 0) {
          await fileUpload.commitFiles(currentThreadId);
        }

        // Build message content with file references
        const uploadedFiles = fileUpload.uploadedFiles;
        let messageContent = input.trim();
        if (uploadedFiles.length > 0) {
          messageContent += formatFilesForMessage(uploadedFiles);
        }

        onSubmit(messageContent);
        setInput("");
        fileUpload.clearFiles();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        toast.error("Failed to send message", { description: message });
      }
    },
    [submitDisabled, fileUpload, input, onSubmit, pendingCount, uploadingCount, ensureThreadId]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (!submitDisabled) {
          handleSubmit(e as unknown as React.FormEvent);
        }
      }
    },
    [submitDisabled, handleSubmit]
  );

  return (
    <div className="mx-auto w-full max-w-4xl px-3 py-4 md:px-4">
      <input
        id="data-file-input"
        ref={fileUpload.inputRef}
        type="file"
        multiple
        accept={fileUpload.acceptAttribute}
        onChange={handleFileInputChange}
        className="sr-only"
      />

      <form
        onSubmit={handleSubmit}
        className={cn(
          "rounded-2xl border bg-muted/30 p-3 shadow-sm",
          disabled && "opacity-70"
        )}
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Write your message..."
          className="min-h-[80px] w-full resize-none rounded-xl bg-transparent p-2 text-sm outline-none"
          disabled={disabled || isLoading}
        />

        <div className="mt-2 flex items-center justify-between gap-3">
          <DataFileUpload
            files={fileUpload.files}
            isUploading={fileUpload.isUploading}
            onTriggerSelect={() => {
              // IMPORTANT: file picker must be opened synchronously from a user gesture.
              // Use getElementById for more reliable element lookup
              const input = document.getElementById('data-file-input') as HTMLInputElement;
              input?.click();
            }}
            onRemoveFile={fileUpload.removeFile}
            disabled={disabled || isLoading}
          />

          <Button type="submit" disabled={submitDisabled} className="gap-2">
            {fileUpload.isUploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
