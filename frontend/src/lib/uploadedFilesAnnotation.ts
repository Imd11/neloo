/**
 * Uploaded Files Annotation Parser
 *
 * Utilities for parsing and stripping the [Uploaded Data Files] block
 * from message content for cleaner UI display.
 *
 * These functions are UI-only and do not affect backend logic.
 */

import { getFileTypeLabel } from "./data-file-utils";

export interface ParsedAttachment {
  filename: string;
  ext?: string;
  type?: string;
}

/**
 * Regex pattern to match the [Uploaded Data Files] block.
 * Matches from the marker to end of string.
 */
const UPLOADED_FILES_BLOCK_REGEX = /\n\n\[Uploaded Data Files\]\n([\s\S]*?)$/;

/**
 * Regex pattern to parse individual file lines.
 * Format: "- filename.ext (/path/to/file)"
 */
const FILE_LINE_REGEX = /^- (.+?) \(([^)]+)\)$/;

/**
 * Strip the [Uploaded Data Files] annotation block from message content.
 * Returns the clean user prompt without file annotations.
 *
 * Only strips if the block structure is strictly detected to avoid
 * accidentally removing user content.
 *
 * @param text - The full message content
 * @returns Clean text without the annotation block
 */
export function stripUploadedFilesAnnotation(text: string): string {
  if (!text) return text;

  const match = text.match(UPLOADED_FILES_BLOCK_REGEX);
  if (!match) {
    return text;
  }

  // Remove the block and trim
  return text.replace(UPLOADED_FILES_BLOCK_REGEX, "").trim();
}

/**
 * Parse the [Uploaded Data Files] annotation block to extract file info.
 * Returns an array of attachment objects with filename and optional extension.
 *
 * Only parses if the block structure is strictly detected.
 * If parsing fails, returns empty array (UI won't show attachment area).
 *
 * @param text - The full message content
 * @returns Array of parsed attachments
 */
export function parseUploadedFilesAnnotation(text: string): ParsedAttachment[] {
  if (!text) return [];

  const match = text.match(UPLOADED_FILES_BLOCK_REGEX);
  if (!match) {
    return [];
  }

  const blockContent = match[1];
  const lines = blockContent.split("\n").filter((line) => line.startsWith("- "));

  const attachments: ParsedAttachment[] = [];

  for (const line of lines) {
    const lineMatch = line.match(FILE_LINE_REGEX);
    if (lineMatch) {
      const filename = lineMatch[1];
      // Extract extension from filename
      const lastDot = filename.lastIndexOf(".");
      const ext = lastDot !== -1 ? filename.slice(lastDot).toLowerCase() : undefined;
      const type = ext ? getFileTypeLabel(filename) : undefined;

      attachments.push({
        filename,
        ext,
        type,
      });
    } else if (line.startsWith("- ")) {
      // Fallback: just extract filename without path
      const filename = line.slice(2).trim();
      attachments.push({ filename });
    }
  }

  return attachments;
}

/**
 * Check if a message contains the [Uploaded Data Files] annotation block.
 *
 * @param text - The message content to check
 * @returns true if the block is present
 */
export function hasUploadedFilesAnnotation(text: string): boolean {
  if (!text) return false;
  return UPLOADED_FILES_BLOCK_REGEX.test(text);
}
