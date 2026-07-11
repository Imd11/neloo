"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { FortySecondsCVTemplate } from "@/app/resume/templates/forty-seconds-cv/FortySecondsCVTemplate";
import { AltaCVTemplate } from "@/app/resume/templates/altacv/AltaCVTemplate";
import { MinimalCVTemplate } from "@/app/resume/templates/minimal-cv/MinimalCVTemplate";
import { SidebarCVTemplate } from "@/app/resume/templates/sidebar-cv/SidebarCVTemplate";
import { LuxSleekCVTemplate } from "@/app/resume/templates/luxsleek-cv/LuxSleekCVTemplate";
import { HipsterCVTemplate } from "@/app/resume/templates/hipster-cv/HipsterCVTemplate";
import { TimelineCVTemplate } from "@/app/resume/templates/timeline-cv/TimelineCVTemplate";
import { ModernCVTemplate } from "@/app/resume/templates/modern-cv/ModernCVTemplate";
import { ClassicCVTemplate } from "@/app/resume/templates/classic-cv/ClassicCVTemplate";
import { StyleSettingsPanel } from "@/app/resume/components/StyleSettingsPanel";
import { ContentForm } from "@/app/resume/components/ContentForm";
import { TemplateGallery } from "@/app/resume/components/TemplateGallery";
import type { TemplateId } from "@/app/resume/components/TemplateGallery";
import { ChatPanel } from "@/app/resume/components/ChatPanel";
import { StepWizard } from "@/app/resume/components/StepWizard";
import { ZoomControls } from "@/app/resume/components/ZoomControls";
import { parseResumeWithBackend } from "@/app/resume/lib/smartResumeClient";
import { parseResumeText } from "@/app/resume/lib/resumeParser";
import { extractTextFromImage } from "@/app/resume/lib/ocr";
import type { ResumeData, StyleSettings } from "@/app/resume/types/resume";
import {
  defaultResumeData,
  defaultStyleSettings,
} from "@/app/resume/types/resume";
import { getPagePreset } from "@/app/resume/lib/pageSize";
import { useSidebar } from "@/app/context/SidebarContext";
import "@/app/resume/components/StepWizard.css";

type TabType = "content" | "style" | "template";
type ResumeMode = "idle" | "parsing" | "wizard" | "editor";

const tabs: { id: TabType; icon: string; label: string }[] = [
  { id: "content", icon: "📝", label: "内容" },
  { id: "style", icon: "🎨", label: "样式" },
  { id: "template", icon: "📋", label: "模板" },
];

// Template renderer component
function TemplateRenderer({
  templateId,
  data,
  style,
  onDataChange,
}: {
  templateId: TemplateId;
  data: ResumeData;
  style: StyleSettings;
  onDataChange: (data: ResumeData) => void;
}) {
  switch (templateId) {
    case "forty-seconds-cv":
      return (
        <FortySecondsCVTemplate
          data={data}
          style={style}
          onDataChange={onDataChange}
        />
      );
    case "altacv":
      return (
        <AltaCVTemplate
          data={data}
          style={style}
          onDataChange={onDataChange}
        />
      );
    case "minimal-cv":
      return (
        <MinimalCVTemplate
          data={data}
          style={style}
          onDataChange={onDataChange}
        />
      );
    case "sidebar-cv":
      return (
        <SidebarCVTemplate
          data={data}
          style={style}
          onDataChange={onDataChange}
        />
      );
    case "luxsleek-cv":
      return (
        <LuxSleekCVTemplate
          data={data}
          style={style}
        />
      );
    case "hipster-cv":
      return (
        <HipsterCVTemplate
          data={data}
          style={style}
        />
      );
    case "timeline-cv":
      return (
        <TimelineCVTemplate
          data={data}
          style={style}
        />
      );
    case "modern-cv":
      return (
        <ModernCVTemplate
          data={data}
          style={style}
        />
      );
    case "classic-cv":
      return (
        <ClassicCVTemplate
          data={data}
          style={style}
        />
      );
    default:
      return (
        <FortySecondsCVTemplate
          data={data}
          style={style}
          onDataChange={onDataChange}
        />
      );
  }
}

interface ResumeExperienceProps {
  onExit: () => void;
  initialFile?: File | null;
  initialPrompt?: string;
  selectedTemplate?: TemplateId;
  skipUpload?: boolean;
}

export function ResumeExperience({
  onExit,
  initialFile,
  initialPrompt = "",
  selectedTemplate = "forty-seconds-cv",
  skipUpload = false,
}: ResumeExperienceProps) {
  const { setCollapsed, setHideTopBar } = useSidebar();

  // Core state
  const [mode, setMode] = useState<ResumeMode>(
    skipUpload ? "wizard" : initialFile ? "parsing" : "wizard"
  );
  const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
  const [styleSettings, setStyleSettings] =
    useState<StyleSettings>(defaultStyleSettings);
  const [activeTab, setActiveTab] = useState<TabType>("content");
  const [activeTemplate, setActiveTemplate] =
    useState<TemplateId>(selectedTemplate);
  const pagePreset = getPagePreset(styleSettings.pageSize);

  // Parsing state
  const [parseError, setParseError] = useState("");

  // Editor Mode state
  const [formWidth, setFormWidth] = useState(360);
  const [chatWidth, setChatWidth] = useState(420);
  const [resizingPanel, setResizingPanel] = useState<"form" | "chat" | null>(
    null
  );
  const previewRef = useRef<HTMLDivElement>(null);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(0.55);

  // Collapse sidebar and hide TopBar on mount
  useEffect(() => {
    setCollapsed(true);
    setHideTopBar(true);
    return () => setHideTopBar(false);
  }, [setCollapsed, setHideTopBar]);

  // Parse file on mount if provided
  useEffect(() => {
    if (initialFile && mode === "parsing") {
      parseFile(initialFile);
    }
  }, []);

  // Calculate auto-fit scale
  const calculateAutoFitScale = useCallback(() => {
    if (!previewContainerRef.current) return 0.55;
    const container = previewContainerRef.current;
    const padding = 48;
    const containerWidth = container.clientWidth - padding;
    const containerHeight = container.clientHeight - padding;
    const pageWidth = 794;
    const pageHeight = 1123;
    const scaleX = containerWidth / pageWidth;
    const scaleY = containerHeight / pageHeight;
    return Math.min(scaleX, scaleY, 1);
  }, []);

  const handleAutoFit = useCallback(() => {
    setPreviewScale(calculateAutoFitScale());
  }, [calculateAutoFitScale]);

  // Handle resize
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (resizingPanel === "form") {
        const newWidth = e.clientX - 64;
        setFormWidth(Math.max(280, Math.min(500, newWidth)));
      } else if (resizingPanel === "chat") {
        const newWidth = window.innerWidth - e.clientX;
        setChatWidth(Math.max(280, Math.min(500, newWidth)));
      }
    };

    const handleMouseUp = () => {
      setResizingPanel(null);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    if (resizingPanel) {
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingPanel]);

  useEffect(() => {
    const styleId = "resume-page-size-style";
    let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement("style");
      styleEl.id = styleId;
      document.head.appendChild(styleEl);
    }
    styleEl.textContent = `@page { size: ${pagePreset.printSize}; margin: 0; }`;
  }, [pagePreset.printSize]);

  // Parse file
  const parseFile = async (file: File) => {
    try {
      let data: ResumeData;
      if (file.type === "application/pdf") {
        data = await parseResumeWithBackend(file);
      } else if (file.type.startsWith("text/")) {
        const text = await file.text();
        if (!text.trim()) throw new Error("无法从文件中提取文字");
        data = await parseResumeText(text);
      } else if (file.type.startsWith("image/")) {
        const text = await extractTextFromImage(file);
        if (!text.trim()) throw new Error("无法从图片中识别文字");
        data = await parseResumeText(text);
      } else {
        throw new Error("请上传 PDF、TXT 或图片文件");
      }
      setResumeData(data);
      setMode("wizard");
    } catch (err) {
      setParseError(err instanceof Error ? err.message : "解析失败");
    }
  };

  // Export PDF
  const handleExportPDF = async () => {
    if (!previewRef.current) return;

    const content = previewRef.current.innerHTML;
    const linkTags = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    )
      .map(
        (link) =>
          `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`
      )
      .join("\n");
    const styleTags = Array.from(document.querySelectorAll("style"))
      .map((style) => `<style>${style.textContent || ""}</style>`)
      .join("\n");

    const fullHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Resume - ${resumeData.personal.name}</title>
          ${linkTags}
          ${styleTags}
          <style>
            body { 
              margin: 0;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            @page { size: ${pagePreset.printSize}; margin: 0; }
            @media print {
              body { margin: 0; }
              .resume-preview { transform: none !important; }
            }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `;

    const filename = `${resumeData.personal.name || "resume"}.pdf`;
    const apiBase = process.env.NEXT_PUBLIC_API_URL || "";
    const backendUrl = `${apiBase}/api/resume/pdf`;

    try {
      const response = await fetch(backendUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ html: fullHTML, filename }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        return;
      }
    } catch (error) {
      console.warn("Backend PDF failed, using fallback:", error);
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) return;
    printWindow.document.write(fullHTML);
    printWindow.document.close();
    setTimeout(() => printWindow.print(), 500);
  };

  // Parsing mode - show loading or error
  if (mode === "parsing") {
    return (
      <div className="flex h-full items-center justify-center">
        {parseError ? (
          <div className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
              <span className="text-3xl">❌</span>
            </div>
            <p className="mb-2 text-lg font-medium text-red-600 dark:text-red-400">
              解析失败
            </p>
            <p className="mb-4 text-sm text-red-500">{parseError}</p>
            <div className="flex justify-center gap-3">
              <button
                onClick={() => {
                  setParseError("");
                  setMode("wizard");
                }}
                className="rounded-lg bg-muted px-4 py-2 text-sm text-foreground transition-colors hover:bg-muted/80"
              >
                手动填写
              </button>
              <button
                onClick={onExit}
                className="rounded-lg border border-border px-4 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                返回
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center">
            <div className="border-primary/20 mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-4 border-t-primary" />
            <p className="text-lg font-medium text-foreground">
              AI 正在解析简历...
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              这可能需要几秒钟
            </p>
          </div>
        )}
      </div>
    );
  }

  // Wizard mode
  if (mode === "wizard") {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 1.02 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        className="h-full"
      >
        <StepWizard
          data={resumeData}
          onChange={setResumeData}
          onComplete={() => setMode("editor")}
          active={true}
        />
      </motion.div>
    );
  }

  // Editor mode
  return (
    <motion.div
      initial={{ opacity: 0, scale: 1.02 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      className="flex h-screen flex-col bg-gray-100"
    >
      {/* Header */}
      <header className="no-print flex h-14 shrink-0 items-center justify-between border-b bg-white px-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setMode("wizard")}
            className="text-sm text-gray-500 transition-colors hover:text-gray-700"
          >
            ← 返回向导
          </button>
          <h1 className="text-lg font-semibold text-gray-800">📄 简历编辑器</h1>
        </div>
        <button
          onClick={handleExportPDF}
          className="rounded-full bg-gradient-to-r from-indigo-500 to-purple-500 px-5 py-2 text-sm font-semibold text-white transition-all hover:shadow-lg"
        >
          导出 PDF
        </button>
      </header>

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left Tab Sidebar */}
        <nav className="no-print flex w-16 shrink-0 flex-col bg-gray-900">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex flex-col items-center gap-1 py-4 transition-colors ${
                activeTab === tab.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
            >
              <span className="text-xl">{tab.icon}</span>
              <span className="text-xs">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Form Panel */}
        <aside
          style={{ width: formWidth }}
          className="no-print shrink-0 overflow-y-auto border-r bg-white p-4"
        >
          {activeTab === "content" && (
            <ContentForm
              data={resumeData}
              onChange={setResumeData}
            />
          )}
          {activeTab === "style" && (
            <StyleSettingsPanel
              settings={styleSettings}
              onChange={setStyleSettings}
            />
          )}
          {activeTab === "template" && (
            <TemplateGallery
              activeTemplate={activeTemplate}
              onSelectTemplate={setActiveTemplate}
            />
          )}
        </aside>

        {/* Form Resize Handle */}
        <div
          onMouseDown={() => setResizingPanel("form")}
          className={`no-print w-1.5 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-indigo-500 ${
            resizingPanel === "form" ? "bg-indigo-500" : ""
          }`}
        />

        {/* Preview Panel */}
        <main
          ref={previewContainerRef}
          className="relative flex flex-1 justify-center overflow-auto bg-gray-200 p-6"
        >
          <div
            ref={previewRef}
            className="resume-preview origin-top"
            style={{ transform: `scale(${previewScale})` }}
          >
            <div
              className="resume-page"
              style={
                {
                  "--page-width": pagePreset.width,
                  "--page-height": pagePreset.height,
                } as CSSProperties
              }
            >
              <TemplateRenderer
                templateId={activeTemplate}
                data={resumeData}
                style={styleSettings}
                onDataChange={setResumeData}
              />
            </div>
          </div>
          <ZoomControls
            scale={previewScale}
            onScaleChange={setPreviewScale}
            onAutoFit={handleAutoFit}
          />
        </main>

        {/* Chat Resize Handle */}
        <div
          onMouseDown={() => setResizingPanel("chat")}
          className={`no-print w-1.5 shrink-0 cursor-col-resize bg-gray-200 transition-colors hover:bg-indigo-500 ${
            resizingPanel === "chat" ? "bg-indigo-500" : ""
          }`}
        />

        {/* Chat Panel */}
        <aside
          style={{ width: chatWidth }}
          className="no-print shrink-0 overflow-hidden border-l bg-white"
        >
          <ChatPanel
            resumeData={resumeData}
            onDataChange={setResumeData}
          />
        </aside>
      </div>
    </motion.div>
  );
}
