"use client";

import React, { useEffect, useState } from "react";
import { useSidebar } from "@/app/context/SidebarContext";
import { useQueryState } from "nuqs";
import { getConfig } from "@/lib/config";
import { useAuth } from "@/providers/AuthProvider";
import { useThreads } from "@/app/hooks/useThreads";
import Home from "@/app/components/slides/slidecraft/components/Home";
import OutlineEditor from "@/app/components/slides/slidecraft/components/OutlineEditor";
import SlideShow from "@/app/components/slides/slidecraft/components/SlideShow";
import {
  deletePresentation,
  getAllPresentations,
  getPresentation,
  savePresentation,
} from "@/app/slides/lib/slidesPersistence";
import type {
  Attachment,
  PresentationData,
  Slide,
  StyleDimensions,
} from "@/app/components/slides/slidecraft/types";

type SlideCraftView = "HOME" | "OUTLINE" | "SLIDESHOW";

interface SlidesExperienceProps {
  topic?: string;
  attachments?: Attachment[];
  presentationId?: string;
  userId?: string;
  onExit: () => void;
  onPresentationCreated?: (presentation: PresentationData) => void;
  initialFile?: File | null;
  initialPrompt?: string;
  initialPresetId?: string;
  initialStyle?: StyleDimensions;
  modelId?: string | null;
}

const SlidesExperience: React.FC<SlidesExperienceProps> = ({
  topic: propTopic,
  attachments: propAttachments = [],
  presentationId: initialPresentationId,
  onExit,
  onPresentationCreated,
  initialFile,
  initialPrompt,
  initialPresetId,
  initialStyle,
  modelId,
}) => {
  const { setCollapsed, setHideTopBar } = useSidebar();
  const { session, user } = useAuth();
  const threads = useThreads({ limit: 20 });
  const [, setThreadId] = useQueryState("threadId");
  const config = getConfig();
  const [topic, setTopic] = useState(propTopic || initialPrompt || "");
  const [attachments, setAttachments] = useState<Attachment[]>(propAttachments);
  const [isPreparingAttachments, setIsPreparingAttachments] = useState(
    Boolean(initialFile) && propAttachments.length === 0
  );
  const [isLoadingPresentation, setIsLoadingPresentation] = useState(false);
  const [view, setView] = useState<SlideCraftView>(
    initialPrompt && initialPresetId ? "OUTLINE" : "HOME"
  );
  const [slides, setSlides] = useState<Slide[]>([]);
  const [presentationId] = useState(
    initialPresentationId || crypto.randomUUID()
  );
  const [style, setStyle] = useState<StyleDimensions | undefined>(initialStyle);
  const [presetId, setPresetId] = useState<string | undefined>(initialPresetId);
  const [history, setHistory] = useState<PresentationData[]>([]);

  useEffect(() => {
    setCollapsed(true);
    setHideTopBar(true);

    return () => {
      setHideTopBar(false);
    };
  }, [setCollapsed, setHideTopBar]);

  useEffect(() => {
    let cancelled = false;

    const loadHistory = async () => {
      try {
        const presentations = await getAllPresentations(
          user?.id || "default",
          session?.access_token
        );
        if (!cancelled) {
          setHistory(
            presentations.map((item) => ({
              id: item.id,
              topic: item.topic,
              slides: item.slides as unknown as Slide[],
              createdAt: new Date(
                item.created_at || item.updated_at || Date.now()
              ).getTime(),
              style: item.style as StyleDimensions | undefined,
              presetId: item.preset_id || item.presetId,
            }))
          );
        }
      } catch (error) {
        console.error("[SlidesExperience] Failed to load PPT history:", error);
      }
    };

    void loadHistory();

    return () => {
      cancelled = true;
    };
  }, [user?.id, session?.access_token]);

  useEffect(() => {
    if (!initialPresentationId || initialPrompt) {
      return;
    }

    let cancelled = false;
    setIsLoadingPresentation(true);

    const loadPresentation = async () => {
      try {
        const presentation = await getPresentation(
          initialPresentationId,
          session?.access_token
        );
        if (!presentation || cancelled) {
          return;
        }

        setTopic(presentation.topic);
        setAttachments((presentation.attachments as Attachment[]) || []);
        setSlides((presentation.slides as unknown as Slide[]) || []);
        setStyle(presentation.style as StyleDimensions | undefined);
        setPresetId(presentation.preset_id || presentation.presetId);
        setView((presentation.slides?.length || 0) > 0 ? "SLIDESHOW" : "HOME");
      } catch (error) {
        console.error(
          "[SlidesExperience] Failed to load PPT presentation:",
          error
        );
      } finally {
        if (!cancelled) {
          setIsLoadingPresentation(false);
        }
      }
    };

    void loadPresentation();

    return () => {
      cancelled = true;
    };
  }, [initialPresentationId, initialPrompt, session?.access_token]);

  useEffect(() => {
    if (!initialFile || attachments.length > 0) {
      setIsPreparingAttachments(false);
      return;
    }

    let cancelled = false;
    const reader = new FileReader();

    reader.onload = () => {
      if (cancelled) {
        return;
      }

      const base64 = (reader.result as string)?.split(",")[1] || "";
      setAttachments([
        {
          name: initialFile.name,
          mimeType: initialFile.type || "application/octet-stream",
          data: base64,
        },
      ]);
      setIsPreparingAttachments(false);
    };

    reader.onerror = () => {
      if (!cancelled) {
        setIsPreparingAttachments(false);
      }
    };

    reader.readAsDataURL(initialFile);

    return () => {
      cancelled = true;
    };
  }, [initialFile, attachments.length]);

  const handleGenerateSlides = (generatedSlides: Slide[]) => {
    setSlides(generatedSlides);
    setView("SLIDESHOW");

    const presentation = {
      id: presentationId,
      topic,
      slides: generatedSlides,
      createdAt: Date.now(),
      style,
      presetId,
    };

    setHistory((prev) => {
      const withoutCurrent = prev.filter((item) => item.id !== presentation.id);
      return [presentation, ...withoutCurrent];
    });

    onPresentationCreated?.(presentation);
    void persistPresentation(presentation, generatedSlides);
  };

  const handleSlidesUpdate = (updatedSlides: Slide[]) => {
    setSlides(updatedSlides);
    setHistory((prev) =>
      prev.map((item) =>
        item.id === presentationId
          ? { ...item, slides: updatedSlides, topic, style, presetId }
          : item
      )
    );
    void persistPresentation(
      {
        id: presentationId,
        topic,
        slides: updatedSlides,
        createdAt: Date.now(),
        style,
        presetId,
      },
      updatedSlides
    );
  };

  const presentation: PresentationData = {
    id: presentationId,
    topic,
    slides,
    createdAt: Date.now(),
    style,
    presetId,
  };

  const handleHomeSubmit = (
    nextTopic: string,
    nextAttachments: Attachment[],
    nextStyle: StyleDimensions,
    nextPresetId?: string
  ) => {
    setTopic(nextTopic);
    setAttachments(nextAttachments);
    setStyle(nextStyle);
    setPresetId(nextPresetId);
    setView("OUTLINE");
    void ensureSlidesThread(nextTopic);
  };

  const ensureSlidesThread = async (threadTitle: string) => {
    if (!config?.deploymentUrl || !session?.access_token) {
      return;
    }

    try {
      const response = await fetch(`${config.deploymentUrl}/api/threads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          langgraph_thread_id: presentationId,
          title:
            threadTitle.slice(0, 30) + (threadTitle.length > 30 ? "..." : ""),
          type: "slides",
        }),
      });

      if (response.ok) {
        await setThreadId(presentationId);
        threads.mutate?.();
      }
    } catch (error) {
      console.error(
        "[SlidesExperience] Failed to create slides thread:",
        error
      );
    }
  };

  const persistPresentation = async (
    presentation: PresentationData,
    currentSlides: Slide[]
  ) => {
    try {
      await savePresentation(
        {
          id: presentation.id,
          user_id: user?.id || "default",
          title: presentation.topic,
          topic: presentation.topic,
          slides: currentSlides as any,
          attachments,
          style: presentation.style,
          preset_id: presentation.presetId,
        },
        session?.access_token
      );
    } catch (error) {
      console.error(
        "[SlidesExperience] Failed to persist presentation:",
        error
      );
    }
  };

  if (view === "SLIDESHOW") {
    return (
      <div className="h-full w-full overflow-hidden bg-zinc-950">
        <SlideShow
          presentation={presentation}
          style={style}
          modelId={modelId}
          accessToken={session?.access_token}
          onBack={() => setView("OUTLINE")}
          onSlidesUpdate={handleSlidesUpdate}
        />
      </div>
    );
  }

  if (isPreparingAttachments) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-white">
        <div className="text-sm text-zinc-400">正在准备 PPT 附件...</div>
      </div>
    );
  }

  if (isLoadingPresentation) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-zinc-950 text-white">
        <div className="text-sm text-zinc-400">正在加载 PPT...</div>
      </div>
    );
  }

  if (view === "HOME") {
    return (
      <div className="h-full w-full overflow-y-auto bg-zinc-950 text-white">
        <Home
          onSubmit={handleHomeSubmit}
          history={history}
          onLoadHistory={(loadedPresentation) => {
            void setThreadId(loadedPresentation.id);
            setTopic(loadedPresentation.topic);
            setSlides(loadedPresentation.slides);
            setStyle(loadedPresentation.style);
            setPresetId(loadedPresentation.presetId);
            setView("SLIDESHOW");
          }}
          onDeleteHistory={(id) => {
            void (async () => {
              try {
                await deletePresentation(id, session?.access_token);
                if (config?.deploymentUrl && session?.access_token) {
                  await fetch(
                    `${config.deploymentUrl}/api/threads/${encodeURIComponent(
                      id
                    )}`,
                    {
                      method: "DELETE",
                      headers: {
                        Authorization: `Bearer ${session.access_token}`,
                      },
                    }
                  );
                }
                setHistory((prev) => prev.filter((item) => item.id !== id));
                threads.mutate?.();
              } catch (error) {
                console.error(
                  "[SlidesExperience] Failed to delete presentation:",
                  error
                );
              }
            })();
          }}
          initialTopic={topic}
          initialAttachments={attachments}
          onBack={() => {
            void setThreadId(null);
            onExit();
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-hidden bg-zinc-950 text-white">
      <OutlineEditor
        topic={topic}
        attachments={attachments}
        style={style}
        presetId={presetId}
        modelId={modelId}
        accessToken={session?.access_token}
        onBack={onExit}
        onGenerateSlides={handleGenerateSlides}
      />
    </div>
  );
};

export default SlidesExperience;
