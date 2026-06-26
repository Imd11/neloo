'use client';

import { useState, useRef, useEffect, useCallback, Suspense } from 'react';
import type { CSSProperties } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { FortySecondsCVTemplate } from './templates/forty-seconds-cv/FortySecondsCVTemplate';
import { AltaCVTemplate } from './templates/altacv/AltaCVTemplate';
import { MinimalCVTemplate } from './templates/minimal-cv/MinimalCVTemplate';
import { SidebarCVTemplate } from './templates/sidebar-cv/SidebarCVTemplate';
import { LuxSleekCVTemplate } from './templates/luxsleek-cv/LuxSleekCVTemplate';
import { HipsterCVTemplate } from './templates/hipster-cv/HipsterCVTemplate';
import { TimelineCVTemplate } from './templates/timeline-cv/TimelineCVTemplate';
import { ModernCVTemplate } from './templates/modern-cv/ModernCVTemplate';
import { ClassicCVTemplate } from './templates/classic-cv/ClassicCVTemplate';
import { StyleSettingsPanel } from './components/StyleSettingsPanel';
import { ContentForm } from './components/ContentForm';
import { TemplateGallery } from './components/TemplateGallery';
import type { TemplateId } from './components/TemplateGallery';
import { ChatPanel } from './components/ChatPanel';
import { StepWizard } from './components/StepWizard';
import { ZoomControls } from './components/ZoomControls';
import { ResumeTemplateGrid } from './components/ResumeTemplateGrid';
import { parseResumeWithBackend } from './lib/smartResumeClient';
import { parseResumeText } from './lib/resumeParser';
import { extractTextFromImage } from './lib/ocr';
import type { ResumeData, StyleSettings } from './types/resume';
import { defaultResumeData, defaultStyleSettings } from './types/resume';
import { getPagePreset } from './lib/pageSize';
import { MainLayout } from '@/app/components/layout/MainLayout';
import { PromptInput } from '@/app/components/PromptInput';
import { useSidebar } from '@/app/context/SidebarContext';
import { SearchDialog } from '@/app/components/SearchDialog';
import { LibraryDialog } from '@/app/components/LibraryDialog';
import { features } from '@/data/featureTemplates';
import { cn } from '@/lib/utils';
import './components/StepWizard.css';

type TabType = 'content' | 'style' | 'template';
type AppMode = 'input' | 'parsing' | 'wizard' | 'editor';
type UploadStatus = 'idle' | 'extracting' | 'parsing' | 'success' | 'error';

const tabs: { id: TabType; icon: string; label: string }[] = [
    { id: 'content', icon: '📝', label: '内容' },
    { id: 'style', icon: '🎨', label: '样式' },
    { id: 'template', icon: '📋', label: '模板' },
];

// Template renderer component
function TemplateRenderer({
    templateId,
    data,
    style,
    onDataChange
}: {
    templateId: TemplateId;
    data: ResumeData;
    style: StyleSettings;
    onDataChange: (data: ResumeData) => void;
}) {
    switch (templateId) {
        case 'forty-seconds-cv':
            return <FortySecondsCVTemplate data={data} style={style} onDataChange={onDataChange} />;
        case 'altacv':
            return <AltaCVTemplate data={data} style={style} onDataChange={onDataChange} />;
        case 'minimal-cv':
            return <MinimalCVTemplate data={data} style={style} onDataChange={onDataChange} />;
        case 'sidebar-cv':
            return <SidebarCVTemplate data={data} style={style} onDataChange={onDataChange} />;
        case 'luxsleek-cv':
            return <LuxSleekCVTemplate data={data} style={style} />;
        case 'hipster-cv':
            return <HipsterCVTemplate data={data} style={style} />;
        case 'timeline-cv':
            return <TimelineCVTemplate data={data} style={style} />;
        case 'modern-cv':
            return <ModernCVTemplate data={data} style={style} />;
        case 'classic-cv':
            return <ClassicCVTemplate data={data} style={style} />;
        default:
            return <FortySecondsCVTemplate data={data} style={style} onDataChange={onDataChange} />;
    }
}

export function ResumePageContent({ onExit }: { onExit?: () => void } = {}) {
    const router = useRouter();
    const { setCollapsed, setHideTopBar } = useSidebar();
    const resumeFeature = features.find((f) => f.id === "resume") ?? null;

    // Core state
    const [mode, setMode] = useState<AppMode>('input');
    const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
    const [styleSettings, setStyleSettings] = useState<StyleSettings>(defaultStyleSettings);
    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [activeTemplate, setActiveTemplate] = useState<TemplateId>('forty-seconds-cv');
    const pagePreset = getPagePreset(styleSettings.pageSize);

    // Input Mode state
    const [userPrompt, setUserPrompt] = useState('');
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>('idle');
    const [uploadError, setUploadError] = useState('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Editor Mode state
    const [formWidth, setFormWidth] = useState(360);
    const [chatWidth, setChatWidth] = useState(420);
    const [resizingPanel, setResizingPanel] = useState<'form' | 'chat' | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);
    const [previewScale, setPreviewScale] = useState(0.55);

    // Hide TopBar in editor/wizard modes
    useEffect(() => {
        const isEditorMode = mode === 'wizard' || mode === 'editor';
        setHideTopBar(isEditorMode);
        return () => setHideTopBar(false);
    }, [mode, setHideTopBar]);

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
            if (resizingPanel === 'form') {
                const newWidth = e.clientX - 64;
                setFormWidth(Math.max(280, Math.min(500, newWidth)));
            } else if (resizingPanel === 'chat') {
                const newWidth = window.innerWidth - e.clientX;
                setChatWidth(Math.max(280, Math.min(500, newWidth)));
            }
        };

        const handleMouseUp = () => {
            setResizingPanel(null);
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
        };

        if (resizingPanel) {
            document.body.style.cursor = 'col-resize';
            document.body.style.userSelect = 'none';
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingPanel]);

    useEffect(() => {
        const styleId = 'resume-page-size-style';
        let styleEl = document.getElementById(styleId) as HTMLStyleElement | null;
        if (!styleEl) {
            styleEl = document.createElement('style');
            styleEl.id = styleId;
            document.head.appendChild(styleEl);
        }
        styleEl.textContent = `@page { size: ${pagePreset.printSize}; margin: 0; }`;
    }, [pagePreset.printSize]);

    // File handling for Input Mode
    const handleFile = async (file: File) => {
        setUploadedFile(file);
        setUploadError('');
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setDragActive(true);
    };

    const handleDragLeave = () => {
        setDragActive(false);
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    // Parse the uploaded file
    const parseFile = async (file: File): Promise<ResumeData> => {
        if (file.type === 'application/pdf') {
            return await parseResumeWithBackend(file);
        }
        if (file.type.startsWith('text/')) {
            const text = await file.text();
            if (!text.trim()) throw new Error('无法从文件中提取文字');
            return await parseResumeText(text);
        }
        if (file.type.startsWith('image/')) {
            const text = await extractTextFromImage(file);
            if (!text.trim()) throw new Error('无法从图片中识别文字');
            return await parseResumeText(text);
        }
        throw new Error('请上传 PDF、TXT 或图片文件');
    };

    // Submit handler - enters editor mode
    const handleSubmit = useCallback(async (value: string) => {
        // Store user prompt for AI context
        setUserPrompt(value);

        // Collapse sidebar
        setCollapsed(true);

        if (uploadedFile) {
            // Parse the uploaded file
            setMode('parsing');
            setUploadStatus('parsing');

            try {
                const parsedData = await parseFile(uploadedFile);
                setResumeData(parsedData);
                setUploadStatus('success');
                setTimeout(() => setMode('wizard'), 500);
            } catch (err) {
                setUploadStatus('error');
                setUploadError(err instanceof Error ? err.message : '解析失败');
                setMode('input');
            }
        } else {
            // No file uploaded, go directly to wizard
            setMode('wizard');
        }
    }, [uploadedFile, setCollapsed]);

    // Skip upload - go directly to wizard
    const handleSkip = useCallback(() => {
        setCollapsed(true);
        setMode('wizard');
    }, [setCollapsed]);

    // Clear feature and exit
    const handleClearFeature = useCallback(() => {
        if (onExit) {
            onExit();
            return;
        }
        router.push('/');
    }, [onExit, router]);

    // Export PDF
    const handleExportPDF = async () => {
        if (!previewRef.current) return;

        const content = previewRef.current.innerHTML;
        const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map((link) => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`)
            .join('\n');
        const styleTags = Array.from(document.querySelectorAll('style'))
            .map((style) => `<style>${style.textContent || ''}</style>`)
            .join('\n');

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

        const filename = `${resumeData.personal.name || 'resume'}.pdf`;
        const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
        const backendUrl = `${apiBase}/api/resume/pdf`;

        try {
            const response = await fetch(backendUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ html: fullHTML, filename }),
            });

            if (response.ok) {
                const blob = await response.blob();
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                return;
            }
        } catch (error) {
            console.warn('Backend PDF failed, using fallback:', error);
        }

        const printWindow = window.open('', '_blank');
        if (!printWindow) return;
        printWindow.document.write(fullHTML);
        printWindow.document.close();
        setTimeout(() => printWindow.print(), 500);
    };

    const isWizardMode = mode === 'wizard';
    const isEditorMode = mode === 'editor';
    const isInputMode = mode === 'input';
    const isParsingMode = mode === 'parsing';

    return (
        <div className="h-full flex flex-col overflow-hidden">
            <AnimatePresence mode="wait">
                {(isInputMode || isParsingMode) ? (
                    // Input Mode - Feature Selected UI
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
                            <div className="w-full max-w-4xl flex flex-col items-center gap-6 pt-[10vh]">
                                {/* Header */}
                                <div className="text-center">
                                    <h1 className="text-2xl font-bold text-foreground mb-2">📄 简历优化助手</h1>
                                    <p className="text-muted-foreground">上传你的简历，AI 将自动提取信息</p>
                                </div>

                                {/* Prompt Input */}
                                <div className="w-full max-w-3xl mx-auto">
                                    <PromptInput
                                        placeholder="描述你的职业背景和目标岗位..."
                                        onSubmit={handleSubmit}
                                        selectedFeature={resumeFeature}
                                        onClearFeature={handleClearFeature}
                                    />
                                </div>

                                {/* Upload Zone */}
                                <div className="w-full max-w-xl">
                                    {isParsingMode ? (
                                        // Parsing Status
                                        <div className="rounded-2xl border-2 border-dashed border-primary/50 bg-primary/5 p-8 text-center">
                                            {uploadStatus === 'parsing' && (
                                                <div className="py-4">
                                                    <div className="w-12 h-12 mx-auto mb-4 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
                                                    <p className="text-lg font-medium text-foreground">AI 正在解析简历...</p>
                                                    <p className="text-sm text-muted-foreground mt-2">这可能需要几秒钟</p>
                                                </div>
                                            )}
                                            {uploadStatus === 'success' && (
                                                <div className="py-4">
                                                    <div className="w-16 h-16 mx-auto mb-4 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                        <span className="text-3xl">✅</span>
                                                    </div>
                                                    <p className="text-lg font-medium text-green-600 dark:text-green-400">解析成功！</p>
                                                </div>
                                            )}
                                            {uploadStatus === 'error' && (
                                                <div className="py-4">
                                                    <div className="w-16 h-16 mx-auto mb-4 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                                                        <span className="text-3xl">❌</span>
                                                    </div>
                                                    <p className="text-lg font-medium text-red-600 dark:text-red-400 mb-2">解析失败</p>
                                                    <p className="text-sm text-red-500 mb-4">{uploadError}</p>
                                                    <button
                                                        onClick={() => {
                                                            setMode('input');
                                                            setUploadStatus('idle');
                                                            setUploadError('');
                                                        }}
                                                        className="px-4 py-2 bg-muted text-foreground rounded-lg text-sm hover:bg-muted/80 transition-colors"
                                                    >
                                                        重试
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        // Upload Zone
                                        <div
                                            onDrop={handleDrop}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onClick={() => fileInputRef.current?.click()}
                                            className={cn(
                                                "relative rounded-2xl border-2 border-dashed p-8 text-center transition-all cursor-pointer",
                                                dragActive
                                                    ? "border-primary bg-primary/5"
                                                    : uploadedFile
                                                        ? "border-green-500 bg-green-50 dark:bg-green-900/10"
                                                        : "border-border hover:border-primary/50 hover:bg-muted/50"
                                            )}
                                        >
                                            <input
                                                ref={fileInputRef}
                                                type="file"
                                                accept=".pdf,.txt,image/*"
                                                onChange={handleFileSelect}
                                                className="hidden"
                                            />

                                            {uploadedFile ? (
                                                <div>
                                                    <div className="w-12 h-12 mx-auto mb-3 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                                                        <span className="text-xl">📄</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground mb-1">{uploadedFile.name}</p>
                                                    <p className="text-xs text-muted-foreground">点击替换文件</p>
                                                </div>
                                            ) : (
                                                <>
                                                    <div className="w-12 h-12 mx-auto mb-3 bg-primary/10 rounded-full flex items-center justify-center">
                                                        <span className="text-xl">📤</span>
                                                    </div>
                                                    <p className="text-sm font-medium text-foreground mb-1">
                                                        拖放简历文件到这里
                                                    </p>
                                                    <p className="text-xs text-muted-foreground mb-3">
                                                        或点击选择文件（支持 PDF、TXT、JPG、PNG）
                                                    </p>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            fileInputRef.current?.click();
                                                        }}
                                                        className="px-4 py-1.5 bg-primary text-primary-foreground rounded-full text-sm font-medium hover:bg-primary/90 transition-colors"
                                                    >
                                                        选择文件
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    )}

                                    {/* Skip Button */}
                                    {isInputMode && (
                                        <div className="text-center mt-4">
                                            <button
                                                onClick={handleSkip}
                                                className="px-6 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-primary/50 transition-colors"
                                            >
                                                跳过，手动填写简历 →
                                            </button>
                                        </div>
                                    )}
                                </div>

                                {/* Features */}
                                {isInputMode && (
                                    <div className="flex gap-8 text-center mt-2">
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xl">🤖</span>
                                            <span className="text-xs text-muted-foreground">AI 智能解析</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xl">⚡</span>
                                            <span className="text-xs text-muted-foreground">秒级提取</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-1">
                                            <span className="text-xl">🎨</span>
                                            <span className="text-xs text-muted-foreground">多种模板</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Template Section */}
                        {isInputMode && (
                            <div className="flex-shrink-0 px-6 py-8">
                                <div className="max-w-5xl mx-auto">
                                    <ResumeTemplateGrid
                                        activeTemplate={activeTemplate}
                                        onSelectTemplate={setActiveTemplate}
                                    />
                                </div>
                            </div>
                        )}
                    </motion.div>
                ) : (
                    // Wizard / Editor Mode
                    <motion.div
                        key="editor-mode"
                        initial={{ opacity: 0, scale: 1.02 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                            delay: 0.1
                        }}
                        className="h-full flex flex-col"
                    >
                        {/* Wizard Mode */}
                        <div style={{ display: isWizardMode ? 'contents' : 'none' }}>
                            <StepWizard
                                data={resumeData}
                                onChange={setResumeData}
                                onComplete={() => setMode('editor')}
                                active={isWizardMode}
                            />
                        </div>

                        {/* Editor Mode */}
                        <div
                            className="h-screen flex flex-col bg-gray-100"
                            style={{ display: isEditorMode ? 'flex' : 'none' }}
                        >
                            {/* Header */}
                            <header className="h-14 bg-white border-b px-6 flex items-center justify-between shrink-0 no-print">
                                <div className="flex items-center gap-4">
                                    <button
                                        onClick={() => setMode('wizard')}
                                        className="text-gray-500 hover:text-gray-700 transition-colors text-sm"
                                    >
                                        ← 返回向导
                                    </button>
                                    <h1 className="text-lg font-semibold text-gray-800">📄 简历编辑器</h1>
                                </div>
                                <button
                                    onClick={handleExportPDF}
                                    className="px-5 py-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-full hover:shadow-lg transition-all text-sm font-semibold"
                                >
                                    导出 PDF
                                </button>
                            </header>

                            {/* Main Content */}
                            <div className="flex-1 flex overflow-hidden">
                                {/* Left Tab Sidebar */}
                                <nav className="w-16 bg-gray-900 flex flex-col shrink-0 no-print">
                                    {tabs.map((tab) => (
                                        <button
                                            key={tab.id}
                                            onClick={() => setActiveTab(tab.id)}
                                            className={`py-4 flex flex-col items-center gap-1 transition-colors ${activeTab === tab.id
                                                ? 'bg-gray-700 text-white'
                                                : 'text-gray-400 hover:text-white hover:bg-gray-800'
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
                                    className="bg-white border-r overflow-y-auto p-4 shrink-0 no-print"
                                >
                                    {activeTab === 'content' && (
                                        <ContentForm data={resumeData} onChange={setResumeData} />
                                    )}
                                    {activeTab === 'style' && (
                                        <StyleSettingsPanel settings={styleSettings} onChange={setStyleSettings} />
                                    )}
                                    {activeTab === 'template' && (
                                        <TemplateGallery
                                            activeTemplate={activeTemplate}
                                            onSelectTemplate={setActiveTemplate}
                                        />
                                    )}
                                </aside>

                                {/* Form Resize Handle */}
                                <div
                                    onMouseDown={() => setResizingPanel('form')}
                                    className={`w-1.5 bg-gray-200 hover:bg-indigo-500 cursor-col-resize transition-colors no-print shrink-0 ${resizingPanel === 'form' ? 'bg-indigo-500' : ''
                                        }`}
                                />

                                {/* Preview Panel */}
                                <main
                                    ref={previewContainerRef}
                                    className="flex-1 overflow-auto bg-gray-200 p-6 flex justify-center relative"
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
                                                    '--page-width': pagePreset.width,
                                                    '--page-height': pagePreset.height,
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
                                    onMouseDown={() => setResizingPanel('chat')}
                                    className={`w-1.5 bg-gray-200 hover:bg-indigo-500 cursor-col-resize transition-colors no-print shrink-0 ${resizingPanel === 'chat' ? 'bg-indigo-500' : ''
                                        }`}
                                />

                                {/* Chat Panel */}
                                <aside
                                    style={{ width: chatWidth }}
                                    className="bg-white border-l overflow-hidden shrink-0 no-print"
                                >
                                    <ChatPanel resumeData={resumeData} onDataChange={setResumeData} />
                                </aside>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

// Default export with MainLayout wrapper
export default function ResumePage() {
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
                    mode: "resume",
                }}
            >
                <Suspense fallback={
                    <div className="flex h-screen items-center justify-center">
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                }>
                    <ResumePageContent />
                </Suspense>
            </MainLayout>
        </>
    );
}
