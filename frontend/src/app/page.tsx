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
import { UserAvatar, ThemeToggle } from "@/components/auth";

// Wrapper component to access ChatContext for FilePanel
function ChatWithFilePanel({
  assistant,
  showFilePanel,
  onCloseFilePanel,
}: {
  assistant: Assistant | null;
  showFilePanel: boolean;
  onCloseFilePanel: () => void;
}) {
  const { messages } = useChatContext();

  return (
    <div className="flex h-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatInterface assistant={assistant} />
      </div>
      {showFilePanel && (
        <div className="w-72 flex-shrink-0">
          <FilePanel messages={messages} onClose={onCloseFilePanel} />
        </div>
      )}
    </div>
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

  const fetchAssistant = useCallback(async () => {
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        config.assistantId
      );

    if (isUUID) {
      try {
        const data = await client.assistants.get(config.assistantId);
        setAssistant(data);
      } catch (error) {
        console.error("Failed to fetch assistant:", error);
        setAssistant({
          assistant_id: config.assistantId,
          graph_id: config.assistantId,
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
          graphId: config.assistantId,
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
          assistant_id: config.assistantId,
          graph_id: config.assistantId,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          config: {},
          metadata: {},
          version: 1,
          name: config.assistantId,
          context: {},
        });
      }
    }
  }, [client, config.assistantId]);

  useEffect(() => {
    fetchAssistant();
  }, [fetchAssistant]);

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
      <div className="flex h-screen">
        {/* Sidebar */}
        <AppSidebar
          onNewThread={handleNewThread}
          onSearch={handleSearch}
          onLibrary={handleLibrary}
          onThreadSelect={handleThreadSelect}
          onMutateReady={(fn) => setMutateThreads(() => fn)}
          onLogout={handleLogout}
          currentThreadId={threadId}
        />

        {/* Main content area */}
        <div className="flex-1 overflow-hidden">
          <ChatProvider
            activeAssistant={assistant}
            onHistoryRevalidate={() => mutateThreads?.()}
          >
            <ChatWithFilePanel
              assistant={assistant}
              showFilePanel={!!filePanel}
              onCloseFilePanel={() => setFilePanel(null)}
            />
          </ChatProvider>
        </div>
      </div>
    </>
  );
}

function HomePageContent() {
  const { loading: authLoading } = useAuth();
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
