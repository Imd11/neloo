"use client";

import { useMemo } from "react";
import { Loader2, Code2, X, Play, FileCode } from "lucide-react";
import { Sandpack, SandpackProvider, SandpackPreview, SandpackCodeEditor } from "@codesandbox/sandpack-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Artifact, ArtifactType } from "@/lib/artifactParser";

interface ArtifactPreviewProps {
  artifact: Artifact;
  isStreaming: boolean;
  onClose?: () => void;
  className?: string;
}

/**
 * Get Sandpack template based on artifact type.
 */
function getTemplate(type: ArtifactType): "react" | "vue" | "vanilla" {
  switch (type) {
    case "react":
      return "react";
    case "vue":
      return "vue";
    case "html":
    default:
      return "vanilla";
  }
}

/**
 * Get the main file path for the artifact type.
 */
function getMainFile(type: ArtifactType): string {
  switch (type) {
    case "react":
      return "/App.js";
    case "vue":
      return "/src/App.vue";
    case "html":
    default:
      return "/index.html";
  }
}

/**
 * Wrap code with necessary boilerplate for each type.
 */
function wrapCode(type: ArtifactType, code: string): Record<string, string> {
  switch (type) {
    case "react":
      // React: code should be a component with default export
      return {
        "/App.js": code,
      };
    case "vue":
      // Vue: code should be an SFC
      return {
        "/src/App.vue": code,
      };
    case "html":
    default:
      // HTML: wrap in full HTML document if needed
      const isFullDocument = code.toLowerCase().includes("<!doctype") || code.toLowerCase().includes("<html");
      if (isFullDocument) {
        return { "/index.html": code };
      }
      // Wrap fragment in basic HTML structure
      return {
        "/index.html": `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    body { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
${code}
</body>
</html>`,
      };
  }
}

/**
 * Preview panel for rendering artifact code using Sandpack.
 */
export function ArtifactPreview({
  artifact,
  isStreaming,
  onClose,
  className,
}: ArtifactPreviewProps) {
  const template = getTemplate(artifact.type);
  const files = useMemo(() => wrapCode(artifact.type, artifact.code), [artifact.type, artifact.code]);

  // While streaming, show code preview
  if (isStreaming) {
    return (
      <div className={cn("h-full flex flex-col bg-background border-l", className)}>
        {/* Header */}
        <div className="h-12 px-4 flex items-center justify-between border-b bg-muted/30 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-sm font-medium">
              {artifact.title || "Generating..."}
            </span>
          </div>
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        {/* Streaming code display */}
        <div className="flex-1 overflow-auto">
          <pre className="p-4 text-sm font-mono text-muted-foreground whitespace-pre-wrap break-words">
            {artifact.code || "// Waiting for code..."}
          </pre>
        </div>

        {/* Status bar */}
        <div className="h-10 px-4 flex items-center gap-2 border-t bg-muted/30 text-xs text-muted-foreground flex-shrink-0">
          <FileCode className="h-3 w-3" />
          <span>{artifact.type.toUpperCase()}</span>
          <span className="mx-2">|</span>
          <span>Preview will render when complete</span>
        </div>
      </div>
    );
  }

  // Completed artifact: show Sandpack preview
  return (
    <div className={cn("h-full flex flex-col bg-background border-l", className)}>
      {/* Header */}
      <div className="h-12 px-4 flex items-center justify-between border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Code2 className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">
            {artifact.title || "Preview"}
          </span>
          <span className="text-xs text-muted-foreground px-2 py-0.5 bg-muted rounded">
            {artifact.type}
          </span>
        </div>
        {onClose && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Sandpack preview */}
      <div className="flex-1 min-h-0">
        <Sandpack
          template={template}
          files={files}
          theme="auto"
          options={{
            showConsole: true,
            showConsoleButton: true,
            showTabs: true,
            showLineNumbers: true,
            showRefreshButton: true,
            editorHeight: "100%",
            classes: {
              "sp-wrapper": "!h-full",
              "sp-layout": "!h-full !rounded-none !border-0",
            },
          }}
          customSetup={{
            dependencies: {
              // Common dependencies for React projects
              ...(template === "react" && {
                "react": "^18.0.0",
                "react-dom": "^18.0.0",
              }),
            },
          }}
        />
      </div>
    </div>
  );
}

/**
 * Simple preview-only component (no code editor).
 */
export function ArtifactPreviewOnly({
  artifact,
  className,
}: {
  artifact: Artifact;
  className?: string;
}) {
  const template = getTemplate(artifact.type);
  const files = useMemo(() => wrapCode(artifact.type, artifact.code), [artifact.type, artifact.code]);

  return (
    <div className={cn("h-full", className)}>
      <SandpackProvider
        template={template}
        files={files}
        theme="auto"
      >
        <SandpackPreview
          showRefreshButton
          showOpenInCodeSandbox={false}
          style={{ height: "100%" }}
        />
      </SandpackProvider>
    </div>
  );
}
