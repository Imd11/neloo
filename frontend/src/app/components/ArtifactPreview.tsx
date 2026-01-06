"use client";

import { useMemo, useState, useEffect, useRef } from "react";
import {
  Loader2,
  Code2,
  X,
  Eye,
  Upload,
  ExternalLink,
  Copy,
  Check,
  Maximize2,
  RefreshCw,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  SandpackProvider,
  SandpackPreview,
} from "@codesandbox/sandpack-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Artifact, ArtifactType } from "@/lib/artifactParser";

interface ArtifactPreviewProps {
  artifact: Artifact;
  isStreaming: boolean;
  onClose?: () => void;
  className?: string;
}

type ViewMode = "code" | "preview";

/**
 * Get Sandpack template based on artifact type.
 * Use "static" for HTML to avoid default index.js execution issues.
 */
function getTemplate(type: ArtifactType): "react" | "vue" | "static" {
  switch (type) {
    case "react":
      return "react";
    case "vue":
      return "vue";
    case "html":
    default:
      return "static";
  }
}

/**
 * Wrap code with necessary boilerplate for each type.
 */
function wrapCode(type: ArtifactType, code: string): Record<string, string> {
  switch (type) {
    case "react":
      return { "/App.js": code };
    case "vue":
      return { "/src/App.vue": code };
    case "html":
    default:
      const isFullDocument =
        code.toLowerCase().includes("<!doctype") ||
        code.toLowerCase().includes("<html");

      if (isFullDocument) {
        let processedCode = code;
        if (
          code.includes('getElementById("app")') ||
          code.includes("getElementById('app')")
        ) {
          if (!code.includes('id="app"') && !code.includes("id='app'")) {
            processedCode = code.replace(
              /<body([^>]*)>/i,
              '<body$1>\n<div id="app"></div>'
            );
          }
        }
        return { "/index.html": processedCode };
      }

      const isJavaScript =
        code.trim().startsWith("//") ||
        code.includes("document.") ||
        code.includes("function ") ||
        code.includes("const ") ||
        code.includes("let ") ||
        code.includes("var ");

      if (isJavaScript) {
        return {
          "/index.html": `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; font-family: system-ui, sans-serif; }</style>
</head>
<body>
  <div id="app"></div>
  <div id="root"></div>
  <script>${code}</script>
</body>
</html>`,
        };
      }

      return {
        "/index.html": `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>body { margin: 0; padding: 1rem; font-family: system-ui, sans-serif; }</style>
</head>
<body>${code}</body>
</html>`,
      };
  }
}

/**
 * Enhanced Artifact Preview Panel
 *
 * Features:
 * - Code/Preview tab switching
 * - Streaming code display with live preview
 * - Copy code button
 * - Deploy button (placeholder)
 * - Fullscreen preview
 */
export function ArtifactPreview({
  artifact,
  isStreaming,
  onClose,
  className,
}: ArtifactPreviewProps) {
  // Default to preview mode when complete, code mode when streaming
  const [viewMode, setViewMode] = useState<ViewMode>(
    isStreaming ? "code" : "preview"
  );
  const [copied, setCopied] = useState(false);
  const [sandpackKey, setSandpackKey] = useState(0);
  const codeRef = useRef<HTMLPreElement>(null);
  // Track if we've already auto-switched to preview (to avoid forcing user back)
  const hasAutoSwitchedRef = useRef(false);
  // Track previous isStreaming state to detect transition
  const prevIsStreamingRef = useRef(isStreaming);

  const template = getTemplate(artifact.type);
  const files = useMemo(
    () => wrapCode(artifact.type, artifact.code),
    [artifact.type, artifact.code]
  );

  // Auto-switch to preview when streaming completes (only once)
  useEffect(() => {
    // Detect streaming -> complete transition
    const justFinishedStreaming = prevIsStreamingRef.current && !isStreaming;
    prevIsStreamingRef.current = isStreaming;

    // Only auto-switch if:
    // 1. Streaming just finished (transition from true to false)
    // 2. We haven't already auto-switched
    // 3. We're currently in code view
    if (justFinishedStreaming && !hasAutoSwitchedRef.current && viewMode === "code") {
      const timer = setTimeout(() => {
        setViewMode("preview");
        hasAutoSwitchedRef.current = true;
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isStreaming, viewMode]);

  // Reset auto-switch flag when artifact changes (new artifact)
  useEffect(() => {
    hasAutoSwitchedRef.current = false;
    prevIsStreamingRef.current = isStreaming;
  }, [artifact.id]);

  // Auto-scroll code during streaming
  useEffect(() => {
    if (isStreaming && codeRef.current && viewMode === "code") {
      codeRef.current.scrollTop = codeRef.current.scrollHeight;
    }
  }, [artifact.code, isStreaming, viewMode]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleRefresh = () => {
    setSandpackKey((k) => k + 1);
  };

  const handleOpenInNewTab = () => {
    // Create a blob URL for the HTML content
    const htmlContent = files["/index.html"] || files["/App.js"] || "";
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    window.open(url, "_blank");
  };

  return (
    <div
      className={cn("h-full flex flex-col bg-background border-l", className)}
    >
      {/* Header with tabs */}
      <div className="h-12 px-3 flex items-center justify-between border-b bg-muted/30 flex-shrink-0">
        <div className="flex items-center gap-2">
          {/* Icon based on status */}
          {isStreaming ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : (
            <Code2 className="h-4 w-4 text-primary" />
          )}
          <span className="text-sm font-medium truncate max-w-[150px]">
            {artifact.title || (isStreaming ? "生成中..." : "预览")}
          </span>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-0.5">
          <button
            onClick={() => setViewMode("code")}
            className={cn(
              "px-3 py-1 text-xs font-medium rounded-md transition-colors",
              viewMode === "code"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            代码
          </button>
          <TooltipProvider delayDuration={0}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => !isStreaming && setViewMode("preview")}
                  className={cn(
                    "px-3 py-1 text-xs font-medium rounded-md transition-colors",
                    viewMode === "preview"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                    isStreaming && "opacity-50 cursor-not-allowed"
                  )}
                >
                  预览
                </button>
              </TooltipTrigger>
              {isStreaming && (
                <TooltipContent side="bottom">
                  预览将在生成完成后可用
                </TooltipContent>
              )}
            </Tooltip>
          </TooltipProvider>
        </div>

        {/* Action buttons */}
        <div className="flex items-center gap-1">
          {/* Copy button */}
          <Button
            variant="ghost"
            size="icon"
            onClick={handleCopy}
            className="h-7 w-7"
            title="复制代码"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
          </Button>

          {/* Refresh preview */}
          {viewMode === "preview" && !isStreaming && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleRefresh}
              className="h-7 w-7"
              title="刷新预览"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Open in new tab */}
          {!isStreaming && (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleOpenInNewTab}
              className="h-7 w-7"
              title="在新标签页打开"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Deploy button (placeholder) */}
          {!isStreaming && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 gap-1 text-xs"
              title="部署 (即将推出)"
              disabled
            >
              <Upload className="h-3.5 w-3.5" />
              部署
            </Button>
          )}

          {/* Close button */}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content area */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {viewMode === "code" ? (
          /* Code view */
          <div className="h-full flex flex-col">
            {/* Code display */}
            <pre
              ref={codeRef}
              className="flex-1 p-4 text-sm font-mono bg-zinc-900 text-zinc-100 overflow-auto whitespace-pre-wrap break-words"
            >
              {artifact.code || "// 等待代码..."}
            </pre>
            {/* Type badge */}
            <div className="px-4 py-2 border-t bg-muted/30 flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-0.5 bg-muted rounded font-medium">
                {artifact.type.toUpperCase()}
              </span>
            </div>
          </div>
        ) : (
          /* Preview view - only show preview, no code editor */
          <div className="h-full sandpack-preview-container">
            <SandpackProvider
              key={sandpackKey}
              template={template}
              files={files}
              theme="auto"
              customSetup={{
                dependencies: {
                  ...(template === "react" && {
                    react: "^18.0.0",
                    "react-dom": "^18.0.0",
                  }),
                },
              }}
            >
              <SandpackPreview
                showRefreshButton={false}
                showOpenInCodeSandbox={false}
                style={{ height: "100%" }}
              />
            </SandpackProvider>
            <style jsx global>{`
              .sandpack-preview-container .sp-wrapper,
              .sandpack-preview-container .sp-layout,
              .sandpack-preview-container .sp-stack,
              .sandpack-preview-container .sp-preview,
              .sandpack-preview-container .sp-preview-container,
              .sandpack-preview-container .sp-preview-iframe {
                height: 100% !important;
              }
              .sandpack-preview-container .sp-preview-actions {
                display: none !important;
              }
            `}</style>
          </div>
        )}
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
  const files = useMemo(
    () => wrapCode(artifact.type, artifact.code),
    [artifact.type, artifact.code]
  );

  return (
    <div className={cn("h-full", className)}>
      <SandpackProvider template={template} files={files} theme="auto">
        <SandpackPreview
          showRefreshButton
          showOpenInCodeSandbox={false}
          style={{ height: "100%" }}
        />
      </SandpackProvider>
    </div>
  );
}
