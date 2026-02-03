'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { CSSProperties } from 'react';
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
import { ResumeUpload } from './components/ResumeUpload';
import { ZoomControls } from './components/ZoomControls';
import type { ResumeData, StyleSettings } from './types/resume';
import { defaultResumeData, defaultStyleSettings } from './types/resume';
import { getPagePreset } from './lib/pageSize';
import './components/StepWizard.css';

type TabType = 'content' | 'style' | 'template';
type AppMode = 'upload' | 'wizard' | 'editor';

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

export default function ResumePage() {
    const [mode, setMode] = useState<AppMode>('upload');
    const [resumeData, setResumeData] = useState<ResumeData>(defaultResumeData);
    const [styleSettings, setStyleSettings] = useState<StyleSettings>(defaultStyleSettings);
    const [activeTab, setActiveTab] = useState<TabType>('content');
    const [activeTemplate, setActiveTemplate] = useState<TemplateId>('forty-seconds-cv');
    const pagePreset = getPagePreset(styleSettings.pageSize);

    // Resizable panel widths
    const [formWidth, setFormWidth] = useState(360);
    const [chatWidth, setChatWidth] = useState(420);

    // Resize state
    const [resizingPanel, setResizingPanel] = useState<'form' | 'chat' | null>(null);
    const previewRef = useRef<HTMLDivElement>(null);
    const previewContainerRef = useRef<HTMLDivElement>(null);

    // Preview zoom state
    const [previewScale, setPreviewScale] = useState(0.55);

    // Calculate auto-fit scale
    const calculateAutoFitScale = useCallback(() => {
        if (!previewContainerRef.current) return 0.55;
        const container = previewContainerRef.current;
        const padding = 48; // 24px padding on each side
        const containerWidth = container.clientWidth - padding;
        const containerHeight = container.clientHeight - padding;

        // A4 size in pixels (at 96 DPI: 210mm ≈ 794px, 297mm ≈ 1123px)
        const pageWidth = 794;
        const pageHeight = 1123;

        const scaleX = containerWidth / pageWidth;
        const scaleY = containerHeight / pageHeight;

        return Math.min(scaleX, scaleY, 1); // Cap at 100%
    }, []);

    const handleAutoFit = useCallback(() => {
        setPreviewScale(calculateAutoFitScale());
    }, [calculateAutoFitScale]);

    // Handle mouse events for resizing
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

    const handleExportPDF = () => {
        const printWindow = window.open('', '_blank');
        if (!printWindow || !previewRef.current) return;

        const content = previewRef.current.innerHTML;
        const linkTags = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
            .map((link) => `<link rel="stylesheet" href="${(link as HTMLLinkElement).href}">`)
            .join('\n');
        const styleTags = Array.from(document.querySelectorAll('style'))
            .map((style) => `<style>${style.textContent || ''}</style>`)
            .join('\n');

        printWindow.document.write(`
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
    `);
        printWindow.document.close();

        setTimeout(() => {
            printWindow.print();
        }, 500);
    };

    // Upload Mode - First step for new users
    if (mode === 'upload') {
        return (
            <ResumeUpload
                onParsed={(data) => {
                    setResumeData(data);
                    setMode('wizard');
                }}
                onSkip={() => setMode('wizard')}
            />
        );
    }

    // Wizard and Editor modes - both rendered, visibility controlled by CSS
    // This preserves StepWizard state when switching between modes
    const isWizardMode = mode === 'wizard';
    const isEditorMode = mode === 'editor';

    return (
        <>
            {/* Wizard Mode - hidden when in editor */}
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
        </>
    );
}
