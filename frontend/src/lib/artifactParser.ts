/**
 * Artifact Parser
 *
 * Parses <artifact> tags from AI responses for rendering in the preview panel.
 *
 * Format:
 * <artifact type="react" title="Component Name">
 * // code here
 * </artifact>
 *
 * Supported types: react, html, vue
 */

export type ArtifactType = "react" | "html" | "vue";

export interface Artifact {
  id: string;
  type: ArtifactType;
  title?: string;
  code: string;
}

/**
 * Regex to match complete <artifact> blocks.
 * Captures: type, optional title, code content
 */
const ARTIFACT_REGEX =
  /<artifact\s+type="(\w+)"(?:\s+title="([^"]*)")?\s*>([\s\S]*?)<\/artifact>/g;

/**
 * Regex to detect an opening <artifact> tag (for streaming detection).
 */
const ARTIFACT_OPEN_REGEX = /<artifact\s+type="(\w+)"(?:\s+title="([^"]*)")?\s*>/;

/**
 * Parse all complete artifacts from content.
 *
 * @param content - The full message content from AI
 * @returns Array of parsed artifacts
 */
export function parseArtifacts(content: string): Artifact[] {
  const artifacts: Artifact[] = [];
  let match;

  // Reset regex lastIndex to ensure fresh matching
  ARTIFACT_REGEX.lastIndex = 0;

  while ((match = ARTIFACT_REGEX.exec(content)) !== null) {
    const type = match[1] as ArtifactType;
    const title = match[2] || undefined;
    const code = match[3].trim();

    // Validate type
    if (type === "react" || type === "html" || type === "vue") {
      artifacts.push({
        id: crypto.randomUUID(),
        type,
        title,
        code,
      });
    }
  }

  return artifacts;
}

/**
 * Check if content contains an artifact that is still being streamed
 * (has opening tag but no closing tag).
 *
 * @param content - The message content being streamed
 * @returns Object with streaming state and partial artifact info
 */
export function getStreamingArtifact(content: string): {
  isStreaming: boolean;
  type?: ArtifactType;
  title?: string;
  partialCode?: string;
} {
  // Count opening and closing tags
  const openMatches = content.match(/<artifact\s+type="\w+"(?:\s+title="[^"]*")?\s*>/g) || [];
  const closeMatches = content.match(/<\/artifact>/g) || [];

  // If there are more opens than closes, we have a streaming artifact
  if (openMatches.length > closeMatches.length) {
    // Find the last unclosed <artifact> tag
    const lastOpenIndex = content.lastIndexOf("<artifact");
    if (lastOpenIndex === -1) {
      return { isStreaming: false };
    }

    const afterOpen = content.substring(lastOpenIndex);
    const openMatch = ARTIFACT_OPEN_REGEX.exec(afterOpen);

    if (openMatch) {
      const type = openMatch[1] as ArtifactType;
      const title = openMatch[2] || undefined;

      // Extract partial code (everything after the opening tag)
      const codeStart = afterOpen.indexOf(">") + 1;
      const partialCode = afterOpen.substring(codeStart);

      return {
        isStreaming: true,
        type,
        title,
        partialCode,
      };
    }
  }

  return { isStreaming: false };
}

/**
 * Check if all artifacts in content are complete (closed).
 *
 * @param content - The message content
 * @returns true if all artifacts are complete
 */
export function isArtifactComplete(content: string): boolean {
  const openCount = (content.match(/<artifact/g) || []).length;
  const closeCount = (content.match(/<\/artifact>/g) || []).length;
  return openCount === closeCount;
}

/**
 * Extract the last artifact from content (for preview panel).
 * Returns the most recently completed artifact, or the streaming artifact if incomplete.
 *
 * @param content - The message content
 * @param isStreaming - Whether the message is still being streamed
 * @returns The artifact to display, or null if none
 */
export function getLatestArtifact(
  content: string,
  isStreaming: boolean
): { artifact: Artifact | null; isComplete: boolean } {
  // First check for streaming artifact
  if (isStreaming) {
    const streamingInfo = getStreamingArtifact(content);
    if (streamingInfo.isStreaming && streamingInfo.type) {
      return {
        artifact: {
          id: "streaming",
          type: streamingInfo.type,
          title: streamingInfo.title,
          code: streamingInfo.partialCode || "",
        },
        isComplete: false,
      };
    }
  }

  // Get all complete artifacts and return the last one
  const artifacts = parseArtifacts(content);
  if (artifacts.length > 0) {
    return {
      artifact: artifacts[artifacts.length - 1],
      isComplete: true,
    };
  }

  return { artifact: null, isComplete: true };
}

/**
 * Remove artifact tags from content for display in chat.
 * Handles both complete and streaming (unclosed) artifacts.
 *
 * @param content - The message content
 * @param placeholder - Optional replacement text (empty string to hide completely)
 * @returns Content with artifact tags removed/replaced
 */
export function stripArtifacts(
  content: string,
  placeholder: string = ""
): string {
  // First, remove complete artifacts
  ARTIFACT_REGEX.lastIndex = 0;
  let result = content.replace(ARTIFACT_REGEX, placeholder);

  // Then, remove any streaming (unclosed) artifact
  // This handles the case where <artifact ...> is open but </artifact> hasn't arrived yet
  const streamingInfo = getStreamingArtifact(result);
  if (streamingInfo.isStreaming) {
    // Find the last unclosed <artifact> tag and remove everything from there
    const lastOpenIndex = result.lastIndexOf("<artifact");
    if (lastOpenIndex !== -1) {
      result = result.substring(0, lastOpenIndex) + placeholder;
    }
  }

  // Clean up: trim trailing whitespace and empty lines
  return result.trim();
}
