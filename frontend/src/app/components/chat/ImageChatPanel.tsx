import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Mic, ArrowUp, Square, LayoutGrid, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ImageMessage } from "@/types/imageChat";
import { ScrollArea } from "@/components/ui/scroll-area";
import { imageTemplates, imageCategories, TemplateCategory } from "@/data/featureTemplates";
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
    onSelectTemplate
}: ImageChatPanelProps) {
    const [inputValue, setInputValue] = useState("");
    const [isFocused, setIsFocused] = useState(false);
    const [templateOpen, setTemplateOpen] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState<TemplateCategory>("all");
    const scrollRef = useRef<HTMLDivElement>(null);
    const imageRefs = useRef<Map<string, HTMLImageElement>>(new Map());

    const filteredTemplates = selectedCategory === "all"
        ? imageTemplates
        : imageTemplates.filter(t => t.category === selectedCategory);

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

    const handleImageClick = useCallback((imageUrl: string, e: React.MouseEvent<HTMLImageElement>) => {
        if (onImageGenerated) {
            onImageGenerated(imageUrl, e.currentTarget);
        }
    }, [onImageGenerated]);

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

    const handleImageRef = useCallback((messageId: string, el: HTMLImageElement | null) => {
        if (el) {
            imageRefs.current.set(messageId, el);
        } else {
            imageRefs.current.delete(messageId);
        }
    }, []);

    return (
        <div className="flex flex-col h-full bg-background">
            {/* Messages Area */}
            <ScrollArea className="flex-1 px-4 py-4">
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
                                <div
                                    className={cn(
                                        "max-w-[85%] rounded-2xl px-4 py-2.5",
                                        message.role === "user"
                                            ? "bg-primary text-primary-foreground"
                                            : "bg-muted text-foreground"
                                    )}
                                >
                                    {/* Text Content */}
                                    {message.content && (
                                        <p className="text-sm leading-relaxed">{message.content}</p>
                                    )}

                                    {/* Image Content */}
                                    {message.imageUrl && (
                                        <motion.div
                                            className="mt-2 cursor-pointer group relative"
                                            whileHover={{ scale: 1.02 }}
                                            transition={{ duration: 0.2 }}
                                        >
                                            <img
                                                ref={(el) => handleImageRef(message.id, el)}
                                                src={message.imageUrl}
                                                alt="Generated"
                                                className="rounded-lg max-w-full h-auto"
                                                onClick={(e) => handleImageClick(message.imageUrl!, e)}
                                            />
                                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                <span className="text-white text-sm font-medium">
                                                    点击添加到画布
                                                </span>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Loading State */}
                                    {message.isLoading && (
                                        <div className="flex items-center gap-1 py-1">
                                            <motion.span
                                                className="w-2 h-2 bg-current rounded-full"
                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                transition={{ duration: 1.2, repeat: Infinity }}
                                            />
                                            <motion.span
                                                className="w-2 h-2 bg-current rounded-full"
                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
                                            />
                                            <motion.span
                                                className="w-2 h-2 bg-current rounded-full"
                                                animate={{ opacity: [0.4, 1, 0.4] }}
                                                transition={{ duration: 1.2, repeat: Infinity, delay: 0.4 }}
                                            />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-4 border-t border-border space-y-3">
                {/* Template Selector Button */}
                <Popover open={templateOpen} onOpenChange={setTemplateOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            variant="outline"
                            size="sm"
                            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground border-dashed"
                        >
                            <LayoutGrid className="w-4 h-4" />
                            <span className="text-sm">选择模板</span>
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent
                        side="top"
                        align="start"
                        className="w-80 p-0"
                    >
                        <div className="p-3 border-b border-border">
                            <div className="flex items-center justify-between mb-2">
                                <span className="text-sm font-medium">选择模板</span>
                                <Button
                                    variant="ghost"
                                    size="icon"
                                    className="w-6 h-6"
                                    onClick={() => setTemplateOpen(false)}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                            {/* Category Tabs */}
                            <div className="flex gap-1 flex-wrap">
                                {imageCategories.map((cat) => (
                                    <Button
                                        key={cat.id}
                                        variant={selectedCategory === cat.id ? "secondary" : "ghost"}
                                        size="sm"
                                        className="h-7 text-xs px-2"
                                        onClick={() => setSelectedCategory(cat.id)}
                                    >
                                        {cat.label}
                                    </Button>
                                ))}
                            </div>
                        </div>
                        <ScrollArea className="h-64">
                            <div className="p-2 grid grid-cols-2 gap-2">
                                {filteredTemplates.map((template) => (
                                    <button
                                        key={template.id}
                                        onClick={() => {
                                            onSelectTemplate?.(template.description);
                                            setInputValue(template.description);
                                            setTemplateOpen(false);
                                        }}
                                        className={cn(
                                            "relative overflow-hidden rounded-lg p-3 text-left transition-all",
                                            "hover:ring-2 hover:ring-primary/50",
                                            template.gradient
                                        )}
                                    >
                                        <span className="text-xs font-medium text-white/90">
                                            {template.title}
                                        </span>
                                        <p className="text-[10px] text-white/60 mt-0.5 line-clamp-2">
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
                        "bg-input-bg rounded-2xl",
                        "border border-border",
                        "transition-all duration-200",
                        isFocused && "border-ring shadow-glow"
                    )}
                >
                    <div className="flex items-center gap-2 px-3 py-2.5">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 w-8 h-8 text-muted-foreground hover:text-foreground"
                        >
                            <Plus className="w-4 h-4" />
                        </Button>

                        <input
                            type="text"
                            value={inputValue}
                            onChange={(e) => setInputValue(e.target.value)}
                            onFocus={() => setIsFocused(true)}
                            onBlur={() => setIsFocused(false)}
                            onKeyDown={handleKeyDown}
                            placeholder="继续描述或修改..."
                            className="flex-1 bg-transparent text-foreground placeholder:text-muted-foreground text-sm leading-none outline-none min-w-0"
                        />

                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 w-8 h-8 text-muted-foreground hover:text-foreground"
                        >
                            <Mic className="w-4 h-4" />
                        </Button>

                        {isGenerating ? (
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={onStopGeneration}
                                className="shrink-0 w-8 h-8 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                                <Square className="w-3 h-3" />
                            </Button>
                        ) : (
                            <Button
                                variant="default"
                                size="icon"
                                onClick={handleSubmit}
                                disabled={!inputValue.trim()}
                                className={cn(
                                    "shrink-0 w-8 h-8 transition-all duration-200 rounded-full",
                                    !inputValue.trim() ? "opacity-50 cursor-not-allowed" : "hover:shadow-lg"
                                )}
                            >
                                <ArrowUp className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
