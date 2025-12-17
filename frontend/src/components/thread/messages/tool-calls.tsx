import { AIMessage, ToolMessage } from "@langchain/langgraph-sdk";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Download } from "lucide-react";

function isComplexValue(value: any): boolean {
  return Array.isArray(value) || (typeof value === "object" && value !== null);
}

// Extract base64 images from markdown-style image syntax
function extractImages(content: string): { images: string[]; textContent: string } {
  const imageRegex = /!\[.*?\]\((data:image\/png;base64,[^)]+)\)/g;
  const images: string[] = [];
  let match;

  while ((match = imageRegex.exec(content)) !== null) {
    images.push(match[1]);
  }

  // Remove image markdown from text content
  const textContent = content.replace(imageRegex, '').trim();

  return { images, textContent };
}

// Image component with download button
function ImageWithDownload({ src, index }: { src: string; index: number }) {
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = src;
    link.download = `figure_${index + 1}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="relative group my-4">
      <img
        src={src}
        alt={`Figure ${index + 1}`}
        className="max-w-full h-auto rounded-lg border border-gray-200 shadow-sm"
      />
      <button
        onClick={handleDownload}
        className="absolute top-2 right-2 p-2 bg-white/90 hover:bg-white rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        title="Download image"
      >
        <Download className="w-4 h-4 text-gray-700" />
      </button>
    </div>
  );
}

export function ToolCalls({
  toolCalls,
}: {
  toolCalls: AIMessage["tool_calls"];
}) {
  if (!toolCalls || toolCalls.length === 0) return null;

  return (
    <div className="space-y-4 w-full max-w-4xl">
      {toolCalls.map((tc, idx) => {
        const args = tc.args as Record<string, any>;
        const hasArgs = Object.keys(args).length > 0;
        return (
          <div
            key={idx}
            className="border border-gray-200 rounded-lg overflow-hidden"
          >
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
              <h3 className="font-medium text-gray-900">
                {tc.name}
                {tc.id && (
                  <code className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded">
                    {tc.id}
                  </code>
                )}
              </h3>
            </div>
            {hasArgs ? (
              <table className="min-w-full divide-y divide-gray-200">
                <tbody className="divide-y divide-gray-200">
                  {Object.entries(args).map(([key, value], argIdx) => (
                    <tr key={argIdx}>
                      <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                        {key}
                      </td>
                      <td className="px-4 py-2 text-sm text-gray-500">
                        {isComplexValue(value) ? (
                          <code className="bg-gray-50 rounded px-2 py-1 font-mono text-sm break-all">
                            {JSON.stringify(value, null, 2)}
                          </code>
                        ) : (
                          String(value)
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <code className="text-sm block p-3">{"{}"}</code>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ToolResult({ message }: { message: ToolMessage }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const rawContent = typeof message.content === "string"
    ? message.content
    : JSON.stringify(message.content);

  // Extract images from the content
  const { images, textContent } = extractImages(rawContent);

  let parsedContent: any;
  let isJsonContent = false;

  try {
    if (textContent) {
      parsedContent = JSON.parse(textContent);
      isJsonContent = true;
    }
  } catch {
    // Content is not JSON, use as is
    parsedContent = textContent;
  }

  const contentStr = isJsonContent
    ? JSON.stringify(parsedContent, null, 2)
    : String(textContent);
  const contentLines = contentStr.split("\n");
  const shouldTruncate = contentLines.length > 4 || contentStr.length > 500;
  const displayedContent =
    shouldTruncate && !isExpanded
      ? contentStr.length > 500
        ? contentStr.slice(0, 500) + "..."
        : contentLines.slice(0, 4).join("\n") + "\n..."
      : contentStr;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          {message.name ? (
            <h3 className="font-medium text-gray-900">
              Tool Result:{" "}
              <code className="bg-gray-100 px-2 py-1 rounded">
                {message.name}
              </code>
            </h3>
          ) : (
            <h3 className="font-medium text-gray-900">Tool Result</h3>
          )}
          {message.tool_call_id && (
            <code className="ml-2 text-sm bg-gray-100 px-2 py-1 rounded">
              {message.tool_call_id}
            </code>
          )}
        </div>
      </div>

      {/* Render images if any */}
      {images.length > 0 && (
        <div className="p-4 bg-white border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {images.map((src, idx) => (
              <ImageWithDownload key={idx} src={src} index={idx} />
            ))}
          </div>
        </div>
      )}

      {/* Render text content */}
      {textContent && (
        <motion.div
          className="min-w-full bg-gray-100"
          initial={false}
          animate={{ height: "auto" }}
          transition={{ duration: 0.3 }}
        >
          <div className="p-3">
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={isExpanded ? "expanded" : "collapsed"}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.2 }}
              >
                {isJsonContent ? (
                  <table className="min-w-full divide-y divide-gray-200">
                    <tbody className="divide-y divide-gray-200">
                      {(Array.isArray(parsedContent)
                        ? isExpanded
                          ? parsedContent
                          : parsedContent.slice(0, 5)
                        : Object.entries(parsedContent)
                      ).map((item, argIdx) => {
                        const [key, value] = Array.isArray(parsedContent)
                          ? [argIdx, item]
                          : [item[0], item[1]];
                        return (
                          <tr key={argIdx}>
                            <td className="px-4 py-2 text-sm font-medium text-gray-900 whitespace-nowrap">
                              {key}
                            </td>
                            <td className="px-4 py-2 text-sm text-gray-500">
                              {isComplexValue(value) ? (
                                <code className="bg-gray-50 rounded px-2 py-1 font-mono text-sm break-all">
                                  {JSON.stringify(value, null, 2)}
                                </code>
                              ) : (
                                String(value)
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                ) : (
                  <code className="text-sm block whitespace-pre-wrap">{displayedContent}</code>
                )}
              </motion.div>
            </AnimatePresence>
          </div>
          {((shouldTruncate && !isJsonContent) ||
            (isJsonContent &&
              Array.isArray(parsedContent) &&
              parsedContent.length > 5)) && (
            <motion.button
              onClick={() => setIsExpanded(!isExpanded)}
              className="w-full py-2 flex items-center justify-center border-t-[1px] border-gray-200 text-gray-500 hover:text-gray-600 hover:bg-gray-50 transition-all ease-in-out duration-200 cursor-pointer"
              initial={{ scale: 1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              {isExpanded ? <ChevronUp /> : <ChevronDown />}
            </motion.button>
          )}
        </motion.div>
      )}
    </div>
  );
}
