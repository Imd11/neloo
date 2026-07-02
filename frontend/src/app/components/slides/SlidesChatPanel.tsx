'use client';

import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Loader2 } from 'lucide-react';
import type { Slide } from '@/app/slides/types/slides';
import { getConfig } from '@/lib/config';

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

const SYSTEM_PROMPT = `You are a professional presentation assistant. The user is editing a presentation, and you can help them:
1. Modify slide titles or content
2. Improve copy and wording
3. Add or remove bullet points
4. Refine visual descriptions

When the user asks for changes, provide specific suggestions. If a specific slide should be changed, clearly identify the slide number and the exact change.

Response format:
- Answer the user's question directly
- For edit suggestions, mark them with "[Edit suggestion]"
- Keep the tone concise and friendly`;

function getApiBaseUrl(): string {
    return (getConfig()?.deploymentUrl || process.env.NEXT_PUBLIC_API_URL || '').replace(/\/+$/, '');
}

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
            return `Generating an outline for "${topic || 'your presentation'}"...`;
        }
        if (slides.length > 0) {
            return `The outline is ready with ${slides.length} slides. You can:\n\n• Edit content directly on the left\n• Ask me to improve a slide\n• Ask for structure suggestions`;
        }
        return `Hi. I am your slides assistant. Wait for the outline to finish generating.`;
    };

    // Scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, streamingContent]);

    // Create slides context for API
    const createSlidesContext = () => {
        if (slides.length === 0) return '';

        let context = `Current presentation topic: ${topic || 'Untitled'}\n\nSlides:\n`;
        slides.forEach((slide, index) => {
            context += `\n[Slide ${index + 1}]\n`;
            context += `Title: ${slide.title}\n`;
            context += `Content: ${slide.content}\n`;
            context += `Visual description: ${slide.visualDescription}\n`;
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
            const slidesContext = createSlidesContext();
            const conversation = messages
                .map((message) => `${message.role}: ${message.content}`)
                .join('\n');
            const response = await fetch(`${getApiBaseUrl()}/api/slides/generate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system: SYSTEM_PROMPT,
                    prompt: `${slidesContext ? `${slidesContext}\n\n` : ''}${conversation ? `Conversation so far:\n${conversation}\n\n` : ''}User request: ${input}`,
                    temperature: 0.7,
                })
            });

            if (!response.ok) {
                throw new Error(`API error: ${response.status}`);
            }

            const data = await response.json();
            const fullContent = data.text || '';
            setMessages(prev =>
                prev.map(m =>
                    m.id === assistantId
                        ? { ...m, content: fullContent }
                        : m
                )
            );

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
                        ? { ...m, content: `Error: ${error instanceof Error ? error.message : 'Request failed'}`, isStreaming: false }
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
                <span className="font-semibold text-white">AI Assistant</span>
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
                            Generating outline...
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
                            {message.role === 'assistant' ? <Sparkles size={14} /> : 'Me'}
                        </div>
                        <div className={`flex-1 rounded-lg p-3 text-sm ${message.role === 'assistant'
                                ? 'bg-zinc-800 text-zinc-300'
                                : 'bg-purple-600/20 text-purple-100'
                            }`}>
                            {message.content || (message.isStreaming ? 'Thinking...' : '')}
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
                        placeholder="Describe what you need..."
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
                        You can chat after the outline is ready.
                    </p>
                )}
            </div>
        </div>
    );
}

export default SlidesChatPanel;
