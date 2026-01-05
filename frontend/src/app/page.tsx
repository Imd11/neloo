"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter } from "next/navigation";
import { useQueryState } from "nuqs";
import { getConfig, StandaloneConfig } from "@/lib/config";
import { Assistant } from "@langchain/langgraph-sdk";
import { ClientProvider, useClient } from "@/providers/ClientProvider";
import { useAuth } from "@/providers/AuthProvider";
import { ChatProvider, useChatContext } from "@/providers/ChatProvider";
import { ChatInterface } from "@/app/components/ChatInterface";
import { FilePanel } from "@/app/components/FilePanel";
import { AppSidebar } from "@/app/components/AppSidebar";
import { SearchDialog } from "@/app/components/SearchDialog";
import { LibraryDialog } from "@/app/components/LibraryDialog";
import { ModelSelector } from "@/app/components/ModelSelector";
import { ArtifactPreview } from "@/app/components/ArtifactPreview";
import { UserAvatar, ThemeToggle } from "@/components/auth";
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from "@/components/ui/resizable";
import { cn } from "@/lib/utils";
import type { Artifact } from "@/lib/artifactParser";

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
  const { messages, isLoading, webDevMode } = useChatContext();

  // Selected artifact from inline cards - this is what drives the right panel
  const [selectedArtifact, setSelectedArtifact] = useState<Artifact | null>(null);
  // Track if we're currently streaming (for the preview panel)
  const [isArtifactStreaming, setIsArtifactStreaming] = useState(false);

  // Handle artifact selection from inline cards
  const handleArtifactSelect = useCallback((artifact: Artifact | null) => {
    setSelectedArtifact(artifact);
    // If artifact id is "streaming", it's still being generated
    setIsArtifactStreaming(artifact?.id === "streaming");
  }, []);

  // Handle closing the artifact panel
  const handleCloseArtifactPanel = useCallback(() => {
    setSelectedArtifact(null);
  }, []);

  // Reset selected artifact when thread changes
  useEffect(() => {
    setSelectedArtifact(null);
  }, [threadId]);

  // Determine which right panel to show
  const showArtifactPreview = webDevMode && selectedArtifact !== null;
  const showFilePanelActual = showFilePanel && !showArtifactPreview;
  const showRightPanel = showArtifactPreview || showFilePanelActual;

  return (
    <ResizablePanelGroup
      direction="horizontal"
      className="h-full"
    >
      <ResizablePanel defaultSize={showRightPanel ? 60 : 100} minSize={40}>
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
          <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
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

interface HomePageInnerProps {
  config: StandaloneConfig;
}

function HomePageInner({ config }: HomePageInnerProps) {
  const client = useClient();
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [threadId, setThreadId] = useQueryState("threadId");
  const [filePanel, setFilePanel] = useQueryState("files");

  const [mutateThreads, setMutateThreads] = useState<(() => void) | null>(null);
  const [assistant, setAssistant] = useState<Assistant | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedModel, setSelectedModel] = useState<string | null>(null);

  const fetchAssistant = useCallback(async (modelId?: string | null) => {
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
  }, [client, config.assistantId]);

  // Fetch assistant when model changes
  useEffect(() => {
    fetchAssistant(selectedModel);
  }, [fetchAssistant, selectedModel]);

  const handleLogout = async () => {
    await signOut();
    router.push("/login");
  };

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
      {/* Theme Toggle and User Avatar - fixed top right */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <ThemeToggle />
        <UserAvatar />
      </div>
      {/* Model Selector - fixed top left of main content */}
      <div
        className={cn(
          "fixed top-4 z-50 transition-all duration-300",
          sidebarCollapsed ? "left-20" : "left-76"
        )}
        style={{ left: sidebarCollapsed ? "5rem" : "19rem" }}
      >
        <ModelSelector
          selectedModel={selectedModel}
          onModelChange={setSelectedModel}
        />
      </div>
      <div className="flex h-screen">
        {/* Sidebar - fixed width based on collapsed state */}
        <div
          className={cn(
            "flex-shrink-0 transition-all duration-300",
            sidebarCollapsed ? "w-16" : "w-72"
          )}
        >
          <AppSidebar
            onNewThread={handleNewThread}
            onSearch={handleSearch}
            onLibrary={handleLibrary}
            onThreadSelect={handleThreadSelect}
            onMutateReady={(fn) => setMutateThreads(() => fn)}
            onLogout={handleLogout}
            currentThreadId={threadId}
            collapsed={sidebarCollapsed}
            onCollapsedChange={setSidebarCollapsed}
          />
        </div>

        {/* Main content area */}
        <div className="flex-1 min-w-0">
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
      </div>
    </>
  );
}

function HomePageContent() {
  const { loading: authLoading, session } = useAuth();
  const [config, setConfig] = useState<StandaloneConfig | null>(null);
  const [configLoading, setConfigLoading] = useState(true);
  const [assistantId, setAssistantId] = useQueryState("assistantId");

  // Load config from environment variables
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

  // Show loading while checking auth or config
  if (authLoading || configLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    );
  }

  // If no config, show error message
  if (!config) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold">Configuration Required</h1>
          <p className="mt-2 text-muted-foreground">
            Please set NEXT_PUBLIC_API_URL environment variable
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Example: NEXT_PUBLIC_API_URL=http://localhost:2024
          </p>
        </div>
      </div>
    );
  }

  return (
    <ClientProvider
      deploymentUrl={config.deploymentUrl}
      apiKey={config.langsmithApiKey || ""}
      accessToken={session?.access_token}
    >
      <HomePageInner config={config} />
    </ClientProvider>
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
      <HomePageContent />
    </Suspense>
  );
}
