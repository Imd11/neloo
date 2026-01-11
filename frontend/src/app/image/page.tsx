'use client';

import { useState, useCallback, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, ChevronDown, Check, Search } from "lucide-react";
import { PromptInput } from "@/app/components/PromptInput";
import { ImageConfigBar } from "@/app/components/ImageConfigBar";
import { TabbedTemplateGrid } from "@/app/components/TabbedTemplateGrid";
import { ImageChatPanel } from "@/app/components/chat/ImageChatPanel";
import { ImageCanvas } from "@/app/components/canvas/ImageCanvas";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Template, imageTemplates } from "@/data/featureTemplates";
import { ImageMessage } from "@/types/imageChat";
import { CanvasImage } from "@/types/canvas";
import { useSidebar } from "@/app/context/SidebarContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable";

// Mock logos for now since I don't have the assets. 
// Ideally I should copy them or use urls.
// For now I'll use placeholders or emoji.
interface ModelInfo {
    name: string;
    logo: string;
}

const imageModels: ModelInfo[] = [
    { name: "Nano Banana", logo: "🍌" },
    { name: "可灵 AI", logo: "✨" },
    { name: "即梦", logo: "🎨" },
    { name: "Midjourney", logo: "⛵️" },
    { name: "DALL·E 3", logo: "🤖" },
    { name: "Stable Diffusion", logo: "🧨" },
    { name: "MiniMax", logo: "Ⓜ️" },
    { name: "通义万相", logo: "🏮" },
];

import { Suspense } from "react";

function ImagePageContent() {
    const { setCollapsed, isMobile } = useSidebar();
    const searchParams = useSearchParams();
    const templateId = searchParams.get("template");
    const [isEditMode, setIsEditMode] = useState(false);
    const [messages, setMessages] = useState<ImageMessage[]>([]);
    const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [imageModel, setImageModel] = useState<ModelInfo>(imageModels[0]);
    const [searchQuery, setSearchQuery] = useState("");
    const [initialPrompt, setInitialPrompt] = useState("");
    const [flyingImage, setFlyingImage] = useState<{
        id: string;
        src: string;
        startRect: DOMRect;
    } | null>(null);

    // Handle template from URL
    useEffect(() => {
        if (templateId) {
            const template = imageTemplates.find(t => t.id === Number(templateId));
            if (template) {
                setInitialPrompt(template.description);
                toast.info(`已加载模板: ${template.title}`, {
                    description: "你可以基于此模板修改提示词"
                });
            }
        }
    }, [templateId]);

    // Note: setHideTopBar logic from AnyAI is skipped as Mello structure handles layout differently.
    // We might want to hide Mello's TopBar if needed, but for now we follow page structure.

    const filteredModels = imageModels.filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmit = useCallback((value: string) => {
        // Collapse sidebar
        setCollapsed(true);

        // Enter edit mode
        setIsEditMode(true);

        // Add user message
        const userMessage: ImageMessage = {
            id: `user-${Date.now()}`,
            role: "user",
            content: value,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, userMessage]);

        // Add loading AI message
        const aiMessageId = `ai-${Date.now()}`;
        const loadingMessage: ImageMessage = {
            id: aiMessageId,
            role: "assistant",
            content: "",
            isLoading: true,
            timestamp: new Date()
        };
        setMessages(prev => [...prev, loadingMessage]);
        setIsGenerating(true);

        // Simulate image generation (replace with actual API call later)
        setTimeout(() => {
            // Use a placeholder image for demo
            const generatedImageUrl = `https://picsum.photos/seed/${Date.now()}/512/512`;

            // Preload image then trigger auto fly animation
            const img = new Image();
            img.onload = () => {
                setMessages(prev => prev.map(msg =>
                    msg.id === aiMessageId
                        ? { ...msg, content: "已为你生成图片:", imageUrl: generatedImageUrl, isLoading: false, autoFly: true }
                        : msg
                ));
                setIsGenerating(false);
                toast.success("图片生成完成!");
            };
            img.src = generatedImageUrl;
        }, 2000);
    }, [setCollapsed]);

    const handleSelectTemplate = (template: Template) => {
        toast.info(`已选择模板: ${template.title}`);
    };

    const handleImageGenerated = useCallback((imageUrl: string, imageElement: HTMLImageElement) => {
        const rect = imageElement.getBoundingClientRect();

        // Start flying animation
        setFlyingImage({
            id: `canvas-${Date.now()}`,
            src: imageUrl,
            startRect: rect
        });
    }, []);

    const handleFlyingComplete = useCallback(() => {
        setFlyingImage(null);
    }, []);

    const handleStopGeneration = useCallback(() => {
        setIsGenerating(false);
        setMessages(prev => prev.filter(msg => !msg.isLoading));
    }, []);

    // Mark autoFly as complete to prevent re-triggering
    const handleMarkAutoFlown = useCallback((messageId: string) => {
        setMessages(prev => prev.map(msg =>
            msg.id === messageId ? { ...msg, autoFly: false } : msg
        ));
    }, []);

    // Handle new conversation (stay in edit mode, clear messages)
    const handleNewConversation = useCallback(() => {
        setMessages([]);
        setCanvasImages([]);
        toast.info("已开始新对话");
    }, []);

    // Handle template selection from chat panel
    const handleChatTemplateSelect = useCallback((prompt: string) => {
        toast.info(`已选择模板`);
        handleSubmit(prompt);
    }, [handleSubmit]);

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
                {!isEditMode ? (
                    // Input Mode - Original Layout
                    <motion.div
                        key="input-mode"
                        initial={{ opacity: 1, scale: 1 }}
                        exit={{
                            opacity: 0,
                            scale: 0.96,
                            filter: "blur(4px)",
                            transition: {
                                duration: 0.5,
                                ease: [0.16, 1, 0.3, 1]
                            }
                        }}
                        className="h-full flex flex-col overflow-y-auto"
                    >
                        {/* Top Section - Centered Content */}
                        <div className="flex-1 flex flex-col items-center px-6">
                            <div className="w-full max-w-4xl flex flex-col items-center gap-8 pt-[15vh]">
                                <h1 className="text-3xl font-semibold">AI 图片生成</h1>

                                {/* Prompt Input */}
                                <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-4">
                                    <ImageConfigBar />
                                    <PromptInput
                                        placeholder="描述你要生成的图..."
                                        initialValue={initialPrompt}
                                        onSubmit={handleSubmit}
                                        selectedFeature={{ id: 'image', title: 'Image', description: '', icon: '', templates: [], placeholder: '' }} // Mock
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Template Section */}
                        <div className="flex-shrink-0 px-6 py-12">
                            <div className="max-w-4xl mx-auto">
                                <h2 className="text-lg font-medium text-foreground mb-4">
                                    模板灵感
                                </h2>
                                <TabbedTemplateGrid type="image" onSelectTemplate={handleSelectTemplate} />
                            </div>
                        </div>
                    </motion.div>
                ) : (
                    // Edit Mode - Resizable Split Layout
                    <motion.div
                        key="edit-mode"
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                            delay: 0.1
                        }}
                        className="h-full"
                    >
                        <ResizablePanelGroup direction="horizontal" className="h-full">
                            {/* Left - Chat Panel (Resizable) */}
                            <ResizablePanel
                                defaultSize={25}
                                minSize={15}
                                maxSize={50}
                                className="h-full flex flex-col min-w-[320px]"
                            >
                                <div className="h-full flex flex-col">
                                    {/* Chat Header - Model Selector (left) + New Conversation (right) */}
                                    <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background">
                                        {/* Model Selector */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="gap-2 text-foreground font-medium hover:bg-hover-bg h-8 px-2"
                                                >
                                                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center")}>
                                                        {imageModel.logo}
                                                    </span>
                                                    <span className="text-sm truncate max-w-[100px]">{imageModel.name}</span>
                                                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent align="start" className="w-64 bg-popover border-border p-2">
                                                <div className="relative mb-2">
                                                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                                    <input
                                                        type="text"
                                                        placeholder="搜索模型..."
                                                        value={searchQuery}
                                                        onChange={(e) => setSearchQuery(e.target.value)}
                                                        className="w-full pl-8 pr-3 py-2 text-sm bg-input-bg border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                                    />
                                                </div>
                                                <div className="max-h-48 overflow-y-auto">
                                                    {filteredModels.map((model) => (
                                                        <DropdownMenuItem
                                                            key={model.name}
                                                            onClick={() => {
                                                                setImageModel(model);
                                                                setSearchQuery("");
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-2 cursor-pointer rounded-md",
                                                                "text-foreground hover:bg-hover-bg focus:bg-hover-bg",
                                                                imageModel.name === model.name && "bg-accent"
                                                            )}
                                                        >
                                                            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0")}>
                                                                {model.logo}
                                                            </span>
                                                            <span className="text-sm flex-1">{model.name}</span>
                                                            {imageModel.name === model.name && (
                                                                <Check className="w-4 h-4 text-foreground flex-shrink-0" />
                                                            )}
                                                        </DropdownMenuItem>
                                                    ))}
                                                </div>
                                            </DropdownMenuContent>
                                        </DropdownMenu>

                                        {/* New Conversation Button */}
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleNewConversation}
                                            className="h-8 px-3 gap-1.5 text-muted-foreground hover:text-foreground border-border"
                                        >
                                            <MessageSquarePlus className="w-4 h-4" />
                                            <span className="text-xs">新建</span>
                                        </Button>
                                    </div>
                                    <div className="flex-1 min-h-0">
                                        <ImageChatPanel
                                            messages={messages}
                                            onSendMessage={handleSubmit}
                                            isGenerating={isGenerating}
                                            onStopGeneration={handleStopGeneration}
                                            onImageGenerated={handleImageGenerated}
                                            onMarkAutoFlown={handleMarkAutoFlown}
                                            onSelectTemplate={handleChatTemplateSelect}
                                        />
                                    </div>
                                </div>
                            </ResizablePanel>

                            {/* Resize Handle */}
                            <ResizableHandle
                                className="w-[3px] bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize relative after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2 after:w-px after:bg-border"
                            />

                            {/* Right - Canvas */}
                            <ResizablePanel defaultSize={75} className="h-full">
                                <ImageCanvas
                                    images={canvasImages}
                                    onImagesChange={setCanvasImages}
                                    flyingImage={flyingImage}
                                    onFlyingComplete={handleFlyingComplete}
                                />
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function ImagePage() {
    return (
        <Suspense fallback={
            <div className="flex h-screen items-center justify-center">
                <p className="text-muted-foreground">Loading...</p>
            </div>
        }>
            <ImagePageContent />
        </Suspense>
    );
}
