'use client';

import { useState, useCallback, useEffect, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, ChevronDown, Check, Search } from "lucide-react";
import { RotatingHeadline } from "@/app/components/RotatingHeadline";
import { PromptInput } from "@/app/components/PromptInput";
import { ImageConfigBar, Resolution, ImageRatio } from "@/app/components/ImageConfigBar";
import { TabbedTemplateGrid } from "@/app/components/TabbedTemplateGrid";
import { ImageChatPanel } from "@/app/components/chat/ImageChatPanel";
import { ImageCanvas } from "@/app/components/canvas/ImageCanvas";
import { MainLayout } from "@/app/components/layout/MainLayout";
import { SearchDialog } from "@/app/components/SearchDialog";
import { LibraryDialog } from "@/app/components/LibraryDialog";
import { Button } from "@/components/ui/button";
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Template } from "@/data/featureTemplates";
import { ImageMessage } from "@/types/imageChat";
import { CanvasImage } from "@/types/canvas";
import { useSidebar } from "@/app/context/SidebarContext";
import { useAuth } from "@/providers/AuthProvider";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
    ResizablePanelGroup,
    ResizablePanel,
    ResizableHandle,
} from "@/components/ui/resizable";
import { v4 as uuidv4 } from "uuid";
import { getConfig } from "@/lib/config";
import { useThreads } from "@/app/hooks/useThreads";

// Import logos for image models
import nanoBananaLogo from "@/assets/logos/nano-banana.png";
import klingLogo from "@/assets/logos/kling.png";
import jimengLogo from "@/assets/logos/jimeng.png";
import midjourneyLogo from "@/assets/logos/midjourney.png";
import openaiLogo from "@/assets/logos/openai.png";
import stabilityLogo from "@/assets/logos/stability.png";
import minimaxLogo from "@/assets/logos/minimax.png";
import qwenLogo from "@/assets/logos/qwen.png";

// Logos that need dark background in light mode
const lightLogos = [openaiLogo, midjourneyLogo];

interface ModelInfo {
    name: string;
    logo: typeof nanoBananaLogo;
    available: boolean; // true = 可用, false = 即将上线
}

const imageModels: ModelInfo[] = [
    { name: "Nano Banana", logo: nanoBananaLogo, available: true },
    { name: "可灵 AI", logo: klingLogo, available: false },
    { name: "即梦", logo: jimengLogo, available: false },
    { name: "Midjourney", logo: midjourneyLogo, available: false },
    { name: "DALL·E 3", logo: openaiLogo, available: false },
    { name: "Stable Diffusion", logo: stabilityLogo, available: false },
    { name: "MiniMax", logo: minimaxLogo, available: false },
    { name: "通义万相", logo: qwenLogo, available: false },
];

function ImagePageContent() {
    const { setCollapsed, setHideTopBar } = useSidebar();
    const { session } = useAuth();
    const config = getConfig();
    const threads = useThreads({ limit: 20 });

    const [isEditMode, setIsEditMode] = useState(false);
    const [messages, setMessages] = useState<ImageMessage[]>([]);
    const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
    const [isGenerating, setIsGenerating] = useState(false);
    const [imageModel, setImageModel] = useState<ModelInfo>(imageModels[0]);
    const [resolution, setResolution] = useState<Resolution>("1k");
    const [ratio, setRatio] = useState<ImageRatio>("auto");
    const [searchQuery, setSearchQuery] = useState("");
    const [flyingImage, setFlyingImage] = useState<{
        id: string;
        src: string;
        startRect: DOMRect;
    } | null>(null);

    // Thread/conversation state for history
    const [threadId, setThreadId] = useState<string | null>(null);
    const threadCreatedRef = useRef(false);
    const titleGeneratedRef = useRef(false);

    // Create thread for image generation history
    const createImageThread = useCallback(async (firstMessage: string) => {
        if (!config?.deploymentUrl || !session?.access_token) return null;
        if (threadCreatedRef.current) return threadId;

        const newThreadId = uuidv4();
        threadCreatedRef.current = true;

        try {
            const response = await fetch(`${config.deploymentUrl}/api/threads`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    langgraph_thread_id: newThreadId,
                    title: firstMessage.slice(0, 30) + (firstMessage.length > 30 ? "..." : ""),
                    type: "image",  // Mark as image type
                }),
            });

            if (response.ok) {
                console.log("[ImagePage] Created thread:", newThreadId.slice(0, 8));
                setThreadId(newThreadId);
                threads.mutate?.();  // Refresh sidebar
                return newThreadId;
            }
        } catch (error) {
            console.error("[ImagePage] Failed to create thread:", error);
        }
        return null;
    }, [config, session, threadId, threads]);

    // Generate smart title for thread
    const generateTitle = useCallback(async (currentThreadId: string, userMessage: string) => {
        if (!config?.deploymentUrl || !session?.access_token) return;
        if (titleGeneratedRef.current) return;

        titleGeneratedRef.current = true;

        try {
            const response = await fetch(
                `${config.deploymentUrl}/api/threads/${encodeURIComponent(currentThreadId)}/generate-title`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({ user_message: userMessage }),
                }
            );

            if (response.ok) {
                console.log("[ImagePage] Generated title for thread");
                threads.mutate?.();  // Refresh sidebar
            }
        } catch (error) {
            console.error("[ImagePage] Failed to generate title:", error);
        }
    }, [config, session, threads]);

    // Hide global TopBar in edit mode
    useEffect(() => {
        setHideTopBar(isEditMode);
        return () => setHideTopBar(false);
    }, [isEditMode, setHideTopBar]);

    const filteredModels = imageModels.filter((model) =>
        model.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleSubmit = useCallback(async (value: string) => {
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

        // Create thread for history (first message only)
        const isFirstMessage = messages.length === 0;
        if (isFirstMessage) {
            const newThreadId = await createImageThread(value);
            if (newThreadId) {
                // Generate smart title after a short delay
                setTimeout(() => generateTitle(newThreadId, value), 1000);
            }
        }

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

        try {
            // Call real API
            const response = await fetch("/api/generate-image", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    prompt: value,
                    resolution: resolution,
                    ...(ratio !== "auto" && { size: ratio })
                })
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.error || "生成失败");
            }

            const data = await response.json();
            console.log("[ImagePage] API Response:", JSON.stringify(data, null, 2));
            const generatedImageUrl = data.images?.[0];
            console.log("[ImagePage] Generated Image URL:", generatedImageUrl);

            if (!generatedImageUrl) {
                throw new Error("未收到生成的图片");
            }

            // Preload image then trigger auto fly animation
            const img = new Image();
            img.onload = () => {
                setMessages(prev => prev.map(msg =>
                    msg.id === aiMessageId
                        ? { ...msg, content: "", imageUrl: generatedImageUrl, isLoading: false, autoFly: true }
                        : msg
                ));
                setIsGenerating(false);
                toast.success("图片生成完成!");
            };
            img.onerror = () => {
                throw new Error("图片加载失败");
            };
            img.src = generatedImageUrl;
        } catch (error) {
            console.error("[ImagePage] Generation failed:", error);
            setMessages(prev => prev.filter(msg => msg.id !== aiMessageId));
            setIsGenerating(false);
            toast.error(error instanceof Error ? error.message : "图片生成失败");
        }
    }, [setCollapsed, messages, createImageThread, generateTitle]);

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

    // Handle going back to input mode
    const handleBackToInput = useCallback(() => {
        setIsEditMode(false);
        setMessages([]);
        setCanvasImages([]);
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
    }, []);

    return (
        <div className="h-full flex flex-col overflow-hidden">
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
                            <div className="w-full max-w-4xl flex flex-col items-center gap-8 pt-[28vh]">
                                {/* Rotating Headline */}
                                <div>
                                    <RotatingHeadline />
                                </div>

                                {/* Prompt Input */}
                                <div className="w-full max-w-3xl mx-auto flex flex-col items-center gap-4">
                                    <ImageConfigBar
                                        ratio={ratio}
                                        onRatioChange={setRatio}
                                        resolution={resolution}
                                        onResolutionChange={setResolution}
                                    />
                                    <PromptInput
                                        placeholder="描述你要生成的图..."
                                        onSubmit={handleSubmit}
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
                                className="h-full flex flex-col"
                            >
                                <motion.div
                                    initial={{ x: -60, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{
                                        duration: 0.6,
                                        ease: [0.16, 1, 0.3, 1],
                                        delay: 0.15
                                    }}
                                    className="h-full flex flex-col"
                                >
                                    {/* Chat Header - Model Selector (left) + New Conversation (right) */}
                                    <div className="h-14 shrink-0 flex items-center justify-between px-4 border-b border-border bg-background">
                                        {/* Model Selector */}
                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button
                                                    variant="ghost"
                                                    className="gap-2 text-foreground font-medium hover:bg-hover-bg h-8 px-2"
                                                >
                                                    <span className={cn("w-5 h-5 rounded-full flex items-center justify-center", lightLogos.includes(imageModel.logo) && "bg-foreground dark:bg-transparent")}>
                                                        <img src={imageModel.logo.src} alt="" className="w-4 h-4 object-contain" />
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
                                                            disabled={!model.available}
                                                            onClick={() => {
                                                                if (model.available) {
                                                                    setImageModel(model);
                                                                    setSearchQuery("");
                                                                }
                                                            }}
                                                            className={cn(
                                                                "flex items-center gap-2 cursor-pointer rounded-md",
                                                                model.available
                                                                    ? "text-foreground hover:bg-hover-bg focus:bg-hover-bg"
                                                                    : "text-muted-foreground cursor-not-allowed opacity-60",
                                                                imageModel.name === model.name && "bg-accent"
                                                            )}
                                                        >
                                                            <span className={cn("w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0", lightLogos.includes(model.logo) && "bg-foreground dark:bg-transparent")}>
                                                                <img src={model.logo.src} alt="" className="w-4 h-4 object-contain" />
                                                            </span>
                                                            <span className="text-sm flex-1">{model.name}</span>
                                                            {!model.available && (
                                                                <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">即将上线</span>
                                                            )}
                                                            {imageModel.name === model.name && model.available && (
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
                                </motion.div>
                            </ResizablePanel>

                            {/* Resize Handle - full height, styled like sidebar handle */}
                            <ResizableHandle
                                className="w-[3px] bg-transparent hover:bg-primary/20 transition-colors cursor-col-resize relative after:absolute after:inset-y-0 after:left-1/2 after:-translate-x-1/2 after:w-px after:bg-border"
                            />

                            {/* Right - Canvas */}
                            <ResizablePanel defaultSize={75} className="h-full">
                                <motion.div
                                    initial={{ x: 80, opacity: 0 }}
                                    animate={{ x: 0, opacity: 1 }}
                                    transition={{
                                        duration: 0.6,
                                        ease: [0.16, 1, 0.3, 1],
                                        delay: 0.2
                                    }}
                                    className="h-full"
                                >
                                    <ImageCanvas
                                        images={canvasImages}
                                        onImagesChange={setCanvasImages}
                                        flyingImage={flyingImage}
                                        onFlyingComplete={handleFlyingComplete}
                                    />
                                </motion.div>
                            </ResizablePanel>
                        </ResizablePanelGroup>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default function ImagePage() {
    const router = useRouter();
    const { user } = useAuth();
    const [searchOpen, setSearchOpen] = useState(false);
    const [libraryOpen, setLibraryOpen] = useState(false);

    const handleNewThread = () => {
        router.push("/");
    };

    const handleSearch = () => {
        if (!user) {
            router.push("/login");
            return;
        }
        setSearchOpen(true);
    };

    const handleLibrary = () => {
        if (!user) {
            router.push("/login");
            return;
        }
        setLibraryOpen(true);
    };

    const handleThreadSelect = async (id: string) => {
        router.push(`/?threadId=${id}`);
        setSearchOpen(false);
    };

    return (
        <>
            <SearchDialog
                open={searchOpen}
                onOpenChange={setSearchOpen}
                onThreadSelect={handleThreadSelect}
            />
            <LibraryDialog
                open={libraryOpen}
                onOpenChange={setLibraryOpen}
            />
            <MainLayout
                sidebarProps={{
                    onNewThread: handleNewThread,
                    onSearch: handleSearch,
                    onLibrary: handleLibrary,
                    onThreadSelect: handleThreadSelect,
                }}
            >
                <Suspense fallback={
                    <div className="flex h-screen items-center justify-center">
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                }>
                    <ImagePageContent />
                </Suspense>
            </MainLayout>
        </>
    );
}
