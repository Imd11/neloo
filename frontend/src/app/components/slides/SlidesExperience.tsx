'use client';

import React, { useState, useCallback } from 'react';
import { useSidebar } from '@/app/context/SidebarContext';
import type { Slide, Attachment, SlidesViewState, PresentationData } from '@/app/slides/types/slides';
import OutlineEditor from '@/app/components/slides/OutlineEditor';
import SlideShow from '@/app/components/slides/SlideShow';
import { MessageSquare, Sparkles, X } from 'lucide-react';

interface SlidesExperienceProps {
    topic: string;
    attachments?: Attachment[];
    presentationId?: string;
    userId?: string;
    onExit: () => void;
    onPresentationCreated?: (presentation: PresentationData) => void;
}

const SlidesExperience: React.FC<SlidesExperienceProps> = ({
    topic,
    attachments = [],
    presentationId: initialPresentationId,
    userId,
    onExit,
    onPresentationCreated
}) => {
    const { setCollapsed, setHideTopBar } = useSidebar();

    // View state
    const [viewState, setViewState] = useState<SlidesViewState>('GENERATING');
    const [slides, setSlides] = useState<Slide[]>([]);
    const [presentationId, setPresentationId] = useState<string>(
        initialPresentationId || crypto.randomUUID()
    );

    // AI chat panel state
    const [showAIPanel, setShowAIPanel] = useState(true);
    const [aiMessages, setAIMessages] = useState<string[]>([]);

    // Collapse sidebar when entering slides experience
    React.useEffect(() => {
        setCollapsed(true);
        setHideTopBar(true);

        return () => {
            setHideTopBar(false);
        };
    }, [setCollapsed, setHideTopBar]);

    const handleStreamUpdate = useCallback((text: string) => {
        // Update AI panel with streaming content
        setAIMessages(prev => {
            const newMessages = [...prev];
            if (newMessages.length === 0 || !newMessages[newMessages.length - 1].startsWith('生成大纲中...')) {
                newMessages.push(`生成大纲中...\n${text.substring(0, 200)}...`);
            } else {
                newMessages[newMessages.length - 1] = `生成大纲中...\n${text.substring(0, 200)}...`;
            }
            return newMessages;
        });
    }, []);

    const handleGenerateSlides = useCallback((generatedSlides: Slide[]) => {
        setSlides(generatedSlides);
        setViewState('SLIDESHOW');
        setAIMessages(prev => [...prev, `✓ 大纲生成完成，共 ${generatedSlides.length} 张幻灯片`]);

        // Create presentation data
        const presentation: PresentationData = {
            id: presentationId,
            user_id: userId,
            topic,
            title: topic,
            slides: generatedSlides,
            attachments
        };

        onPresentationCreated?.(presentation);
    }, [presentationId, userId, topic, attachments, onPresentationCreated]);

    const handleSlidesUpdate = useCallback((updatedSlides: Slide[]) => {
        setSlides(updatedSlides);
    }, []);

    const handleBack = useCallback(() => {
        if (viewState === 'SLIDESHOW') {
            setViewState('OUTLINE');
        } else {
            onExit();
        }
    }, [viewState, onExit]);

    return (
        <div className="fixed inset-0 z-50 flex bg-black">
            {/* Main Content Area */}
            <div className={`flex-1 flex flex-col ${showAIPanel ? 'mr-80' : ''} transition-all duration-300`}>
                {viewState === 'GENERATING' || viewState === 'OUTLINE' ? (
                    <OutlineEditor
                        topic={topic}
                        initialAttachments={attachments}
                        onBack={onExit}
                        onGenerateSlides={handleGenerateSlides}
                        onStreamUpdate={handleStreamUpdate}
                    />
                ) : (
                    <SlideShow
                        slides={slides}
                        onBack={handleBack}
                        topic={topic}
                        presentationId={presentationId}
                        userId={userId}
                        onSlidesUpdate={handleSlidesUpdate}
                    />
                )}
            </div>

            {/* AI Chat Panel Toggle */}
            {!showAIPanel && (
                <button
                    onClick={() => setShowAIPanel(true)}
                    className="fixed right-4 top-4 z-60 p-3 bg-purple-600 hover:bg-purple-500 rounded-full shadow-lg transition"
                >
                    <MessageSquare size={20} className="text-white" />
                </button>
            )}

            {/* AI Chat Panel */}
            {showAIPanel && (
                <div className="fixed right-0 top-0 bottom-0 w-80 bg-zinc-900 border-l border-zinc-800 flex flex-col z-50">
                    {/* Panel Header */}
                    <div className="h-16 px-4 flex items-center justify-between border-b border-zinc-800">
                        <div className="flex items-center gap-2">
                            <Sparkles size={18} className="text-purple-400" />
                            <span className="font-semibold text-white">AI 助手</span>
                        </div>
                        <button
                            onClick={() => setShowAIPanel(false)}
                            className="p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
                        >
                            <X size={18} />
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4">
                        {/* Welcome Message */}
                        <div className="bg-zinc-800/50 rounded-lg p-4">
                            <div className="flex items-start gap-3">
                                <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center flex-shrink-0">
                                    <Sparkles size={14} className="text-white" />
                                </div>
                                <div className="text-sm text-zinc-300">
                                    <p className="mb-2">你好！我正在为你生成 <strong className="text-white">"{topic}"</strong> 的演示文稿。</p>
                                    <p className="text-zinc-400 text-xs">请等待大纲生成完成后，你可以编辑内容并生成图片。</p>
                                </div>
                            </div>
                        </div>

                        {/* Dynamic Messages */}
                        {aiMessages.map((msg, idx) => (
                            <div key={idx} className="bg-zinc-800/30 rounded-lg p-3">
                                <p className="text-sm text-zinc-300 whitespace-pre-wrap">{msg}</p>
                            </div>
                        ))}

                        {/* Status Indicators */}
                        {viewState === 'SLIDESHOW' && slides.length > 0 && (
                            <div className="bg-green-900/20 border border-green-800/50 rounded-lg p-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <div className="w-2 h-2 rounded-full bg-green-500" />
                                    <span className="text-sm font-medium text-green-300">演示文稿就绪</span>
                                </div>
                                <p className="text-xs text-zinc-400">
                                    共 {slides.length} 张幻灯片。你可以：
                                </p>
                                <ul className="text-xs text-zinc-500 mt-2 space-y-1">
                                    <li>• 点击左侧缩略图切换幻灯片</li>
                                    <li>• 双击文本进行编辑</li>
                                    <li>• 使用工具栏添加文本和调整格式</li>
                                    <li>• 点击导出按钮下载 PPTX</li>
                                </ul>
                            </div>
                        )}
                    </div>

                    {/* Bottom Info */}
                    <div className="p-4 border-t border-zinc-800">
                        <div className="text-xs text-zinc-500 text-center">
                            由 Gemini AI 驱动
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SlidesExperience;
