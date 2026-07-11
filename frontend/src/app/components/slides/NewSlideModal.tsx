"use client";

import React, { useState } from "react";
import { Plus, X, Loader2 } from "lucide-react";

interface NewSlideModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (description: string) => void;
  isGenerating: boolean;
}

const NewSlideModal: React.FC<NewSlideModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  isGenerating,
}) => {
  const [description, setDescription] = useState("");

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <Plus
              size={18}
              className="text-purple-400"
            />{" "}
            添加新幻灯片
          </h3>
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="text-zinc-500 transition hover:text-white disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-zinc-400">
          描述新幻灯片的内容，AI 将为您生成标题、要点和背景图片。
        </p>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="focus:border-purple-500 h-32 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-purple-500"
          placeholder="例如：一张关于市场营销策略的幻灯片，重点介绍社交媒体增长..."
          autoFocus
          disabled={isGenerating}
        />

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isGenerating}
            className="rounded-lg px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(description)}
            disabled={!description.trim() || isGenerating}
            className="bg-purple-600 hover:bg-purple-500 flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isGenerating ? (
              <Loader2
                className="animate-spin"
                size={16}
              />
            ) : (
              <Plus size={16} />
            )}
            {isGenerating ? "创建中..." : "创建幻灯片"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default NewSlideModal;
