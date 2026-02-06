'use client';

import React, { useState, useCallback } from 'react';
import { useSidebar } from '@/app/context/SidebarContext';
import type { Slide, Attachment, SlidesViewState, PresentationData } from '@/app/slides/types/slides';
import OutlineEditor from '@/app/components/slides/OutlineEditor';
import SlideShow from '@/app/components/slides/SlideShow';
import SlidesChatPanel from '@/app/components/slides/SlidesChatPanel';
import { MessageSquare, X } from 'lucide-react';

interface SlidesExperienceProps {
    topic?: string;
    attachments?: Attachment[];
    presentationId?: string;
    userId?: string;
    onExit: () => void;
    onPresentationCreated?: (presentation: PresentationData) => void;
    // New props for file-based input
    initialFile?: File | null;
    initialPrompt?: string;
}

const SlidesExperience: React.FC<SlidesExperienceProps> = ({
    topic: propTopic,
    attachments: propAttachments = [],
    presentationId: initialPresentationId,
    userId,
    onExit,
    onPresentationCreated,
    initialFile,
    initialPrompt
}) => {
    const { setCollapsed, setHideTopBar } = useSidebar();

    // Convert initialFile to attachment if provided
    const [topic, setTopic] = React.useState(propTopic || initialPrompt || '');
    const [attachments, setAttachments] = React.useState<Attachment[]>(propAttachments);
    const [isProcessingFile, setIsProcessingFile] = React.useState(false);

    // Convert initial file to base64 attachment on mount
    React.useEffect(() => {
        if (initialFile && attachments.length === 0) {
            setIsProcessingFile(true);
            const reader = new FileReader();
            reader.onload = () => {
                const base64 = (reader.result as string).split(',')[1] || '';
                setAttachments([{
                    name: initialFile.name,
                    mimeType: initialFile.type || 'application/octet-stream',
                    data: base64
                }]);
                setIsProcessingFile(false);
            };
            reader.onerror = () => {
                console.error('Failed to read file');
                setIsProcessingFile(false);
            };
            reader.readAsDataURL(initialFile);
        }
    }, [initialFile]);

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
                        showAIPanel={showAIPanel}
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
                <div className="fixed right-0 top-0 bottom-0 w-80 border-l border-zinc-800 flex flex-col z-50">
                    {/* Close Button */}
                    <button
                        onClick={() => setShowAIPanel(false)}
                        className="absolute top-4 right-4 z-10 p-1.5 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-white transition"
                    >
                        <X size={18} />
                    </button>

                    {/* Chat Panel */}
                    <SlidesChatPanel
                        slides={slides}
                        onSlidesChange={handleSlidesUpdate}
                        topic={topic}
                        streamingContent={aiMessages[aiMessages.length - 1]}
                        isGenerating={viewState === 'GENERATING'}
                    />
                </div>
            )}
        </div>
    );
};

export default SlidesExperience;
