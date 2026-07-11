"use client";

import { useState, useCallback, useEffect, Suspense, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { MessageSquarePlus, ChevronDown, Check, Search } from "lucide-react";
import { RotatingHeadline } from "@/app/components/RotatingHeadline";
import { PromptInput } from "@/app/components/PromptInput";
import {
  ImageConfigBar,
  Resolution,
  ImageRatio,
} from "@/app/components/ImageConfigBar";
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
import { features } from "@/data/featureTemplates";
import { useLanguage } from "@/providers/LanguageProvider";
import { rateLimitRetryAfter } from "@/lib/rateLimitError";

// Import logos for image models
import nanoBananaLogo from "@/assets/logos/nano-banana.png";
import openaiLogo from "@/assets/logos/openai.png";

// Logos that need dark background in light mode
const lightLogos = [openaiLogo];

interface ModelInfo {
  name: string;
  logo: typeof nanoBananaLogo;
  available: boolean; // true = 可用, false = 即将上线
  modelId?: string; // Optional: specific model ID to use with API
}

const imageModels: ModelInfo[] = [
  {
    name: "Nano Banana 2",
    logo: nanoBananaLogo,
    available: false,
    modelId: "gemini",
  },
  {
    name: "GPT Image 2",
    logo: openaiLogo,
    available: false,
    modelId: "gpt-image-2",
  },
];

const SUPPORTED_IMAGE_RATIOS: ImageRatio[] = [
  "auto",
  "1x1",
  "16x9",
  "9x16",
  "4x3",
  "3x4",
];

export function ImagePageContent({ onExit }: { onExit?: () => void } = {}) {
  const router = useRouter();
  const { setCollapsed, setHideTopBar } = useSidebar();
  const { session } = useAuth();
  const { t } = useLanguage();
  const config = getConfig();
  const threads = useThreads({ limit: 20 });

  const [isEditMode, setIsEditMode] = useState(false);
  const imageFeature = features.find((f) => f.id === "image") ?? null;
  const [messages, setMessages] = useState<ImageMessage[]>([]);
  const [canvasImages, setCanvasImages] = useState<CanvasImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [imageModel, setImageModel] = useState<ModelInfo>(imageModels[0]);
  const [availableImageModels, setAvailableImageModels] =
    useState<ModelInfo[]>(imageModels);
  const [resolution, setResolution] = useState<Resolution>("1k");
  const [ratio, setRatio] = useState<ImageRatio>("auto");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedImageTemplate, setSelectedImageTemplate] =
    useState<Template | null>(null);
  const [templateInputVersion, setTemplateInputVersion] = useState(0);
  const [flyingImage, setFlyingImage] = useState<{
    id: string;
    src: string;
    startRect: DOMRect;
    generationParams?: CanvasImage["generationParams"];
  } | null>(null);
  const generationParamsByUrlRef = useRef<
    Map<string, CanvasImage["generationParams"]>
  >(new Map());
  const generationAbortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchImageProviderStatus() {
      try {
        const response = await fetch("/api/image-providers");
        if (!response.ok) return;

        const data = await response.json();
        const availability = new Map<string, boolean>(
          (data.models || []).map(
            (model: { id: string; available: boolean }) => [
              model.id,
              model.available,
            ]
          )
        );
        const modelNames = new Map<string, string>(
          (data.models || []).map(
            (model: { id: string; model_name?: string }) => [
              model.id,
              model.model_name || "",
            ]
          )
        );
        const nextModels = imageModels.map((model) => ({
          ...model,
          name: modelNames.get(model.modelId || "") || model.name,
          available: availability.get(model.modelId || "") ?? false,
        }));

        if (!cancelled) {
          setAvailableImageModels(nextModels);
          setImageModel(
            (current) =>
              nextModels.find(
                (model) => model.modelId === current.modelId && model.available
              ) ||
              nextModels.find((model) => model.available) ||
              nextModels[0]
          );
        }
      } catch (error) {
        console.error(
          "[ImagePage] Failed to fetch image provider status:",
          error
        );
      }
    }

    void fetchImageProviderStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  // Thread/conversation state for history
  const [threadId, setThreadId] = useState<string | null>(null);
  const threadCreatedRef = useRef(false);
  const titleGeneratedRef = useRef(false);

  // Create thread for image generation history
  const createImageThread = useCallback(
    async (firstMessage: string) => {
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
            title:
              firstMessage.slice(0, 30) +
              (firstMessage.length > 30 ? "..." : ""),
            type: "image", // Mark as image type
          }),
        });

        if (response.ok) {
          console.log("[ImagePage] Created thread:", newThreadId.slice(0, 8));
          setThreadId(newThreadId);
          threads.mutate?.(); // Refresh sidebar
          return newThreadId;
        }
      } catch (error) {
        console.error("[ImagePage] Failed to create thread:", error);
      }
      return null;
    },
    [config, session, threadId, threads]
  );

  // Generate smart title for thread
  const generateTitle = useCallback(
    async (currentThreadId: string, userMessage: string) => {
      if (!config?.deploymentUrl || !session?.access_token) return;
      if (titleGeneratedRef.current) return;

      titleGeneratedRef.current = true;

      try {
        const response = await fetch(
          `${config.deploymentUrl}/api/threads/${encodeURIComponent(
            currentThreadId
          )}/generate-title`,
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
          threads.mutate?.(); // Refresh sidebar
        }
      } catch (error) {
        console.error("[ImagePage] Failed to generate title:", error);
      }
    },
    [config, session, threads]
  );

  // Hide global TopBar in edit mode
  useEffect(() => {
    setHideTopBar(isEditMode);
    return () => setHideTopBar(false);
  }, [isEditMode, setHideTopBar]);

  const filteredModels = availableImageModels.filter((model) =>
    model.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = useCallback(
    async (value: string) => {
      if (!imageModel.available) {
        toast.error(`${imageModel.name} ${t("model_selector.not_configured")}`);
        return;
      }

      // Collapse sidebar
      setCollapsed(true);

      // Enter edit mode
      setIsEditMode(true);

      // Add user message
      const userMessage: ImageMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: value,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

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
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, loadingMessage]);
      setIsGenerating(true);
      const controller = new AbortController();
      generationAbortRef.current = controller;

      try {
        // Call real API
        const response = await fetch("/api/generate-image", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(session?.access_token
              ? { Authorization: `Bearer ${session.access_token}` }
              : {}),
          },
          body: JSON.stringify({
            prompt: value,
            resolution: resolution,
            ...(ratio !== "auto" && { size: ratio }),
            ...(imageModel.modelId && { model: imageModel.modelId }),
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          const retryAfter = rateLimitRetryAfter(response);
          if (retryAfter !== null) {
            throw new Error(t("errors.rate_limited", { seconds: retryAfter }));
          }
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

        generationParamsByUrlRef.current.set(generatedImageUrl, {
          prompt: value,
          resolution,
          ...(ratio !== "auto" ? { size: ratio } : {}),
          ...(imageModel.modelId ? { modelId: imageModel.modelId } : {}),
          modelName: imageModel.name,
        });

        // Preload image then trigger auto fly animation
        const img = new Image();
        img.onload = () => {
          setMessages((prev) =>
            prev.map((msg) =>
              msg.id === aiMessageId
                ? {
                    ...msg,
                    content: "",
                    imageUrl: generatedImageUrl,
                    isLoading: false,
                    autoFly: true,
                  }
                : msg
            )
          );
          setIsGenerating(false);
          toast.success(t("chat.image_generation_complete"));
        };
        img.onerror = () => {
          toast.error(t("chat.image_load_failed"));
          setMessages((prev) => prev.filter((msg) => msg.id !== aiMessageId));
          setIsGenerating(false);
        };
        img.src = generatedImageUrl;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        console.error("[ImagePage] Generation failed:", error);
        setMessages((prev) => prev.filter((msg) => msg.id !== aiMessageId));
        setIsGenerating(false);
        toast.error(
          error instanceof Error
            ? error.message
            : t("chat.image_generation_failed")
        );
      } finally {
        if (generationAbortRef.current === controller) {
          generationAbortRef.current = null;
        }
      }
    },
    [
      setCollapsed,
      messages,
      createImageThread,
      generateTitle,
      imageModel,
      ratio,
      resolution,
      session?.access_token,
      t,
    ]
  );

  const handleSelectTemplate = (template: Template) => {
    setSelectedImageTemplate(template);
    setTemplateInputVersion((version) => version + 1);
    toast.info(t("chat.selected_template_toast", { name: template.title }));
  };

  const handleClearTemplate = () => {
    setSelectedImageTemplate(null);
    setTemplateInputVersion((version) => version + 1);
  };

  const handleImageGenerated = useCallback(
    (imageUrl: string, imageElement: HTMLImageElement) => {
      const rect = imageElement.getBoundingClientRect();

      // Start flying animation
      setFlyingImage({
        id: `canvas-${Date.now()}`,
        src: imageUrl,
        startRect: rect,
        generationParams: generationParamsByUrlRef.current.get(imageUrl),
      });
    },
    []
  );

  const handleFlyingComplete = useCallback(() => {
    setFlyingImage(null);
  }, []);

  const handleStopGeneration = useCallback(() => {
    generationAbortRef.current?.abort();
    generationAbortRef.current = null;
    setIsGenerating(false);
    setMessages((prev) => prev.filter((msg) => !msg.isLoading));
  }, []);

  // Mark autoFly as complete to prevent re-triggering
  const handleMarkAutoFlown = useCallback((messageId: string) => {
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, autoFly: false } : msg
      )
    );
  }, []);

  const handleEditTargetSelected = useCallback(
    (params?: CanvasImage["generationParams"]) => {
      if (!params) return;

      const matchedModel = availableImageModels.find(
        (model) =>
          model.available &&
          ((params.modelId && model.modelId === params.modelId) ||
            (params.modelName && model.name === params.modelName))
      );
      if (matchedModel) {
        setImageModel(matchedModel);
      }

      if (params.resolution) {
        setResolution(params.resolution);
      }

      if (
        params.size &&
        SUPPORTED_IMAGE_RATIOS.includes(params.size as ImageRatio)
      ) {
        setRatio(params.size as ImageRatio);
      } else {
        setRatio("auto");
      }
    },
    [availableImageModels]
  );

  // Handle new conversation (stay in edit mode, clear messages)
  const handleNewConversation = useCallback(() => {
    setMessages([]);
    setCanvasImages([]);
    setSelectedImageTemplate(null);
    setTemplateInputVersion((version) => version + 1);
    toast.info(t("chat.new_conversation_started"));
  }, [t]);

  // Handle template selection from chat panel
  const handleChatTemplateSelect = useCallback(
    (prompt: string) => {
      toast.info(
        t("chat.selected_template_toast", {
          name: prompt.slice(0, 24) || t("chat.select_template"),
        })
      );
    },
    [t]
  );

  return (
    <div className="flex h-full flex-col overflow-hidden">
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
                ease: [0.16, 1, 0.3, 1],
              },
            }}
            className="flex h-full flex-col overflow-y-auto"
          >
            {/* Top Section - Centered Content */}
            <div className="flex flex-1 flex-col items-center px-6">
              <div className="flex w-full max-w-4xl flex-col items-center gap-8 pt-[28vh]">
                {/* Rotating Headline */}
                <div>
                  <RotatingHeadline />
                </div>

                {/* Prompt Input */}
                <div className="mx-auto flex w-full max-w-3xl flex-col items-center gap-4">
                  <PromptInput
                    key={`image-prompt-${templateInputVersion}`}
                    placeholder={t("features.items.image.placeholder")}
                    initialValue={selectedImageTemplate?.prompt ?? ""}
                    onSubmit={handleSubmit}
                    selectedFeature={imageFeature}
                    selectedTemplateName={selectedImageTemplate?.title ?? null}
                    onClearTemplate={handleClearTemplate}
                    onClearFeature={() => {
                      if (onExit) {
                        onExit();
                        return;
                      }
                      router.push("/");
                    }}
                  />
                  <ImageConfigBar
                    ratio={ratio}
                    onRatioChange={setRatio}
                    resolution={resolution}
                    onResolutionChange={setResolution}
                  />
                </div>
              </div>
            </div>

            {/* Template Section */}
            <div className="flex-shrink-0 px-6 py-12">
              <div className="mx-auto max-w-4xl">
                <h2 className="mb-4 text-lg font-medium text-foreground">
                  {t("chat.image_template_inspiration")}
                </h2>
                <TabbedTemplateGrid
                  type="image"
                  onSelectTemplate={handleSelectTemplate}
                  selectedTemplateId={selectedImageTemplate?.id ?? null}
                />
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
              delay: 0.1,
            }}
            className="h-full"
          >
            <ResizablePanelGroup
              direction="horizontal"
              className="h-full"
            >
              {/* Left - Chat Panel (Resizable) */}
              <ResizablePanel
                defaultSize={25}
                minSize={15}
                maxSize={50}
                className="flex h-full flex-col"
              >
                <motion.div
                  initial={{ x: -60, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.15,
                  }}
                  className="flex h-full flex-col"
                >
                  {/* Chat Header - Model Selector (left) + New Conversation (right) */}
                  <div className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-background px-4">
                    {/* Model Selector */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          variant="ghost"
                          className="h-8 gap-2 px-2 font-medium text-foreground hover:bg-hover-bg"
                        >
                          <span
                            className={cn(
                              "flex h-5 w-5 items-center justify-center rounded-full",
                              lightLogos.includes(imageModel.logo) &&
                                "bg-foreground dark:bg-transparent"
                            )}
                          >
                            <img
                              src={imageModel.logo.src}
                              alt=""
                              className="h-4 w-4 object-contain"
                            />
                          </span>
                          <span className="max-w-[100px] truncate text-sm">
                            {imageModel.name}
                          </span>
                          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-64 border-border bg-popover p-2"
                      >
                        <div className="relative mb-2">
                          <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                          <input
                            type="text"
                            placeholder={t("model_selector.search_placeholder")}
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full rounded-lg border border-border bg-input-bg py-2 pl-8 pr-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
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
                                "flex cursor-pointer items-center gap-2 rounded-md",
                                model.available
                                  ? "text-foreground hover:bg-hover-bg focus:bg-hover-bg"
                                  : "cursor-not-allowed text-muted-foreground opacity-60",
                                imageModel.name === model.name && "bg-accent"
                              )}
                            >
                              <span
                                className={cn(
                                  "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full",
                                  lightLogos.includes(model.logo) &&
                                    "bg-foreground dark:bg-transparent"
                                )}
                              >
                                <img
                                  src={model.logo.src}
                                  alt=""
                                  className="h-4 w-4 object-contain"
                                />
                              </span>
                              <span className="flex-1 text-sm">
                                {model.name}
                              </span>
                              {!model.available && (
                                <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                                  {t("model_selector.not_configured")}
                                </span>
                              )}
                              {imageModel.name === model.name &&
                                model.available && (
                                  <Check className="h-4 w-4 flex-shrink-0 text-foreground" />
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
                      className="h-8 gap-1.5 border-border px-3 text-muted-foreground hover:text-foreground"
                    >
                      <MessageSquarePlus className="h-4 w-4" />
                      <span className="text-xs">
                        {t("chat.new_conversation_short")}
                      </span>
                    </Button>
                  </div>
                  <div className="min-h-0 flex-1">
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
              <ResizableHandle className="hover:bg-primary/20 relative w-[3px] cursor-col-resize bg-transparent transition-colors after:absolute after:inset-y-0 after:left-1/2 after:w-px after:-translate-x-1/2 after:bg-border" />

              {/* Right - Canvas */}
              <ResizablePanel
                defaultSize={75}
                className="h-full"
              >
                <motion.div
                  initial={{ x: 80, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{
                    duration: 0.6,
                    ease: [0.16, 1, 0.3, 1],
                    delay: 0.2,
                  }}
                  className="h-full"
                >
                  <ImageCanvas
                    images={canvasImages}
                    onImagesChange={setCanvasImages}
                    editModelId={imageModel.modelId}
                    editModelName={imageModel.name}
                    editResolution={resolution}
                    editSize={ratio !== "auto" ? ratio : undefined}
                    onEditTargetSelected={handleEditTargetSelected}
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
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);

  const handleNewThread = () => {
    router.push("/");
  };

  const handleSearch = () => {
    setSearchOpen(true);
  };

  const handleLibrary = () => {
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
        topBarProps={{
          mode: "image",
        }}
      >
        <Suspense
          fallback={
            <div className="flex h-screen items-center justify-center">
              <p className="text-muted-foreground">Loading...</p>
            </div>
          }
        >
          <ImagePageContent />
        </Suspense>
      </MainLayout>
    </>
  );
}
