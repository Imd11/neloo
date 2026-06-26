'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import type { Slide } from '@/app/slides/types/slides';

// Tu-Zi API configuration
const TUZI_CHAT_URL = 'https://api.tu-zi.com/v1/chat/completions';
const TUZI_API_KEY = process.env.NEXT_PUBLIC_TUZI_API_KEY?.trim();
const TUZI_CHAT_MODEL = 'gemini-3-flash-preview';

interface SlidesChatPanelProps {
    slides: Slide[];
    onSlidesChange?: (slides: Slide[]) => void;
    topic?: string;
    streamingContent?: string;
    isGenerating?: boolean;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    isStreaming?: boolean;
}

const SYSTEM_PROMPT = `你是一个专业的演示文稿助手。用户正在编辑一个演示文稿，你可以帮助他们：
1. 修改幻灯片标题或内容
2. 优化文案表达
3. 添加或删除要点
4. 调整视觉描述

当用户请求修改时，请提供具体的建议。如果需要修改特定幻灯片，请明确指出幻灯片编号和修改内容。

回复格式：
- 直接回答用户的问题
- 如果是修改建议，用 "【修改建议】" 标记
- 保持简洁友好的语气`;

export function SlidesChatPanel({
    slides,
    onSlidesChange,
    topic,
    streamingContent,
    isGenerating
}: SlidesChatPanelProps) {
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Generate welcome message based on state
    const getWelcomeMessage = () => {
        if (isGenerating) {
            return `正在为你生成 "${topic || '演示文稿'}" 的大纲...`;
        }
        if (slides.length > 0) {
            return `大纲已生成，共 ${slides.length} 张幻灯片。你可以：\n\n• 直接编辑左侧的内容\n• 让我帮你优化某张幻灯片\n• 询问结构建议`;
        }
        return `你好！我是幻灯片助手。请稍等大纲生成完成...`;
    };

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Create slides context for API
    const createSlidesContext = () => {
        if (slides.length === 0) return '';

        let context = `当前演示文稿主题: ${topic || '未命名'}\n\n幻灯片列表:\n`;
        slides.forEach((slide, index) => {
            context += `\n【幻灯片 ${index + 1}】\n`;
            context += `标题: ${slide.title}\n`;
            context += `内容: ${slide.content}\n`;
            context += `视觉描述: ${slide.visualDescription}\n`;
        });
        return context;
    };

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'user',
            content: input,
        };

        setMessages(prev => [...prev, userMessage]);
        setInput('');
        setIsLoading(true);

        // Create assistant placeholder
        const assistantId = (Date.now() + 1).toString();
        setMessages(prev => [
            ...prev,
            { id: assistantId, role: 'assistant', content: '', isStreaming: true },
        ]);

        try {
            if (!TUZI_API_KEY) {
                throw new Error('Missing NEXT_PUBLIC_TUZI_API_KEY');
            }

            // Build API messages
            const apiMessages = [
                { role: 'system', content: SYSTEM_PROMPT },
            ];

            // Add slides context if available
            const slidesContext = createSlidesContext();
            if (slidesContext) {
                apiMessages.push({ role: 'user', content: slidesContext });
                apiMessages.push({ role: 'assistant', content: '我已了解当前的幻灯片内容，请告诉我你需要什么帮助。' });
            }

            // Add conversation history
            messages.forEach(m => {
                apiMessages.push({ role: m.role, content: m.content });
            });

            // Add current user message
            apiMessages.push({ role: 'user', content: input });

            // Call Tu-Zi API with streaming
            const response = await fetch(TUZI_CHAT_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${TUZI_API_KEY}`
                },
                body: JSON.stringify({
                    model: TUZI_CHAT_MODEL,
                    messages: apiMessages,
                    stream: true,
                    temperature: 0.7
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const reader = response.body?.getReader();
            if (!reader) throw new Error("No response body");

            const decoder = new TextDecoder();
            let fullContent = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;

                const chunk = decoder.decode(value, { stream: true });
                const lines = chunk.split('\n').filter(line => line.trim() !== '');

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') continue;

                        try {
                            const parsed = JSON.parse(data);
                            const content = parsed.choices?.[0]?.delta?.content;
                            if (content) {
                                fullContent += content;
                                setMessages(prev =>
                                    prev.map(m =>
                                        m.id === assistantId
                                            ? { ...m, content: fullContent }
                                            : m
                                    )
                                );
                            }
                        } catch {
                            // Ignore parse errors
                        }
                    }
                }
            }

            // Mark streaming complete
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantId
                        ? { ...m, isStreaming: false }
                        : m
                )
            );
        } catch (error) {
            console.error('Chat error:', error);
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: `错误: ${error instanceof Error ? error.message : '请求失败'}`, isStreaming: false }
                        : m
                )
            );
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <div className="h-full flex flex-col bg-zinc-900">
            {/* Header */}
            <div className="h-14 px-4 flex items-center gap-2 border-b border-zinc-800 shrink-0">
                <Sparkles size={18} className="text-purple-400" />
                <span className="font-semibold text-white">AI 助手</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {/* Welcome/Status Message */}
                <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-purple-600 flex items-center justify-center shrink-0">
                            <Sparkles size={14} className="text-white" />
                        </div>
                        <div className="text-sm text-zinc-300 whitespace-pre-wrap">
                            {getWelcomeMessage()}
                        </div>
                    </div>
                </div>

                {/* Streaming Content (during outline generation) */}
                {isGenerating && streamingContent && (
                    <div className="bg-zinc-800/30 rounded-lg p-3">
                        <p className="text-xs text-zinc-500 mb-2 flex items-center gap-2">
                            <Loader2 size={12} className="animate-spin" />
                            生成大纲中...
                        </p>
                        <pre className="text-xs text-green-400/80 font-mono whitespace-pre-wrap max-h-32 overflow-y-auto">
                            {streamingContent.substring(0, 500)}...
                        </pre>
                    </div>
                )}

                {/* Chat Messages */}
                {messages.map((message) => (
                    <div key={message.id} className="flex gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-xs shrink-0 ${message.role === 'assistant'
                                ? 'bg-purple-600'
                                : 'bg-zinc-600'
                            }`}>
                            {message.role === 'assistant' ? <Sparkles size={14} /> : '我'}
                        </div>
                        <div className={`flex-1 rounded-lg p-3 text-sm ${message.role === 'assistant'
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-purple-600/20 text-purple-100'
                            }`}>
                            {message.content || (message.isStreaming ? '思考中...' : '')}
                            {message.isStreaming && message.content && (
                                <span className="inline-block w-1.5 h-4 bg-purple-500 ml-0.5 animate-pulse" />
                            )}
                        </div>
                    </div>
                ))}

                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-3 border-t border-zinc-800 shrink-0">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="输入你的需求..."
                        disabled={isLoading || isGenerating}
                        className="flex-1 px-3 py-2 text-sm bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-1 focus:ring-purple-500 disabled:opacity-50"
                    />
                    <button
                        onClick={handleSend}
                        disabled={isLoading || !input.trim() || isGenerating}
                        className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoading ? (
                            <Loader2 size={16} className="animate-spin" />
                        ) : (
                            <Send size={16} />
                        )}
                    </button>
                </div>
                {isGenerating && (
                    <p className="text-xs text-zinc-500 mt-2 text-center">
                        大纲生成完成后可开始对话
                    </p>
                )}
            </div>
        </div>
    );
}

export default SlidesChatPanel;
