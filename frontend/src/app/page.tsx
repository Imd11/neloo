"use client";

import React, { useState, useEffect, useCallback, Suspense, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { getConfig, StandaloneConfig } from "@/lib/config";
import { Assistant, Message } from "@langchain/langgraph-sdk";
import { ClientProvider, useClient } from "@/providers/ClientProvider";
import { useAuth } from "@/providers/AuthProvider";
import { ChatProvider, useChatContext } from "@/providers/ChatProvider";
import { ChatInterface } from "@/app/components/ChatInterface";
import { FilePanel } from "@/app/components/FilePanel";
import { MainLayout } from "./components/layout/MainLayout";
import { SearchDialog } from "@/app/components/SearchDialog";
import { LibraryDialog } from "@/app/components/LibraryDialog";
import { ArtifactPreview } from "@/app/components/ArtifactPreview";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/artifactParser";
import { parseArtifacts, getStreamingArtifact } from "@/lib/artifactParser";
import { extractStringFromMessageContent } from "@/app/utils/utils";
import { Button } from "@/components/ui/button";
import { RotatingHeadline } from "@/app/components/RotatingHeadline";
import { PromptInput } from "@/app/components/PromptInput";
import { FeatureButtons } from "@/app/components/FeatureButtons";
import { FeatureTemplateGrid } from "@/app/components/FeatureTemplateGrid";
import { Feature, Template } from "@/data/featureTemplates";
import { motion, AnimatePresence } from "framer-motion";

interface LandingViewProps {
  onPromptSubmit: (value: string) => void;
  onSelectFeature: (feature: Feature | null) => void;
  selectedFeature: Feature | null;
}

function LandingView({ onPromptSubmit, onSelectFeature, selectedFeature }: LandingViewProps) {
  const router = useRouter();

  // Handle template selection
  const handleSelectTemplate = (template: Template) => {
    if (selectedFeature?.id === 'image') {
      router.push(`/image?template=${template.id}`);
    } else if (selectedFeature?.id === 'video') {
      router.push(`/video?template=${template.id}`);
    } else {
      // For text/chat features, we ideally start a new thread with this template
      console.log("Selected template:", template);
      // For now, just reset or maybe pre-fill input?
      onSelectFeature(null);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-[85vh] px-4 w-full max-w-5xl mx-auto space-y-10 animate-in fade-in duration-500">
      {/* 1. Rotating Headline */}
      <RotatingHeadline />

      {/* 2. Input Area */}
      <div className="w-full max-w-2xl space-y-6">
        <PromptInput
          placeholder="输入你的任务，或者选择下方功能..."
          selectedFeature={selectedFeature}
          onClearFeature={() => onSelectFeature(null)}
          onSubmit={onPromptSubmit}
          disabled={false}
        />

        <FeatureButtons
          selectedFeature={selectedFeature}
          onSelectFeature={onSelectFeature}
        />
      </div>

      {/* 3. Feature Template Grid (Expandable) */}
      <div className="w-full min-h-[200px]">
        <FeatureTemplateGrid
          feature={selectedFeature}
          onSelectTemplate={handleSelectTemplate}
        />
      </div>
    </div>
  );
}

// Wrapper component to access ChatContext for FilePanel and ArtifactPreview
function ChatWithFilePanel({
  assistant,
  showFilePanel,
  onOpenFilePanel,
  onCloseFilePanel,
  threadId,
}: {
  assistant: Assistant | null;
  showFilePanel: boolean;
  onOpenFilePanel: () => void;
  onCloseFilePanel: () => void;
  threadId: string | null;
}) {
  const { messages, isLoading, webDevMode, sendMessage } = useChatContext();
  const [selectedFeature, setSelectedFeature] = useState<Feature | null>(null);

  // Selected artifact from inline cards - this is what drives the right panel
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  // Track if we're currently streaming (for the preview panel)
  const [isArtifactStreaming, setIsArtifactStreaming] = useState(false);
  // Track if we're subscribed to streaming updates (user clicked on streaming artifact)
  const [isSubscribedToStreaming, setIsSubscribedToStreaming] = useState(false);

  // Get the last AI message for streaming artifact tracking
  const lastAiMessage = useMemo(() => {
    if (!messages || messages.length === 0) return null;
    // Find the last non-human message
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].type !== "human") {
        return messages[i];
      }
    }
    return null;
  }, [messages]);

  // Parse current artifact from the last AI message (for real-time updates)
  const currentStreamingArtifact = useMemo(() => {
    if (!lastAiMessage || !webDevMode || !isLoading) return null;

    const content = extractStringFromMessageContent(lastAiMessage);
    const streamingInfo = getStreamingArtifact(content);

    if (streamingInfo.isStreaming && streamingInfo.type) {
      return {
        id: "streaming",
        type: streamingInfo.type,
        title: streamingInfo.title,
        code: streamingInfo.partialCode || "",
      } as Artifact;
    }
    return null;
  }, [lastAiMessage, webDevMode, isLoading]);

  // Parse completed artifact from the last AI message
  const lastCompletedArtifact = useMemo(() => {
    if (!lastAiMessage || !webDevMode) return null;

    const content = extractStringFromMessageContent(lastAiMessage);
    const artifacts = parseArtifacts(content);

    return artifacts.length > 0 ? artifacts[artifacts.length - 1] : null;
  }, [lastAiMessage, webDevMode]);

  // Auto-open panel when streaming artifact is detected (no user click required)
  useEffect(() => {
    if (!webDevMode || !isLoading) return;

    // Auto-open panel when streaming artifact is detected
    if (currentStreamingArtifact && !selectedArtifact) {
      setSelectedArtifact(currentStreamingArtifact);
      setIsArtifactStreaming(true);
      setIsSubscribedToStreaming(true);
    }
  }, [webDevMode, isLoading, currentStreamingArtifact, selectedArtifact]);

  // Auto-update selectedArtifact when subscribed to streaming
  useEffect(() => {
    if (!isSubscribedToStreaming) return;

    if (isLoading && currentStreamingArtifact) {
      // Still streaming - update with latest content
      setSelectedArtifact(currentStreamingArtifact);
      setIsArtifactStreaming(true);
    } else if (!isLoading && lastCompletedArtifact) {
      // Streaming finished - switch to completed artifact
      setSelectedArtifact(lastCompletedArtifact);
      setIsArtifactStreaming(false);
      setIsSubscribedToStreaming(false); // Unsubscribe after completion
    } else if (!isLoading && !lastCompletedArtifact) {
      // Streaming finished but no artifact found (parsing failed or AI didn't output artifact tags)
      setIsSubscribedToStreaming(false);
    }
  }, [isSubscribedToStreaming, isLoading, currentStreamingArtifact, lastCompletedArtifact]);

  // Handle artifact selection from inline cards
  const handleArtifactSelect = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact);

    // If selecting a streaming artifact, subscribe to updates
    if (artifact?.id === "streaming") {
      setIsArtifactStreaming(true);
      setIsSubscribedToStreaming(true);
    } else {
      setIsArtifactStreaming(false);
      setIsSubscribedToStreaming(false);
    }
  }, []);

  // Handle closing the artifact panel
  const handleCloseArtifactPanel = useCallback(() => {
    setSelectedArtifact(null);
    setIsSubscribedToStreaming(false);
  }, []);

  // Reset selected artifact when thread changes
  useEffect(() => {
    setSelectedArtifact(null);
    setIsSubscribedToStreaming(false);
  }, [threadId]);

  // Determine view mode
  const showLandingView = messages.length === 0;

  // Determine right panel visibility
  const showArtifactPreview = webDevMode && selectedArtifact !== null;
  const showFilePanelActual = showFilePanel && !showArtifactPreview;
  const showRightPanel = showArtifactPreview || showFilePanelActual;

  if (showLandingView) {
    return (
      <div className="flex-1 overflow-y-auto">
        <LandingView
          onPromptSubmit={sendMessage}
          selectedFeature={selectedFeature}
          onSelectFeature={setSelectedFeature}
        />
      </div>
    );
  }

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full"
    >
      <ResizablePanel defaultSize={showRightPanel ? 50 : 100} minSize={40}>
        <div className="flex h-full flex-col overflow-hidden">
          <ChatInterface
            assistant={assistant}
            onOpenFilePanel={onOpenFilePanel}
            showFilePanelButton={!!threadId}
            selectedArtifact={selectedArtifact}
            onArtifactSelect={handleArtifactSelect}
          />
        </div>
      </ResizablePanel>

      {/* Artifact Preview Panel (Web Dev Mode) */}
      {showArtifactPreview && selectedArtifact && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={50} minSize={25} maxSize={60}>
            <ArtifactPreview
              artifact={selectedArtifact}
              isStreaming={isArtifactStreaming}
              onClose={handleCloseArtifactPanel}
            />
          </ResizablePanel>
        </>
      )}

      {/* File Panel */}
      {showFilePanelActual && (
        <>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={25} minSize={15} maxSize={40}>
            <FilePanel
              messages={messages}
              threadId={threadId || undefined}
              onClose={onCloseFilePanel}
              isStreamComplete={!isLoading}
            />
          </ResizablePanel>
        </>
      )}
    </ResizablePanelGroup>
  );
}


// Mock Login Component until authentic auth flow is integrated (or use real redirect)
function LoginComponent() {
  const router = useRouter();
  useEffect(() => {
    // In a real app we might redirect automatically:
    // router.push("/login");
  }, [router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold">Welcome to Mello</h1>
        <p className="text-muted-foreground">Please sign in to continue</p>
        <Button onClick={() => router.push("/login")}>Sign In</Button>
      </div>
    </div>
  );
}

function HomePageInner() {
  const client = useClient();
  const router = useRouter();
  const { user, session, loading: authLoading } = useAuth();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [filePanel, setFilePanel] = useQueryState("files");

  // Config state
  const [config, setConfig] = useState<StandaloneConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [assistantId, setAssistantId] = useQueryState("assistantId");

  const [mutateThreads, setMutateThreads] = useState<(() => void) | null>(null);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  // Load config
  useEffect(() => {
    const savedConfig = getConfig();
    if (savedConfig) {
      setConfig(savedConfig);
      if (!assistantId) {
        setAssistantId(savedConfig.assistantId);
      }
    }
    setConfigLoading(false);
  }, [assistantId, setAssistantId]);

  // Load thread's model preference when thread changes
  useEffect(() => {
    async function loadThreadModel() {
      if (!threadId || !config) return;

      try {
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers["Authorization"] = `Bearer ${session.access_token}`;
        }

        const response = await fetch(
          `${config.deploymentUrl}/api/threads/${threadId}`,
          { headers }
        );

        if (response.ok) {
          const thread = await response.json();
          // Use thread's model_id if set, otherwise keep current or use default
          if (thread.model_id) {
            setSelectedModel(thread.model_id);
          }
        }
      } catch (error) {
        console.error("Failed to load thread model:", error);
      }
    }

    loadThreadModel();
  }, [threadId, config, session?.access_token]);

  // Reset model to default when starting new thread
  useEffect(() => {
    if (!threadId) {
      // New thread - reset model to null (will use default)
      setSelectedModel(null);
    }
  }, [threadId]);

  // Fetch assistant
  const fetchAssistant = useCallback(async (modelId?: string | null) => {
    if (!config) return;

    // Use selected model as graph ID if available, otherwise fall back to config
    const graphId = modelId || config.assistantId;

    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        graphId
      );

    if (isUUID) {
      try {
        const data = await client.assistants.get(graphId);
        setAssistant(data);
      } catch (error) {
        console.error("Failed to fetch assistant:", error);
        setAssistant({
          assistant_id: graphId,
          graph_id: graphId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: "Assistant",
          context: {},
        });
      }
    } else {
      try {
        const assistants = await client.assistants.search({
          graphId: graphId,
          limit: 100,
        });
        const defaultAssistant = assistants.find(
          (assistant) => assistant.metadata?.["created_by"] === "system"
        );
        if (defaultAssistant === undefined) {
          throw new Error("No default assistant found");
        }
        setAssistant(defaultAssistant);
      } catch (error) {
        console.error(
          "Failed to find default assistant from graph_id:",
          error
        );
        setAssistant({
          assistant_id: graphId,
          graph_id: graphId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: graphId,
          context: {},
        });
      }
    }
  }, [client, config]);

  // Fetch assistant when model or config changes
  useEffect(() => {
    if (config) {
      fetchAssistant(selectedModel);
    }
  }, [fetchAssistant, selectedModel, config]);

  const handleNewThread = () => {
    if (!user) {
      router.push("/login");
      return;
    }
    setThreadId(null);
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
    await setThreadId(id);
    setSearchOpen(false);
  };

  // Auth Loading
  if (authLoading || configLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // Not Logged In
  if (!session) {
    return <LoginComponent />;
  }

  // No Config
  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configuration Required</h1>
          <p className="mt-2 text-muted-foreground">
            Please configure the application using the setup wizard.
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SearchDialog
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onThreadSelect={(id) => { handleThreadSelect(id); }}
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
          onThreadSelect: (id: string) => { handleThreadSelect(id); },
          onMutateReady: (fn: () => void) => setMutateThreads(() => fn),
          onInterruptCountChange: undefined
        }}
      >
        <div className="flex h-full flex-col">
          <ChatProvider
            activeAssistant={assistant}
            onHistoryRevalidate={() => mutateThreads?.()}
          >
            <ChatWithFilePanel
              assistant={assistant}
              showFilePanel={!!filePanel}
              onOpenFilePanel={() => setFilePanel("1")}
              onCloseFilePanel={() => setFilePanel(null)}
              threadId={threadId}
            />
          </ChatProvider>
        </div>
      </MainLayout>
    </>
  );
}

export default function HomePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      }
    >
      <HomePageInner />
    </Suspense>
  );
}

