"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { cn } from "@/lib/utils";
import { CheckIcon, CopyIcon, Download, Loader2 } from "lucide-react";

// Import KaTeX CSS for math rendering
import "katex/dist/katex.min.css";

interface MarkdownContentProps {
  content: string;
  className?: string;
}

/**
 * Enhanced Markdown Content Component
 *
 * Features:
 * - GitHub Flavored Markdown (GFM)
 * - KaTeX math formula rendering (inline $...$ and block $$...$$)
 * - Syntax highlighting for code blocks
 * - Image download button
 * - Copy code to clipboard
 */
export const MarkdownContent = React.memo<MarkdownContentProps>(
  ({ content, className = "" }) => {
    return (
      <div
        className={cn(
          "prose min-w-0 max-w-full overflow-hidden break-words text-sm leading-relaxed text-inherit",
          "[&_h1:first-child]:mt-0 [&_h1]:mb-4 [&_h1]:mt-6 [&_h1]:font-semibold",
          "[&_h2:first-child]:mt-0 [&_h2]:mb-4 [&_h2]:mt-6 [&_h2]:font-semibold",
          "[&_h3:first-child]:mt-0 [&_h3]:mb-4 [&_h3]:mt-6 [&_h3]:font-semibold",
          "[&_h4:first-child]:mt-0 [&_h4]:mb-4 [&_h4]:mt-6 [&_h4]:font-semibold",
          "[&_h5:first-child]:mt-0 [&_h5]:mb-4 [&_h5]:mt-6 [&_h5]:font-semibold",
          "[&_h6:first-child]:mt-0 [&_h6]:mb-4 [&_h6]:mt-6 [&_h6]:font-semibold",
          "[&_p:last-child]:mb-0 [&_p]:mb-4",
          // KaTeX specific styles
          "[&_.katex-display]:my-4 [&_.katex-display]:overflow-x-auto",
          "[&_.katex]:text-base",
          className
        )}
      >
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkMath]}
          rehypePlugins={[rehypeKatex]}
          components={{
            code: CodeBlock,
            pre: PreBlock,
            a: LinkComponent,
            blockquote: BlockQuote,
            ul: UnorderedList,
            ol: OrderedList,
            table: TableComponent,
            img: ImageComponent,
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    );
  }
);

MarkdownContent.displayName = "MarkdownContent";

// Code block with syntax highlighting and copy button
function CodeBlock({
  inline,
  className,
  children,
  ...props
}: {
  inline?: boolean;
  className?: string;
  children?: React.ReactNode;
}) {
  const [isCopied, setIsCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const code = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
    });
  };

  if (!inline && match) {
    return (
      <div className="relative group">
        {/* Language label and copy button */}
        <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 rounded-t-md text-xs text-zinc-400">
          <span>{match[1]}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            {isCopied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                <span>Copied!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>
        <SyntaxHighlighter
          style={oneDark}
          language={match[1]}
          PreTag="div"
          className="!mt-0 !rounded-t-none max-w-full rounded-b-md text-sm"
          wrapLines={true}
          wrapLongLines={true}
          lineProps={{
            style: {
              wordBreak: "break-all",
              whiteSpace: "pre-wrap",
              overflowWrap: "break-word",
            },
          }}
          customStyle={{
            margin: 0,
            maxWidth: "100%",
            overflowX: "auto",
            fontSize: "0.875rem",
          }}
        >
          {code}
        </SyntaxHighlighter>
      </div>
    );
  }

  return (
    <code
      className="bg-surface rounded-sm px-1 py-0.5 font-mono text-[0.9em]"
      {...props}
    >
      {children}
    </code>
  );
}

function PreBlock({ children }: { children?: React.ReactNode }) {
  return (
    <div className="my-4 max-w-full overflow-hidden last:mb-0">
      {children}
    </div>
  );
}

function LinkComponent({
  href,
  children,
}: {
  href?: string;
  children?: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-primary no-underline hover:underline"
    >
      {children}
    </a>
  );
}

function BlockQuote({ children }: { children?: React.ReactNode }) {
  return (
    <blockquote className="text-primary/50 my-4 border-l-4 border-border pl-4 italic">
      {children}
    </blockquote>
  );
}

function UnorderedList({ children }: { children?: React.ReactNode }) {
  return (
    <ul className="my-4 pl-6 list-disc [&>li:last-child]:mb-0 [&>li]:mb-1">
      {children}
    </ul>
  );
}

function OrderedList({ children }: { children?: React.ReactNode }) {
  return (
    <ol className="my-4 pl-6 list-decimal [&>li:last-child]:mb-0 [&>li]:mb-1">
      {children}
    </ol>
  );
}

function TableComponent({ children }: { children?: React.ReactNode }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table className="[&_th]:bg-surface w-full border-collapse [&_td]:border [&_td]:border-border [&_td]:p-2 [&_th]:border [&_th]:border-border [&_th]:p-2 [&_th]:text-left [&_th]:font-semibold">
        {children}
      </table>
    </div>
  );
}

// Image component with download button
function ImageComponent({
  src,
  alt,
}: React.ImgHTMLAttributes<HTMLImageElement>) {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    if (!src || typeof src !== "string") return;

    setIsDownloading(true);
    try {
      // Fetch the image as blob to bypass cross-origin restrictions
      const response = await fetch(src);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = alt || "figure.png";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Clean up the blob URL
      URL.revokeObjectURL(blobUrl);
    } catch (error) {
      // Fallback: open in new tab if fetch fails
      console.error("Download failed, opening in new tab:", error);
      window.open(src, "_blank");
    } finally {
      setIsDownloading(false);
    }
  };

  // Only render if src is a string
  if (!src || typeof src !== "string") {
    return null;
  }

  return (
    <span className="relative group inline-block my-4">
      <img
        src={src}
        alt={alt}
        className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
      />
      <button
        onClick={handleDownload}
        disabled={isDownloading}
        className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 disabled:cursor-wait"
        title="Download image"
      >
        {isDownloading ? (
          <Loader2 className="w-4 h-4 text-gray-700 animate-spin" />
        ) : (
          <Download className="w-4 h-4 text-gray-700" />
        )}
      </button>
    </span>
  );
}

export default MarkdownContent;
