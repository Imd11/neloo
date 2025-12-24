"use client";

import React, { useState, useMemo, useCallback } from "react";
import {
  ChevronDown,
  ChevronUp,
  Terminal,
  AlertCircle,
  Loader2,
  CircleCheckBigIcon,
  StopCircle,
  Download,
  FileIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ToolCall, ActionRequest, ReviewConfig } from "@/app/types/types";
import { cn } from "@/lib/utils";
import { LoadExternalComponent } from "@langchain/langgraph-sdk/react-ui";
import { ToolApprovalInterrupt } from "@/app/components/ToolApprovalInterrupt";
import { MarkdownContent } from "@/app/components/MarkdownContent";
import { getConfig } from "@/lib/config";

// Interface for generated files from execute_python
interface GeneratedFile {
  filename: string;
  size?: number;
  sandbox_path?: string;
  download_url?: string;  // New format: /generated-files/{file_id}?sig={signature}
  file_id?: string;
  content_type?: string;
}

// Helper to format file size
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Helper to parse generated files from execute_python result
function parseGeneratedFiles(result: any): GeneratedFile[] {
  if (!result) return [];

  try {
    // Result might be a string (JSON) or already parsed
    const parsed = typeof result === 'string' ? JSON.parse(result) : result;
    if (parsed && Array.isArray(parsed.generated_files)) {
      return parsed.generated_files;
    }
  } catch {
    // Not JSON or doesn't have generated_files
  }
  return [];
}

interface ToolCallBoxProps {
  toolCall: ToolCall;
  uiComponent?: any;
  stream?: any;
  graphId?: string;
  actionRequest?: ActionRequest;
  reviewConfig?: ReviewConfig;
  onResume?: (value: any) => void;
  isLoading?: boolean;
}

export const ToolCallBox = React.memo<ToolCallBoxProps>(
  ({
    toolCall,
    uiComponent,
    stream,
    graphId,
    actionRequest,
    reviewConfig,
    onResume,
    isLoading,
  }) => {
    const [isExpanded, setIsExpanded] = useState(
      () => !!uiComponent || !!actionRequest
    );
    const [expandedArgs, setExpandedArgs] = useState<Record<string, boolean>>(
      {}
    );

    const { name, args, result, status } = useMemo(() => {
      return {
        name: toolCall.name || "Unknown Tool",
        args: toolCall.args || {},
        result: toolCall.result,
        status: toolCall.status || "completed",
      };
    }, [toolCall]);

    // Parse generated files for execute_python results
    const generatedFiles = useMemo(() => {
      if (name === "execute_python") {
        return parseGeneratedFiles(result);
      }
      return [];
    }, [name, result]);

    // Get download URL for a file - supports both old sandbox_path and new download_url format
    const getFileDownloadUrl = useCallback((file: GeneratedFile) => {
      const config = getConfig();
      const baseUrl = config?.deploymentUrl || "";
      // Remove trailing slash and /api suffix if present
      const cleanBaseUrl = baseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");

      // If file has download_url (new format with signature), use it
      if (file.download_url) {
        return `${cleanBaseUrl}${file.download_url}`;
      }

      // Fallback to old sandbox/files endpoint for backwards compatibility
      return `${cleanBaseUrl}/sandbox/files/${encodeURIComponent(file.filename)}`;
    }, []);

    const statusIcon = useMemo(() => {
      switch (status) {
        case "completed":
          return <CircleCheckBigIcon />;
        case "error":
          return (
            <AlertCircle
              size={14}
              className="text-destructive"
            />
          );
        case "pending":
          return (
            <Loader2
              size={14}
              className="animate-spin"
            />
          );
        case "interrupted":
          return (
            <StopCircle
              size={14}
              className="text-orange-500"
            />
          );
        default:
          return (
            <Terminal
              size={14}
              className="text-muted-foreground"
            />
          );
      }
    }, [status]);

    const toggleExpanded = useCallback(() => {
      setIsExpanded((prev) => !prev);
    }, []);

    const toggleArgExpanded = useCallback((argKey: string) => {
      setExpandedArgs((prev) => ({
        ...prev,
        [argKey]: !prev[argKey],
      }));
    }, []);

    const hasContent = result || Object.keys(args).length > 0;

    return (
      <div
        className={cn(
          "w-full overflow-hidden rounded-lg border-none shadow-none outline-none transition-colors duration-200 hover:bg-accent",
          isExpanded && hasContent && "bg-accent"
        )}
      >
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleExpanded}
          className={cn(
            "flex w-full items-center justify-between gap-2 border-none px-2 py-2 text-left shadow-none outline-none focus-visible:ring-0 focus-visible:ring-offset-0 disabled:cursor-default"
          )}
          disabled={!hasContent}
        >
          <div className="flex w-full items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {statusIcon}
              <span className="text-[15px] font-medium tracking-[-0.6px] text-foreground">
                {name}
              </span>
            </div>
            {hasContent &&
              (isExpanded ? (
                <ChevronUp
                  size={14}
                  className="shrink-0 text-muted-foreground"
                />
              ) : (
                <ChevronDown
                  size={14}
                  className="shrink-0 text-muted-foreground"
                />
              ))}
          </div>
        </Button>

        {isExpanded && hasContent && (
          <div className="px-4 pb-4">
            {uiComponent && stream && graphId ? (
              <div className="mt-4">
                <LoadExternalComponent
                  key={uiComponent.id}
                  stream={stream}
                  message={uiComponent}
                  namespace={graphId}
                  meta={{ status, args, result: result ?? "No Result Yet" }}
                />
              </div>
            ) : actionRequest && onResume ? (
              // Show tool approval UI when there's an action request but no GenUI
              <div className="mt-4">
                <ToolApprovalInterrupt
                  actionRequest={actionRequest}
                  reviewConfig={reviewConfig}
                  onResume={onResume}
                  isLoading={isLoading}
                />
              </div>
            ) : (
              <>
                {Object.keys(args).length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Arguments
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(args).map(([key, value]) => (
                        <div
                          key={key}
                          className="rounded-sm border border-border"
                        >
                          <button
                            onClick={() => toggleArgExpanded(key)}
                            className="flex w-full items-center justify-between bg-muted/30 p-2 text-left text-xs font-medium transition-colors hover:bg-muted/50"
                          >
                            <span className="font-mono">{key}</span>
                            {expandedArgs[key] ? (
                              <ChevronUp
                                size={12}
                                className="text-muted-foreground"
                              />
                            ) : (
                              <ChevronDown
                                size={12}
                                className="text-muted-foreground"
                              />
                            )}
                          </button>
                          {expandedArgs[key] && (
                            <div className="border-t border-border bg-muted/20 p-2">
                              <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs leading-6 text-foreground">
                                {typeof value === "string"
                                  ? value
                                  : JSON.stringify(value, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result && (
                  <div className="mt-4">
                    <h4 className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Result
                    </h4>
                    {/* Use MarkdownContent for execute_python to render images */}
                    {name === "execute_python" && typeof result === "string" ? (
                      <div className="rounded-sm border border-border bg-muted/40 p-2">
                        <MarkdownContent content={result} />
                      </div>
                    ) : (
                      <pre className="m-0 overflow-x-auto whitespace-pre-wrap break-all rounded-sm border border-border bg-muted/40 p-2 font-mono text-xs leading-7 text-foreground">
                        {typeof result === "string"
                          ? result
                          : JSON.stringify(result, null, 2)}
                      </pre>
                    )}
                  </div>
                )}
                {/* Generated Files Section */}
                {generatedFiles.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Generated Files
                    </h4>
                    <div className="space-y-2">
                      {generatedFiles.map((file) => (
                        <a
                          key={file.file_id || file.filename}
                          href={getFileDownloadUrl(file)}
                          download={file.filename}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-3 rounded-md border border-border bg-muted/30 p-2 transition-colors hover:bg-muted/50"
                        >
                          <FileIcon size={16} className="shrink-0 text-muted-foreground" />
                          <div className="flex-1 min-w-0">
                            <div className="truncate text-sm font-medium text-foreground">
                              {file.filename}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {file.size ? formatFileSize(file.size) : file.content_type || "File"}
                            </div>
                          </div>
                          <Download size={16} className="shrink-0 text-muted-foreground" />
                        </a>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  }
);

ToolCallBox.displayName = "ToolCallBox";
