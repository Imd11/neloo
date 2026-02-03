import { useState, useRef } from 'react';
import { parseResumeText, extractTextFromPDF, extractImagesFromPDF } from '../lib/resumeParser';
import { parseResumeWithBackend } from '../lib/smartResumeClient';
import { extractTextFromImage } from '../lib/ocr';
import type { ResumeData } from '../types/resume';

interface ResumeUploadProps {
    onParsed: (data: ResumeData) => void;
    onSkip: () => void;
}

type UploadStatus = 'idle' | 'extracting' | 'parsing' | 'success' | 'error';

export function ResumeUpload({ onParsed, onSkip }: ResumeUploadProps) {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [error, setError] = useState<string>('');
    const [dragActive, setDragActive] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleFile = async (file: File) => {
        if (!file) return;

        setError('');

        try {
            // For PDF files, use the SmartResume backend with YOLOv10 layout detection
            if (file.type === 'application/pdf') {
                setStatus('parsing');

                // Try SmartResume backend first
                try {
                    const parsedData = await parseResumeWithBackend(file);
                    setStatus('success');
                    setTimeout(() => onParsed(parsedData), 500);
                    return;
                } catch (backendError) {
                    console.warn('SmartResume backend failed, falling back to frontend parsing:', backendError);
                    // Fall back to original method
                }

                // Fallback: frontend parsing
                setStatus('extracting');
                const [text, extractedPhoto] = await Promise.all([
                    extractTextFromPDF(file),
                    extractImagesFromPDF(file),
                ]);

                if (!text.trim()) {
                    throw new Error('无法从文件中提取文字');
                }

                setStatus('parsing');
                const parsedData = await parseResumeText(text);

                if (extractedPhoto && !parsedData.personal.photo) {
                    parsedData.personal.photo = extractedPhoto;
                }

                setStatus('success');
                setTimeout(() => onParsed(parsedData), 500);
                return;
            }

            // For text files
            if (file.type.startsWith('text/')) {
                setStatus('extracting');
                const text = await file.text();
                if (!text.trim()) {
                    throw new Error('无法从文件中提取文字');
                }
                setStatus('parsing');
                const parsedData = await parseResumeText(text);
                setStatus('success');
                setTimeout(() => onParsed(parsedData), 500);
                return;
            }

            // For image files
            if (file.type.startsWith('image/')) {
                setStatus('extracting');
                const text = await extractTextFromImage(file);
                if (!text.trim()) {
                    throw new Error('无法从文件中提取文字');
                }
                setStatus('parsing');
                const parsedData = await parseResumeText(text);
                setStatus('success');
                setTimeout(() => onParsed(parsedData), 500);
                return;
            }

            throw new Error('请上传 PDF、TXT 或图片文件');
        } catch (err) {
            setStatus('error');
            setError(err instanceof Error ? err.message : '解析失败');
        }
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

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-6">
            <div className="w-full max-w-lg">
                {/* Header */}
                <div className="text-center mb-8">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">📄 简历优化助手</h1>
                    <p className="text-gray-500">上传你的简历，AI 将自动提取信息</p>
                </div>

                {/* Upload Zone */}
                <div
                    onDrop={handleDrop}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onClick={() => status === 'idle' && fileInputRef.current?.click()}
                    className={`
            relative rounded-2xl border-2 border-dashed p-12 text-center transition-all cursor-pointer
            ${dragActive
                            ? 'border-indigo-500 bg-indigo-50'
                            : 'border-gray-300 hover:border-indigo-400 hover:bg-gray-50'
                        }
            ${status !== 'idle' ? 'pointer-events-none' : ''}
          `}
                >
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".pdf,.txt,image/*"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {status === 'idle' && (
                        <>
                            <div className="w-16 h-16 mx-auto mb-4 bg-indigo-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">📤</span>
                            </div>
                            <p className="text-lg font-medium text-gray-700 mb-2">
                                拖放简历文件到这里
                            </p>
                            <p className="text-sm text-gray-500 mb-4">
                                或点击选择文件（支持 PDF、TXT、JPG、PNG）
                            </p>
                            <button className="px-6 py-2 bg-indigo-500 text-white rounded-full text-sm font-medium hover:bg-indigo-600 transition-colors">
                                选择文件
                            </button>
                        </>
                    )}

                    {status === 'extracting' && (
                        <div className="py-8">
                            <div className="w-12 h-12 mx-auto mb-4 border-4 border-indigo-200 border-t-indigo-500 rounded-full animate-spin" />
                            <p className="text-lg font-medium text-gray-700">正在提取/识别文字...</p>
                            <p className="text-sm text-gray-500 mt-2">图片识别可能需要更久</p>
                        </div>
                    )}

                    {status === 'parsing' && (
                        <div className="py-8">
                            <div className="w-12 h-12 mx-auto mb-4 border-4 border-purple-200 border-t-purple-500 rounded-full animate-spin" />
                            <p className="text-lg font-medium text-gray-700">AI 正在解析简历...</p>
                            <p className="text-sm text-gray-500 mt-2">这可能需要几秒钟</p>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="py-8">
                            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">✅</span>
                            </div>
                            <p className="text-lg font-medium text-green-600">解析成功！</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="py-8">
                            <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                                <span className="text-3xl">❌</span>
                            </div>
                            <p className="text-lg font-medium text-red-600 mb-2">解析失败</p>
                            <p className="text-sm text-red-500 mb-4">{error}</p>
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setStatus('idle');
                                    setError('');
                                }}
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm hover:bg-gray-200 transition-colors"
                            >
                                重试
                            </button>
                        </div>
                    )}
                </div>

                {/* Skip Button */}
                {status === 'idle' && (
                    <div className="text-center mt-6">
                        <button
                            onClick={onSkip}
                            className="text-sm text-gray-500 hover:text-indigo-600 transition-colors"
                        >
                            跳过，手动填写简历 →
                        </button>
                    </div>
                )}

                {/* Features */}
                <div className="mt-12 grid grid-cols-3 gap-4 text-center">
                    <div className="p-4">
                        <div className="text-2xl mb-2">🤖</div>
                        <p className="text-xs text-gray-600">AI 智能解析</p>
                    </div>
                    <div className="p-4">
                        <div className="text-2xl mb-2">⚡</div>
                        <p className="text-xs text-gray-600">秒级提取</p>
                    </div>
                    <div className="p-4">
                        <div className="text-2xl mb-2">🎨</div>
                        <p className="text-xs text-gray-600">多种模板</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
