'use client';

import React, { useState } from 'react';
import { Plus, X, Loader2 } from 'lucide-react';

interface NewSlideModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: (description: string) => void;
    isGenerating: boolean;
}

const NewSlideModal: React.FC<NewSlideModalProps> = ({ isOpen, onClose, onConfirm, isGenerating }) => {
    const [description, setDescription] = useState('');

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="text-lg font-bold text-white flex items-center gap-2">
                        <Plus size={18} className="text-purple-400" /> 添加新幻灯片
                    </h3>
                    <button onClick={onClose} disabled={isGenerating} className="text-zinc-500 hover:text-white transition disabled:opacity-50">
                        <X size={20} />
                    </button>
                </div>

                <p className="text-sm text-zinc-400">
                    描述新幻灯片的内容，AI 将为您生成标题、要点和背景图片。
                </p>

                <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    className="w-full h-32 bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-zinc-300 text-sm focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none resize-none"
                    placeholder="例如：一张关于市场营销策略的幻灯片，重点介绍社交媒体增长..."
                    autoFocus
                    disabled={isGenerating}
                />

                <div className="flex justify-end gap-3 pt-2">
                    <button
                        onClick={onClose}
                        disabled={isGenerating}
                        className="px-4 py-2 rounded-lg text-sm text-zinc-300 hover:bg-zinc-800 transition disabled:opacity-50"
                    >
                        取消
                    </button>
                    <button
                        onClick={() => onConfirm(description)}
                        disabled={!description.trim() || isGenerating}
                        className="px-4 py-2 rounded-lg text-sm bg-purple-600 hover:bg-purple-500 text-white font-semibold shadow-lg shadow-purple-900/30 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isGenerating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                        {isGenerating ? '创建中...' : '创建幻灯片'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default NewSlideModal;
