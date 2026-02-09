'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ArrowLeft, Download, Loader2, Undo, Redo } from 'lucide-react';
import dynamic from 'next/dynamic';
import pptxgen from 'pptxgenjs';
import type { Slide, CanvasObject } from '@/app/slides/types/slides';
import { generateSlideImage, generateSingleSlide } from '@/app/slides/lib/slidesService';
import {
    savePresentation,
    updateSlideImage,
    updateSlideContent
} from '@/app/slides/lib/slidesPersistence';

import SlideThumbnails from './SlideThumbnails';
const SlideViewer = dynamic(() => import('./SlideViewer'), {
    ssr: false,
    loading: () => (
        <div className="flex-1 bg-zinc-900/50 flex items-center justify-center">
            <Loader2 className="animate-spin text-purple-500" size={32} />
        </div>
    )
});
import RegenerateModal from './RegenerateModal';
import NewSlideModal from './NewSlideModal';
import ConfirmationModal from './ConfirmationModal';

interface SlideShowProps {
    slides: Slide[];
    onBack: () => void;
    topic: string;
    presentationId: string;
    userId?: string;
    onSlidesUpdate?: (slides: Slide[]) => void;
}

const SlideShow: React.FC<SlideShowProps> = ({
    slides: initialSlides,
    onBack,
    topic,
    presentationId,
    userId,
    onSlidesUpdate
}) => {
    const [slides, setSlides] = useState<Slide[]>(initialSlides);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [generatingCount, setGeneratingCount] = useState(0);
    const [isExporting, setIsExporting] = useState(false);

    const [history, setHistory] = useState<Slide[][]>([initialSlides]);
    const [historyIndex, setHistoryIndex] = useState(0);

    const imageCache = useRef<Record<string, string>>({});

    const [showPromptModal, setShowPromptModal] = useState(false);
    const [slideToDelete, setSlideToDelete] = useState<number | null>(null);
    const [showNewSlideModal, setShowNewSlideModal] = useState(false);
    const [newSlideIndex, setNewSlideIndex] = useState<number>(-1);
    const [isCreatingSlide, setIsCreatingSlide] = useState(false);

    const generatedRef = useRef<Set<string>>(new Set());
    const abortedRef = useRef<Set<string>>(new Set());

    // Sync slides to parent
    useEffect(() => {
        onSlidesUpdate?.(slides);
    }, [slides, onSlidesUpdate]);

    // Update image cache
    useEffect(() => {
        slides.forEach(s => {
            if (s.imageBase64) {
                imageCache.current[s.id] = s.imageBase64;
            }
        });
    }, [slides]);

    const addToHistory = (newSlides: Slide[]) => {
        const cleanSlides = newSlides.map(s => ({
            ...s,
            isGeneratingImage: false,
            generationFailed: false
        }));

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(cleanSlides);
        if (newHistory.length > 50) newHistory.shift();

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
    };

    const mergeImagesFromCache = (slidesToRestore: Slide[]): Slide[] => {
        return slidesToRestore.map(s => {
            if (!s.imageBase64 && imageCache.current[s.id]) {
                return { ...s, imageBase64: imageCache.current[s.id] };
            }
            return s;
        });
    };

    const handleUndo = async () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const slidesWithImages = mergeImagesFromCache(history[newIndex]);
            setSlides(slidesWithImages);
            setHistoryIndex(newIndex);

            await savePresentation({
                id: presentationId,
                user_id: userId,
                topic,
                title: topic,
                slides: slidesWithImages
            });

            if (currentIndex >= slidesWithImages.length) {
                setCurrentIndex(Math.max(0, slidesWithImages.length - 1));
            }
        }
    };

    const handleRedo = async () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const slidesWithImages = mergeImagesFromCache(history[newIndex]);
            setSlides(slidesWithImages);
            setHistoryIndex(newIndex);

            await savePresentation({
                id: presentationId,
                user_id: userId,
                topic,
                title: topic,
                slides: slidesWithImages
            });

            if (currentIndex >= slidesWithImages.length) {
                setCurrentIndex(Math.max(0, slidesWithImages.length - 1));
            }
        }
    };

    // Image generation
    const triggerGeneration = useCallback(async (slideIndex: number, force = false) => {
        if (slideIndex < 0 || slideIndex >= slides.length) return;

        const slide = slides[slideIndex];

        if (!force) {
            if (slide.imageBase64 || slide.isGeneratingImage || generatedRef.current.has(slide.id)) return;
        }

        if (abortedRef.current.has(slide.id)) {
            abortedRef.current.delete(slide.id);
        }

        generatedRef.current.add(slide.id);

        setSlides(prev => {
            const newSlides = [...prev];
            if (newSlides[slideIndex]) {
                newSlides[slideIndex] = { ...newSlides[slideIndex], isGeneratingImage: true, generationFailed: false };
            }
            return newSlides;
        });
        setGeneratingCount(c => c + 1);

        try {
            const base64 = await generateSlideImage(slide);

            if (!base64) {
                throw new Error("Image generation returned empty result");
            }

            imageCache.current[slide.id] = base64;

            if (abortedRef.current.has(slide.id)) {
                setSlides(prev => {
                    const newSlides = [...prev];
                    if (newSlides[slideIndex]) {
                        newSlides[slideIndex] = { ...newSlides[slideIndex], isGeneratingImage: false };
                    }
                    return newSlides;
                });
                return;
            }

            updateSlideImage(presentationId, slide.id, base64).catch(err =>
                console.error("Failed to save image to DB", err)
            );

            setSlides(prev => {
                if (abortedRef.current.has(slide.id)) return prev;

                const newSlides = [...prev];
                if (newSlides[slideIndex]) {
                    newSlides[slideIndex] = {
                        ...newSlides[slideIndex],
                        imageBase64: base64,
                        isGeneratingImage: false,
                        generationFailed: false
                    };
                }
                return newSlides;
            });
        } catch (e) {
            if (abortedRef.current.has(slide.id)) return;
            console.error(`Failed to generate slide ${slideIndex}`, e);
            setSlides(prev => {
                const newSlides = [...prev];
                if (newSlides[slideIndex]) {
                    newSlides[slideIndex] = {
                        ...newSlides[slideIndex],
                        isGeneratingImage: false,
                        generationFailed: true
                    };
                }
                return newSlides;
            });
        } finally {
            setGeneratingCount(c => c - 1);
        }
    }, [slides, presentationId]);

    // Queue strategy
    useEffect(() => {
        triggerGeneration(currentIndex);

        if (currentIndex + 1 < slides.length) {
            triggerGeneration(currentIndex + 1);
        }
        if (currentIndex - 1 >= 0) {
            triggerGeneration(currentIndex - 1);
        }
    }, [currentIndex, slides.length, triggerGeneration]);

    // Background generator
    useEffect(() => {
        const timer = setTimeout(() => {
            slides.forEach((_, idx) => {
                if (Math.abs(idx - currentIndex) > 1) {
                    triggerGeneration(idx);
                }
            });
        }, 2000);
        return () => clearTimeout(timer);
    }, [currentIndex, slides, triggerGeneration]);

    const handleDownloadPPTX = async () => {
        setIsExporting(true);
        try {
            const pres = new pptxgen();
            pres.layout = 'LAYOUT_16x9';
            pres.title = topic;

            const CANVAS_W = 1280;
            const CANVAS_H = 720;
            const PPTX_W = 10;
            const PPTX_H = 5.625;
            const FONT_SCALE = 0.5625;
            const LINE_SPACING_FACTOR = 1.4;

            slides.forEach((slide) => {
                const pptxSlide = pres.addSlide();
                pptxSlide.background = { color: '000000' };

                if (slide.imageBase64) {
                    pptxSlide.addImage({
                        data: `data:image/png;base64,${slide.imageBase64}`,
                        x: 0, y: 0, w: '100%', h: '100%'
                    });
                    pptxSlide.addShape(pres.ShapeType.rect, {
                        x: 0, y: 0, w: '100%', h: '100%',
                        fill: { color: '000000', transparency: 40 }
                    });
                }

                if (slide.customCanvasJson) {
                    try {
                        const objects: CanvasObject[] = JSON.parse(slide.customCanvasJson);
                        objects.forEach(obj => {
                            const xPct = (obj.x / CANVAS_W) * 100;
                            const yPct = (obj.y / CANVAS_H) * 100;
                            const wPct = (obj.width || 0) / CANVAS_W * 100;

                            if (obj.type === 'text' && obj.text) {
                                const hexColor = obj.fill.replace('#', '');
                                const fontSize = (obj.fontSize || 18) * FONT_SCALE;

                                pptxSlide.addText(obj.text, {
                                    x: `${xPct}%`,
                                    y: `${yPct}%`,
                                    w: `${wPct}%`,
                                    fontSize: fontSize,
                                    color: hexColor,
                                    bold: obj.fontStyle?.includes('bold'),
                                    italic: obj.fontStyle?.includes('italic'),
                                    underline: obj.textDecoration?.includes('underline') ? { style: 'sng' } : undefined,
                                    align: (obj.align || 'left') as 'left' | 'center' | 'right',
                                    fontFace: 'Arial',
                                    lineSpacing: fontSize * LINE_SPACING_FACTOR
                                });
                            } else if (obj.type === 'rect') {
                                const hexColor = obj.fill.replace('#', '');
                                const wInch = (obj.width || 0) / CANVAS_W * PPTX_W;
                                const hInch = (obj.height || 0) / CANVAS_H * PPTX_H;
                                const xInch = (obj.x / CANVAS_W) * PPTX_W;
                                const yInch = (obj.y / CANVAS_H) * PPTX_H;

                                pptxSlide.addShape(pres.ShapeType.rect, {
                                    x: xInch, y: yInch, w: wInch, h: hInch,
                                    fill: { color: hexColor }
                                });
                            }
                        });
                    } catch (e) {
                        console.error("Failed to parse canvas json for export", e);
                    }
                } else {
                    const titleFontSize = 48 * FONT_SCALE;
                    pptxSlide.addText(slide.title, {
                        x: 0.5, y: '35%', w: '90%',
                        fontSize: titleFontSize, color: 'FFFFFF', bold: true, fontFace: 'Arial', align: 'center',
                        lineSpacing: titleFontSize * LINE_SPACING_FACTOR
                    });

                    const contentFontSize = 24 * FONT_SCALE;
                    pptxSlide.addText(slide.content, {
                        x: '10%', y: '52%', w: '80%',
                        fontSize: contentFontSize, color: 'FFFFFF', fontFace: 'Arial', align: 'center',
                        lineSpacing: contentFontSize * LINE_SPACING_FACTOR
                    });
                }
            });

            const safeFileName = topic.replace(/[^a-z0-9]/gi, '_').substring(0, 30);
            await pres.writeFile({ fileName: `${safeFileName}.pptx` });

        } catch (error) {
            console.error("Failed to generate PPTX", error);
            alert("导出 PowerPoint 失败，请查看控制台获取详情。");
        } finally {
            setIsExporting(false);
        }
    };

    const handleTextChange = (field: 'title' | 'content', value: string) => {
        setSlides(prev => {
            const newSlides = [...prev];
            newSlides[currentIndex] = { ...newSlides[currentIndex], [field]: value };
            return newSlides;
        });
    };

    const handleCanvasChange = (json: string) => {
        setSlides(prev => {
            const newSlides = [...prev];
            newSlides[currentIndex] = { ...newSlides[currentIndex], customCanvasJson: json };
            return newSlides;
        });
    };

    const handleTextBlur = () => {
        const slide = slides[currentIndex];
        const currentInHistory = history[historyIndex][currentIndex];
        const hasChanged = currentInHistory && (
            slide.title !== currentInHistory.title ||
            slide.content !== currentInHistory.content ||
            slide.customCanvasJson !== currentInHistory.customCanvasJson
        );

        if (hasChanged) {
            addToHistory(slides);
            updateSlideContent(presentationId, slide.id, {
                title: slide.title,
                content: slide.content,
                customCanvasJson: slide.customCanvasJson
            }).catch(err => console.error("Failed to save text changes", err));
        }
    };

    const handleReorder = async (fromIndex: number, toIndex: number) => {
        if (fromIndex === toIndex) return;

        const updatedSlides = [...slides];
        const [movedSlide] = updatedSlides.splice(fromIndex, 1);
        updatedSlides.splice(toIndex, 0, movedSlide);

        setSlides(updatedSlides);
        addToHistory(updatedSlides);

        let newIndex = currentIndex;
        if (currentIndex === fromIndex) {
            newIndex = toIndex;
        } else if (currentIndex > fromIndex && currentIndex <= toIndex) {
            newIndex = currentIndex - 1;
        } else if (currentIndex < fromIndex && currentIndex >= toIndex) {
            newIndex = currentIndex + 1;
        }
        setCurrentIndex(newIndex);

        await savePresentation({
            id: presentationId,
            user_id: userId,
            topic,
            title: topic,
            slides: updatedSlides
        });
    };

    const requestDeleteSlide = (index: number) => {
        if (slides.length <= 1) {
            alert("无法删除最后一张幻灯片。");
            return;
        }
        setSlideToDelete(index);
    };

    const confirmDeleteSlide = async () => {
        if (slideToDelete === null) return;

        const index = slideToDelete;
        const updatedSlides = [...slides];
        updatedSlides.splice(index, 1);

        setSlides(updatedSlides);
        addToHistory(updatedSlides);

        if (currentIndex >= updatedSlides.length) {
            setCurrentIndex(Math.max(0, updatedSlides.length - 1));
        } else if (index < currentIndex) {
            setCurrentIndex(currentIndex - 1);
        }

        await savePresentation({
            id: presentationId,
            user_id: userId,
            topic,
            title: topic,
            slides: updatedSlides
        });

        setSlideToDelete(null);
    };

    const handleStopGenerating = () => {
        const slide = slides[currentIndex];
        abortedRef.current.add(slide.id);

        setSlides(prev => {
            const newSlides = [...prev];
            newSlides[currentIndex] = { ...newSlides[currentIndex], isGeneratingImage: false };
            return newSlides;
        });
    };

    const handleRetry = () => {
        triggerGeneration(currentIndex, true);
    };

    const handleIgnore = () => {
        setSlides(prev => {
            const newSlides = [...prev];
            newSlides[currentIndex] = { ...newSlides[currentIndex], generationFailed: false };
            return newSlides;
        });
    };

    const handleOpenRegenerateModal = () => {
        setShowPromptModal(true);
    };

    const handleConfirmRegenerate = async (newPrompt: string) => {
        setSlides(prev => {
            const newSlides = [...prev];
            newSlides[currentIndex] = {
                ...newSlides[currentIndex],
                visualDescription: newPrompt,
                imageBase64: undefined
            };
            return newSlides;
        });

        setShowPromptModal(false);

        setTimeout(() => {
            triggerGeneration(currentIndex, true);
        }, 0);
    };

    const handleOpenAddSlideModal = (index: number) => {
        setNewSlideIndex(index);
        setShowNewSlideModal(true);
    };

    const handleConfirmAddSlide = async (description: string) => {
        setIsCreatingSlide(true);
        try {
            const newSlideData = await generateSingleSlide(topic, description, slides, newSlideIndex);

            const newSlide: Slide = {
                id: crypto.randomUUID(),
                ...newSlideData,
                isGeneratingImage: false
            };

            const updatedSlides = [...slides];
            updatedSlides.splice(newSlideIndex, 0, newSlide);

            setSlides(updatedSlides);
            addToHistory(updatedSlides);

            await savePresentation({
                id: presentationId,
                user_id: userId,
                topic,
                title: topic,
                slides: updatedSlides
            });

            setCurrentIndex(newSlideIndex);
            setShowNewSlideModal(false);
            setIsCreatingSlide(false);

            setTimeout(() => {
                triggerGeneration(newSlideIndex, true);
            }, 100);

        } catch (error) {
            console.error("Failed to create new slide", error);
            alert("创建幻灯片失败，请重试。");
            setIsCreatingSlide(false);
        }
    };

    const currentSlide = slides[currentIndex];

    return (
        <div className="h-full flex flex-col bg-black text-white relative">
            {/* Navbar */}
            <div className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-900/50 relative z-20 flex-shrink-0">
                <div className="flex items-center gap-4">
                    <button onClick={onBack} className="p-2 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white" title="返回">
                        <ArrowLeft size={20} />
                    </button>

                    <div className="h-6 w-px bg-zinc-800 mx-2" />

                    <button
                        onClick={handleUndo}
                        disabled={historyIndex === 0}
                        className="p-2 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        title="撤销"
                    >
                        <Undo size={18} />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex === history.length - 1}
                        className="p-2 hover:bg-zinc-800 rounded-full transition text-zinc-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
                        title="重做"
                    >
                        <Redo size={18} />
                    </button>
                </div>

                <div className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center">
                    <h1 className="font-semibold text-sm max-w-md truncate text-zinc-200">{topic}</h1>
                    <span className="font-mono text-[10px] text-zinc-500">
                        幻灯片 {currentIndex + 1} / {slides.length}
                    </span>
                </div>

                <div className="flex items-center gap-4">
                    {generatingCount > 0 && (
                        <span className="text-xs text-zinc-500 animate-pulse flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            处理中 {generatingCount}...
                        </span>
                    )}
                    <button
                        onClick={handleDownloadPPTX}
                        disabled={isExporting}
                        className="flex items-center gap-2 bg-white text-black px-4 py-2 rounded-lg text-sm font-bold hover:bg-zinc-200 disabled:opacity-50 transition"
                    >
                        {isExporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                        <span className="hidden sm:inline">导出 PPTX</span>
                    </button>
                </div>
            </div>

            <div className="flex-1 flex overflow-hidden relative z-10">
                <SlideThumbnails
                    slides={slides}
                    currentIndex={currentIndex}
                    onSlideSelect={setCurrentIndex}
                    onAddSlide={handleOpenAddSlideModal}
                    onReorder={handleReorder}
                    onDelete={requestDeleteSlide}
                />

                {currentSlide && (
                    <SlideViewer
                        key={currentSlide.id}
                        slide={currentSlide}
                        isFirst={currentIndex === 0}
                        isLast={currentIndex === slides.length - 1}
                        onPrev={() => setCurrentIndex(c => Math.max(0, c - 1))}
                        onNext={() => setCurrentIndex(c => Math.min(slides.length - 1, c + 1))}
                        onDelete={() => requestDeleteSlide(currentIndex)}
                        onStopGeneration={handleStopGenerating}
                        onRetry={handleRetry}
                        onIgnore={handleIgnore}
                        onOpenRegenerateModal={handleOpenRegenerateModal}
                        onTextChange={handleTextChange}
                        onCanvasChange={handleCanvasChange}
                        onTextBlur={handleTextBlur}
                    />
                )}
            </div>

            <RegenerateModal
                isOpen={showPromptModal}
                initialPrompt={currentSlide?.visualDescription || ""}
                onClose={() => setShowPromptModal(false)}
                onConfirm={handleConfirmRegenerate}
            />

            <NewSlideModal
                isOpen={showNewSlideModal}
                onClose={() => setShowNewSlideModal(false)}
                onConfirm={handleConfirmAddSlide}
                isGenerating={isCreatingSlide}
            />

            <ConfirmationModal
                isOpen={slideToDelete !== null}
                title="删除幻灯片"
                message="确定要删除这张幻灯片吗？此操作无法撤销。"
                confirmText="删除"
                isDangerous={true}
                onClose={() => setSlideToDelete(null)}
                onConfirm={confirmDeleteSlide}
            />
        </div>
    );
};

export default SlideShow;
