import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    ChevronLeft, ChevronRight, Square, RefreshCw, Trash2, MousePointer2,
    Loader2, AlertCircle, Undo, Redo, Type, Bold, Italic, Underline,
    Palette, Plus, Minus, AlignLeft, AlignCenter, AlignRight
} from 'lucide-react';
import { Stage, Layer, Rect, Text, Image as KonvaImage, Transformer } from 'react-konva';
import useImage from 'use-image';
import type { Slide, CanvasObject } from '@/app/slides/types/slides';
import { CANVAS_WIDTH, CANVAS_HEIGHT, LINE_HEIGHT } from '@/app/slides/types/slides';

interface SlideViewerProps {
    slide: Slide;
    isFirst: boolean;
    isLast: boolean;
    onPrev: () => void;
    onNext: () => void;
    onDelete: () => void;
    onStopGeneration: () => void;
    onRetry: () => void;
    onIgnore: () => void;
    onOpenRegenerateModal: () => void;
    onTextChange: (field: 'title' | 'content', value: string) => void;
    onCanvasChange: (json: string) => void;
    onTextBlur: () => void;
}

// Background image component using useImage hook for clean loading
const BackgroundImageLayer = React.memo(({ base64 }: { base64?: string }) => {
    const [image] = useImage(base64 ? `data:image/png;base64,${base64}` : '', 'anonymous');

    if (!image) {
        return <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="#000000" name="background" />;
    }

    const scale = Math.max(CANVAS_WIDTH / image.width, CANVAS_HEIGHT / image.height);

    return (
        <>
            <KonvaImage
                image={image}
                x={0}
                y={0}
                width={image.width * scale}
                height={image.height * scale}
                opacity={0.8}
                name="background"
            />
            <Rect x={0} y={0} width={CANVAS_WIDTH} height={CANVAS_HEIGHT} fill="black" opacity={0.4} name="background" />
        </>
    );
});

BackgroundImageLayer.displayName = 'BackgroundImageLayer';

const SlideViewer: React.FC<SlideViewerProps> = ({
    slide,
    isFirst,
    isLast,
    onPrev,
    onNext,
    onDelete,
    onStopGeneration,
    onRetry,
    onIgnore,
    onOpenRegenerateModal,
    onTextChange,
    onCanvasChange,
    onTextBlur
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const stageRef = useRef<any>(null);
    const transformerRef = useRef<any>(null);

    const [scale, setScale] = useState(1);
    const [objects, setObjects] = useState<CanvasObject[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editText, setEditText] = useState('');
    const [editAreaStyle, setEditAreaStyle] = useState<React.CSSProperties | null>(null);
    const [history, setHistory] = useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = useState(-1);

    // Initialize slide data
    useEffect(() => {
        setSelectedId(null);
        setEditingId(null);

        if (slide.customCanvasJson) {
            try {
                const savedObjects = JSON.parse(slide.customCanvasJson);
                setObjects(savedObjects);
                setHistory([slide.customCanvasJson]);
                setHistoryIndex(0);
            } catch (e) {
                console.error("Failed to parse canvas JSON", e);
            }
        } else {
            const defaultObjects: CanvasObject[] = [
                {
                    id: 'title-obj',
                    type: 'text',
                    text: slide.title,
                    x: 0,
                    y: CANVAS_HEIGHT * 0.35,
                    width: CANVAS_WIDTH,
                    fontSize: 48,
                    fill: '#ffffff',
                    align: 'center',
                    fontStyle: 'bold',
                    field: 'title'
                },
                {
                    id: 'content-obj',
                    type: 'text',
                    text: slide.content,
                    x: CANVAS_WIDTH * 0.1,
                    y: CANVAS_HEIGHT * 0.52,
                    width: CANVAS_WIDTH * 0.8,
                    fontSize: 24,
                    fill: '#ffffff',
                    align: 'center',
                    field: 'content'
                }
            ];
            setObjects(defaultObjects);
            setHistory([JSON.stringify(defaultObjects)]);
            setHistoryIndex(0);
        }
    }, [slide.id]);

    // Sync props to objects
    useEffect(() => {
        if (editingId) return;

        let changed = false;
        const newObjects = objects.map(obj => {
            if (obj.field === 'title' && obj.text !== slide.title) {
                changed = true;
                return { ...obj, text: slide.title };
            }
            if (obj.field === 'content' && obj.text !== slide.content) {
                changed = true;
                return { ...obj, text: slide.content };
            }
            return obj;
        });

        if (changed) {
            setObjects(newObjects);
        }
    }, [slide.title, slide.content, editingId, objects]);

    // Responsive stage
    useEffect(() => {
        const fitStage = () => {
            if (!containerRef.current) return;
            const containerW = containerRef.current.clientWidth;
            const containerH = containerRef.current.clientHeight;

            const scaleW = (containerW - 40) / CANVAS_WIDTH;
            const scaleH = (containerH - 120) / CANVAS_HEIGHT;

            const newScale = Math.max(0.1, Math.min(scaleW, scaleH));
            setScale(newScale);
        };

        window.addEventListener('resize', fitStage);
        fitStage();
        return () => window.removeEventListener('resize', fitStage);
    }, []);

    // History management
    const saveHistory = useCallback((newObjects: CanvasObject[]) => {
        const json = JSON.stringify(newObjects);
        if (history[historyIndex] === json) return;

        const newHistory = history.slice(0, historyIndex + 1);
        newHistory.push(json);
        if (newHistory.length > 20) newHistory.shift();

        setHistory(newHistory);
        setHistoryIndex(newHistory.length - 1);
        onCanvasChange(json);
    }, [history, historyIndex, onCanvasChange]);

    const handleUndo = () => {
        if (historyIndex > 0) {
            const newIndex = historyIndex - 1;
            const json = history[newIndex];
            setObjects(JSON.parse(json));
            setHistoryIndex(newIndex);
            onCanvasChange(json);
        }
    };

    const handleRedo = () => {
        if (historyIndex < history.length - 1) {
            const newIndex = historyIndex + 1;
            const json = history[newIndex];
            setObjects(JSON.parse(json));
            setHistoryIndex(newIndex);
            onCanvasChange(json);
        }
    };

    const handleDragEnd = (e: any, id: string) => {
        const node = e.target;
        const newObjects = objects.map(obj => {
            if (obj.id === id) {
                return { ...obj, x: node.x(), y: node.y() };
            }
            return obj;
        });
        setObjects(newObjects);
        saveHistory(newObjects);
    };

    const handleTransformEnd = (e: any) => {
        const node = e.target;
        const newObjects = objects.map(obj => {
            if (obj.id === selectedId) {
                return {
                    ...obj,
                    x: node.x(),
                    y: node.y(),
                    width: Math.max(5, node.width() * node.scaleX()),
                    height: Math.max(5, node.height() * node.scaleY()),
                };
            }
            return obj;
        });

        node.scaleX(1);
        node.scaleY(1);

        setObjects(newObjects);
        saveHistory(newObjects);
    };

    const finishEditing = useCallback(() => {
        if (!editingId) return;

        const newObjects = objects.map(obj => {
            if (obj.id === editingId) {
                const updated = { ...obj, text: editText };
                if (updated.field) {
                    onTextChange(updated.field, editText);
                }
                return updated;
            }
            return obj;
        });

        setObjects(newObjects);
        saveHistory(newObjects);
        setEditingId(null);
        setEditAreaStyle(null);
        onTextBlur();
    }, [editingId, editText, objects, onTextChange, onTextBlur, saveHistory]);

    const handleDoubleClick = (id: string, text: string) => {
        const obj = objects.find(o => o.id === id);
        if (!obj || !stageRef.current) return;

        const textNode = stageRef.current.findOne('#' + id);
        if (!textNode) return;

        const textPosition = textNode.getAbsolutePosition();
        const areaPosition = {
            x: containerRef.current!.offsetLeft + textPosition.x,
            y: containerRef.current!.offsetTop + textPosition.y
        };

        const nodeHeight = textNode.height();

        setEditingId(id);
        setEditText(text);

        setEditAreaStyle({
            position: 'absolute',
            top: `${areaPosition.y}px`,
            left: `${areaPosition.x}px`,
            width: `${(obj.width || 200) * scale}px`,
            height: `${nodeHeight * scale}px`,
            fontSize: `${(obj.fontSize || 24) * scale}px`,
            border: 'none',
            padding: '0px',
            margin: '0px',
            background: 'transparent',
            color: obj.fill,
            outline: 'none',
            resize: 'none',
            fontFamily: 'Arial, sans-serif',
            fontWeight: obj.fontStyle?.includes('bold') ? 'bold' : 'normal',
            fontStyle: obj.fontStyle?.includes('italic') ? 'italic' : 'normal',
            textAlign: obj.align || 'left',
            lineHeight: LINE_HEIGHT,
            overflow: 'hidden',
            zIndex: 100,
        });
    };

    const handleAddText = () => {
        const newText: CanvasObject = {
            id: `text-${Date.now()}`,
            type: 'text',
            text: '新文本',
            x: CANVAS_WIDTH / 2 - 100,
            y: CANVAS_HEIGHT / 2,
            fontSize: 32,
            fill: '#ffffff',
            width: 200,
            align: 'left'
        };
        const newObjs = [...objects, newText];
        setObjects(newObjs);
        setSelectedId(newText.id);
        saveHistory(newObjs);
    };

    const updateSelectedFormat = (key: keyof CanvasObject, value: any) => {
        if (!selectedId) return;

        const newObjects = objects.map(obj => {
            if (obj.id === selectedId) {
                if (key === 'fontStyle') {
                    const isBold = obj.fontStyle?.includes('bold');
                    const isItalic = obj.fontStyle?.includes('italic');
                    let newStyle = '';

                    if (value === 'bold') {
                        if (!isBold) newStyle += 'bold ';
                        if (isItalic) newStyle += 'italic';
                    } else if (value === 'italic') {
                        if (isBold) newStyle += 'bold ';
                        if (!isItalic) newStyle += 'italic';
                    }
                    return { ...obj, fontStyle: newStyle.trim() || 'normal' };
                }
                return { ...obj, [key]: value };
            }
            return obj;
        });
        setObjects(newObjects);
        saveHistory(newObjects);
    };

    const handleDeleteSelected = () => {
        if (!selectedId) return;
        const obj = objects.find(o => o.id === selectedId);
        if (obj?.field) {
            onTextChange(obj.field, '');
        }

        const newObjects = objects.filter(o => o.id !== selectedId);
        setObjects(newObjects);
        setSelectedId(null);
        saveHistory(newObjects);
    };

    const format = useMemo(() => {
        const obj = objects.find(o => o.id === selectedId);
        if (!obj) return { bold: false, italic: false, underline: false, fill: '#ffffff', fontSize: 24, align: 'left' as const };
        return {
            bold: obj.fontStyle?.includes('bold') || false,
            italic: obj.fontStyle?.includes('italic') || false,
            underline: obj.textDecoration === 'underline',
            fill: obj.fill,
            fontSize: obj.fontSize || 24,
            align: obj.align || 'left' as const
        };
    }, [objects, selectedId]);

    // Update transformer
    useEffect(() => {
        if (selectedId && transformerRef.current && stageRef.current) {
            const node = stageRef.current.findOne('#' + selectedId);
            if (node) {
                transformerRef.current.nodes([node]);
                transformerRef.current.getLayer()?.batchDraw();
            }
        }
    }, [selectedId, objects]);



    return (
        <div className="flex-1 bg-zinc-900/50 flex flex-col relative overflow-hidden">
            <div
                className="flex-1 flex items-center justify-center relative bg-zinc-950 pb-16"
                ref={containerRef}
                onMouseDown={(e) => {
                    if (e.target === containerRef.current) {
                        setSelectedId(null);
                        finishEditing();
                    }
                }}
            >
                <button
                    onClick={onPrev}
                    disabled={isFirst}
                    className="absolute left-4 z-40 p-4 rounded-full bg-black/50 hover:bg-black/80 text-white disabled:opacity-0 transition backdrop-blur"
                >
                    <ChevronLeft size={24} />
                </button>

                <div className="shadow-2xl border border-zinc-800 rounded overflow-hidden relative">
                    <Stage
                        width={CANVAS_WIDTH * scale}
                        height={CANVAS_HEIGHT * scale}
                        scaleX={scale}
                        scaleY={scale}
                        ref={stageRef}
                        onMouseDown={(e: any) => {
                            const clickedOnEmpty = e.target === e.target.getStage() || e.target.name() === 'background';
                            if (clickedOnEmpty) {
                                setSelectedId(null);
                                if (editingId) finishEditing();
                            }
                        }}
                    >
                        <Layer>
                            <BackgroundImageLayer base64={slide.imageBase64} />
                        </Layer>
                        <Layer>
                            {objects.map((obj) => {
                                if (obj.type === 'text') {
                                    return (
                                        <Text
                                            key={obj.id}
                                            id={obj.id}
                                            text={obj.text}
                                            opacity={editingId === obj.id ? 0 : 1}
                                            x={obj.x}
                                            y={obj.y}
                                            width={obj.width}
                                            fontSize={obj.fontSize}
                                            fill={obj.fill}
                                            fontStyle={obj.fontStyle}
                                            textDecoration={obj.textDecoration}
                                            align={obj.align}
                                            lineHeight={LINE_HEIGHT}
                                            draggable
                                            onClick={() => setSelectedId(obj.id)}
                                            onTap={() => setSelectedId(obj.id)}
                                            onDblClick={() => handleDoubleClick(obj.id, obj.text || '')}
                                            onDragEnd={(e: any) => handleDragEnd(e, obj.id)}
                                            onTransformEnd={handleTransformEnd}
                                        />
                                    );
                                } else if (obj.type === 'rect') {
                                    return (
                                        <Rect
                                            key={obj.id}
                                            id={obj.id}
                                            x={obj.x}
                                            y={obj.y}
                                            width={obj.width}
                                            height={obj.height}
                                            fill={obj.fill}
                                            draggable
                                            onClick={() => setSelectedId(obj.id)}
                                            onTap={() => setSelectedId(obj.id)}
                                            onDragEnd={(e: any) => handleDragEnd(e, obj.id)}
                                            onTransformEnd={handleTransformEnd}
                                        />
                                    );
                                }
                                return null;
                            })}

                            {selectedId && (
                                <Transformer
                                    ref={transformerRef}
                                    boundBoxFunc={(oldBox: any, newBox: any) => {
                                        if (newBox.width < 5 || newBox.height < 5) {
                                            return oldBox;
                                        }
                                        return newBox;
                                    }}
                                />
                            )}
                        </Layer>
                    </Stage>

                    {/* Text Editing Overlay */}
                    {editingId && editAreaStyle && (
                        <textarea
                            value={editText}
                            onChange={(e) => setEditText(e.target.value)}
                            onBlur={finishEditing}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    finishEditing();
                                }
                            }}
                            style={editAreaStyle}
                            autoFocus
                        />
                    )}

                    {/* Status Overlays */}
                    {(slide.isGeneratingImage || slide.generationFailed) && (
                        <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center gap-6 p-6 text-center">
                            {slide.isGeneratingImage && (
                                <>
                                    <div className="flex flex-col items-center gap-2 text-purple-400 animate-pulse">
                                        <Loader2 size={48} className="animate-spin" />
                                        <span className="text-sm font-medium tracking-widest">生成视觉中...</span>
                                    </div>
                                    <button
                                        onClick={onStopGeneration}
                                        className="mt-4 px-6 py-2 bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/50 rounded-full text-sm font-semibold transition flex items-center gap-2"
                                    >
                                        <Square size={16} fill="currentColor" /> 停止生成
                                    </button>
                                </>
                            )}
                            {slide.generationFailed && (
                                <div className="flex flex-col items-center gap-4 animate-in fade-in zoom-in duration-300">
                                    <div className="flex flex-col items-center gap-2 text-red-400">
                                        <div className="p-3 bg-red-500/10 rounded-full">
                                            <AlertCircle size={48} />
                                        </div>
                                        <span className="text-lg font-bold tracking-wide text-white">生成失败</span>
                                        <p className="text-zinc-400 text-sm max-w-md">
                                            无法为此幻灯片生成图片。您可以重试或继续。
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-4 mt-2">
                                        <button
                                            onClick={onIgnore}
                                            className="px-6 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded-full text-sm font-semibold transition border border-zinc-700 hover:border-zinc-600"
                                        >
                                            忽略
                                        </button>
                                        <button
                                            onClick={onRetry}
                                            className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 text-white rounded-full text-sm font-semibold transition flex items-center gap-2 shadow-[0_0_15px_rgba(168,85,247,0.4)]"
                                        >
                                            <RefreshCw size={16} /> 重新生成
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Top Left Controls */}
                    <div className="absolute top-4 left-4 z-[60] flex gap-2">
                        <button
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-2 rounded-full bg-zinc-800/80 hover:bg-red-500 text-white transition shadow-lg border border-zinc-700/50"
                            title="删除幻灯片"
                        >
                            <Trash2 size={18} />
                        </button>
                    </div>

                    {/* Top Right Controls */}
                    <div className="absolute top-4 right-4 z-[60] flex gap-2">
                        {slide.isGeneratingImage ? (
                            <button
                                onClick={onStopGeneration}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 rounded-full bg-red-500/80 hover:bg-red-500 text-white shadow-lg"
                            >
                                <Square size={18} fill="currentColor" />
                            </button>
                        ) : (
                            <button
                                onClick={onOpenRegenerateModal}
                                onPointerDown={(e) => e.stopPropagation()}
                                onMouseDown={(e) => e.stopPropagation()}
                                className="p-2 rounded-full bg-zinc-800/80 hover:bg-purple-500 text-white shadow-lg border border-zinc-700/50"
                            >
                                <RefreshCw size={18} />
                            </button>
                        )}
                    </div>

                    {/* Floating Toolbar */}
                    {selectedId && !editingId && (
                        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-1 p-1 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl">
                            <div className="relative group/color">
                                <div className="w-8 h-8 rounded hover:bg-zinc-800 flex items-center justify-center cursor-pointer" style={{ color: format.fill }}>
                                    <Palette size={18} />
                                    <div className="w-4 h-1 absolute bottom-1.5 rounded-full bg-current" />
                                </div>
                                <input
                                    type="color"
                                    className="absolute inset-0 opacity-0 cursor-pointer"
                                    value={format.fill}
                                    onChange={(e) => updateSelectedFormat('fill', e.target.value)}
                                />
                            </div>
                            <div className="w-px h-5 bg-zinc-700 mx-1" />

                            <div className="flex items-center gap-1 bg-zinc-950 rounded border border-zinc-800 px-1">
                                <button onClick={() => updateSelectedFormat('fontSize', Math.max(8, format.fontSize - 2))} className="p-1 text-zinc-400 hover:text-white">
                                    <Minus size={12} />
                                </button>
                                <span className="text-xs w-6 text-center text-white">{format.fontSize}</span>
                                <button onClick={() => updateSelectedFormat('fontSize', Math.min(120, format.fontSize + 2))} className="p-1 text-zinc-400 hover:text-white">
                                    <Plus size={12} />
                                </button>
                            </div>

                            <div className="w-px h-5 bg-zinc-700 mx-1" />

                            <div className="flex items-center gap-0.5 bg-zinc-950 rounded border border-zinc-800 p-0.5">
                                <button onClick={() => updateSelectedFormat('align', 'left')} className={`p-1 rounded hover:bg-zinc-800 ${format.align === 'left' ? 'text-purple-400 bg-zinc-800' : 'text-zinc-400'}`}>
                                    <AlignLeft size={14} />
                                </button>
                                <button onClick={() => updateSelectedFormat('align', 'center')} className={`p-1 rounded hover:bg-zinc-800 ${format.align === 'center' ? 'text-purple-400 bg-zinc-800' : 'text-zinc-400'}`}>
                                    <AlignCenter size={14} />
                                </button>
                                <button onClick={() => updateSelectedFormat('align', 'right')} className={`p-1 rounded hover:bg-zinc-800 ${format.align === 'right' ? 'text-purple-400 bg-zinc-800' : 'text-zinc-400'}`}>
                                    <AlignRight size={14} />
                                </button>
                            </div>

                            <div className="w-px h-5 bg-zinc-700 mx-1" />

                            <button onClick={() => updateSelectedFormat('fontStyle', 'bold')} className={`p-1.5 rounded hover:bg-zinc-800 ${format.bold ? 'text-purple-400 bg-zinc-800' : 'text-zinc-400'}`}>
                                <Bold size={16} />
                            </button>
                            <button onClick={() => updateSelectedFormat('fontStyle', 'italic')} className={`p-1.5 rounded hover:bg-zinc-800 ${format.italic ? 'text-purple-400 bg-zinc-800' : 'text-zinc-400'}`}>
                                <Italic size={16} />
                            </button>
                            <button onClick={() => updateSelectedFormat('textDecoration', format.underline ? '' : 'underline')} className={`p-1.5 rounded hover:bg-zinc-800 ${format.underline ? 'text-purple-400 bg-zinc-800' : 'text-zinc-400'}`}>
                                <Underline size={16} />
                            </button>

                            <div className="w-px h-5 bg-zinc-700 mx-1" />

                            <button onClick={handleDeleteSelected} className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400">
                                <Trash2 size={16} />
                            </button>
                        </div>
                    )}
                </div>

                <button
                    onClick={onNext}
                    disabled={isLast}
                    className="absolute right-4 z-40 p-4 rounded-full bg-black/50 hover:bg-black/80 text-white disabled:opacity-0 transition backdrop-blur"
                >
                    <ChevronRight size={24} />
                </button>

                {/* Bottom Main Toolbar */}
                <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 z-40 flex items-center gap-2 bg-zinc-900/90 backdrop-blur border border-zinc-700 p-2 rounded-2xl shadow-2xl">
                    <button
                        onClick={handleUndo}
                        disabled={historyIndex <= 0}
                        className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition"
                        title="撤销"
                    >
                        <Undo size={20} />
                    </button>
                    <button
                        onClick={handleRedo}
                        disabled={historyIndex >= history.length - 1}
                        className="p-3 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-xl disabled:opacity-30 disabled:hover:bg-transparent transition"
                        title="重做"
                    >
                        <Redo size={20} />
                    </button>

                    <div className="w-px h-8 bg-zinc-700 mx-1" />

                    <button
                        onClick={handleAddText}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl font-medium transition shadow-lg shadow-purple-900/30"
                    >
                        <Type size={18} />
                        <span>添加文本</span>
                    </button>
                </div>
            </div>

            <div className="bg-zinc-950 py-2 text-center text-xs text-zinc-500 border-t border-zinc-800 flex justify-center gap-4">
                <span className="flex items-center gap-1"><MousePointer2 size={12} /> 双击文本进行编辑</span>
                <span className="flex items-center gap-1">选择文本显示格式化工具</span>
            </div>
        </div>
    );
};

export default SlideViewer;
