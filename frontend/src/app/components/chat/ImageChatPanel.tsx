import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUp, Square, LayoutGrid, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImageMessage } from "@/types/imageChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  imageTemplates,
  imageCategories,
  TemplateCategory,
  localizeCategory,
  localizeTemplate,
} from "@/data/featureTemplates";
import { useLanguage } from "@/providers/LanguageProvider";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface ImageChatPanelProps {
  messages: ImageMessage[];
  onSendMessage: (content: string) => void;
  isGenerating: boolean;
  onStopGeneration?: () => void;
  onImageGenerated?: (imageUrl: string, imageRef: HTMLImageElement) => void;
  onMarkAutoFlown?: (messageId: string) => void;
  onSelectTemplate?: (prompt: string) => void;
}

export function ImageChatPanel({
  messages,
  onSendMessage,
  isGenerating,
  onStopGeneration,
  onImageGenerated,
  onMarkAutoFlown,
  onSelectTemplate,
}: ImageChatPanelProps) {
  const { t } = useLanguage();
  const [inputValue, setInputValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] =
    useState<TemplateCategory>("all");
  const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const localizedTemplates = useMemo(
    () => imageTemplates.map((template) => localizeTemplate(template, t)),
    [t]
  );
  const localizedCategories = useMemo(
    () => imageCategories.map((category) => localizeCategory(category, t)),
    [t]
  );

  const filteredTemplates =
    selectedCategory === "all"
      ? localizedTemplates
      : localizedTemplates.filter(
          (template) => template.category === selectedCategory
        );

  const handleSubmit = () => {
    if (inputValue.trim()) {
      onSendMessage(inputValue.trim());
      setInputValue("");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleImageClick = useCallback(
    (imageUrl: string, e: React.MouseEvent<HTMLImageElement>) => {
      if (onImageGenerated) {
        onImageGenerated(imageUrl, e.currentTarget);
      }
    },
    [onImageGenerated]
  );

  // Autosize textarea (up to a max height), so long prompts remain viewable/editable.
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    const maxHeight = 180;
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
  }, [inputValue]);

  // Handle auto-fly for newly generated images
  useEffect(() => {
    // Find messages that need auto-fly
    const autoFlyMessages = messages.filter(
      (msg) => msg.autoFly && msg.imageUrl && !msg.isLoading
    );

    autoFlyMessages.forEach((message) => {
      // Use a longer delay and check for DOM element availability
      const checkAndFly = () => {
        const imageEl = imageRefs.current.get(message.id);
        if (imageEl && onImageGenerated && onMarkAutoFlown) {
          // Ensure image is fully loaded and has dimensions
          if (imageEl.complete && imageEl.naturalWidth > 0) {
            onImageGenerated(message.imageUrl!, imageEl);
            onMarkAutoFlown(message.id);
          } else {
            // Wait for image to load
            imageEl.onload = () => {
              onImageGenerated(message.imageUrl!, imageEl);
              onMarkAutoFlown(message.id);
            };
          }
        }
      };

      // Delay to ensure React has rendered the image element
      setTimeout(checkAndFly, 300);
    });
  }, [messages, onImageGenerated, onMarkAutoFlown]);

  const handleImageRef = useCallback(
    (messageId: string, el: HTMLImageElement | null) => {
      if (el) {
        imageRefs.current.set(messageId, el);
      } else {
        imageRefs.current.delete(messageId);
      }
    },
    []
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      {/* Messages Area */}
      <ScrollArea className="h-0 flex-1 px-4 py-4">
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className={cn(
                  "flex",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {/* User Message - with bubble */}
                {message.role === "user" && (
                  <div className="text-primary-foreground max-w-[85%] rounded-2xl bg-primary px-4 py-2.5">
                    <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">
                      {message.content}
                    </p>
                  </div>
                )}

                {/* AI Message - no bubble, fixed image size */}
                {message.role === "assistant" && (
                  <div className="flex flex-col items-start">
                    {/* Text Content (if any) */}
                    {message.content && (
                      <p className="mb-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">
                        {message.content}
                      </p>
                    )}

                    {/* Image Content - fixed size, no bubble */}
                    {message.imageUrl && (
                      <motion.div
                        className="group relative cursor-pointer"
                        whileHover={{ scale: 1.02 }}
                        transition={{ duration: 0.2 }}
                      >
                        <img
                          ref={(el) => handleImageRef(message.id, el)}
                          src={message.imageUrl}
                          alt="Generated"
                          className="rounded-md shadow-md"
                          style={{ width: "120px", height: "auto" }}
                          onClick={(e) =>
                            handleImageClick(message.imageUrl!, e)
                          }
                        />
                        <div className="absolute inset-0 flex items-center justify-center rounded-md bg-black/40 opacity-0 transition-opacity group-hover:opacity-100">
                          <span className="text-xs font-medium text-white">
                            {t("chat.add_to_canvas")}
                          </span>
                        </div>
                      </motion.div>
                    )}

                    {/* Loading State */}
                    {message.isLoading && (
                      <div className="flex items-center gap-1 py-2">
                        <motion.span
                          className="h-2 w-2 rounded-full bg-muted-foreground"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{ duration: 1.2, repeat: Infinity }}
                        />
                        <motion.span
                          className="h-2 w-2 rounded-full bg-muted-foreground"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: 0.2,
                          }}
                        />
                        <motion.span
                          className="h-2 w-2 rounded-full bg-muted-foreground"
                          animate={{ opacity: [0.4, 1, 0.4] }}
                          transition={{
                            duration: 1.2,
                            repeat: Infinity,
                            delay: 0.4,
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="space-y-3 border-t border-border p-4">
        {/* Template Selector Button */}
        <Popover
          open={templateOpen}
          onOpenChange={setTemplateOpen}
        >
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2 border-dashed text-muted-foreground hover:text-foreground"
            >
              <LayoutGrid className="h-4 w-4" />
              <span className="text-sm">{t("chat.select_template")}</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent
            side="top"
            align="start"
            className="w-80 p-0"
          >
            <div className="border-b border-border p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-medium">
                  {t("chat.select_template")}
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => setTemplateOpen(false)}
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
              {/* Category Tabs */}
              <div className="flex flex-wrap gap-1">
                {localizedCategories.map((cat) => (
                  <Button
                    key={cat.id}
                    variant={
                      selectedCategory === cat.id ? "secondary" : "ghost"
                    }
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => setSelectedCategory(cat.id)}
                  >
                    {cat.label}
                  </Button>
                ))}
              </div>
            </div>
            <ScrollArea className="h-64">
              <div className="grid grid-cols-2 gap-2 p-2">
                {filteredTemplates.map((template) => (
                  <button
                    key={template.id}
                    onClick={() => {
                      const prompt = template.prompt || template.description;
                      onSelectTemplate?.(prompt);
                      setInputValue(prompt);
                      setTemplateOpen(false);
                    }}
                    className={cn(
                      "relative min-h-28 overflow-hidden rounded-lg p-3 text-left transition-all",
                      "hover:ring-2 hover:ring-primary/50",
                      !template.previewImage && template.gradient
                    )}
                  >
                    {template.previewImage && (
                      <>
                        <img
                          src={template.previewImage}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                        <span className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/5" />
                      </>
                    )}
                    <span className="relative z-10 text-xs font-medium text-white/90">
                      {template.title}
                    </span>
                    <p className="relative z-10 mt-0.5 line-clamp-2 text-[10px] text-white/70">
                      {template.description}
                    </p>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>

        {/* Input Box */}
        <div
          className={cn(
            "relative w-full",
            "rounded-2xl bg-input-bg",
            "border border-border",
            "transition-all duration-200",
            isFocused && "border-ring shadow-glow"
          )}
        >
          <div className="flex items-end gap-2 px-3 py-2.5">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              onKeyDown={handleKeyDown}
              placeholder={t("chat.continue_image_placeholder")}
              rows={1}
              aria-label={t("chat.prompt_input")}
              className="max-h-[180px] min-w-0 flex-1 resize-none overflow-y-auto bg-transparent py-1 text-sm leading-5 text-foreground outline-none placeholder:text-muted-foreground"
            />

            {isGenerating ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={onStopGeneration}
                className="h-8 w-8 shrink-0 bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                <Square className="h-3 w-3" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="icon"
                onClick={handleSubmit}
                disabled={!inputValue.trim()}
                className={cn(
                  "h-8 w-8 shrink-0 rounded-full transition-all duration-200",
                  !inputValue.trim()
                    ? "cursor-not-allowed opacity-50"
                    : "hover:shadow-lg"
                )}
              >
                <ArrowUp className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
