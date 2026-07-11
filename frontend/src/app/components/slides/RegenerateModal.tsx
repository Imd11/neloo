"use client";

import React, { useState, useEffect } from "react";
import { RefreshCw, X } from "lucide-react";

interface RegenerateModalProps {
  isOpen: boolean;
  initialPrompt: string;
  onClose: () => void;
  onConfirm: (newPrompt: string) => void;
}

const RegenerateModal: React.FC<RegenerateModalProps> = ({
  isOpen,
  initialPrompt,
  onClose,
  onConfirm,
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);

  useEffect(() => {
    if (isOpen) {
      setPrompt(initialPrompt);
    }
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-lg space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-lg font-bold text-white">
            <RefreshCw
              size={18}
              className="text-purple-400"
            />{" "}
            重新生成图片
          </h3>
          <button
            onClick={onClose}
            className="text-zinc-500 transition hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm text-zinc-400">
          编辑下方的视觉描述，引导 AI 生成新的背景图片。
        </p>

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          className="focus:border-purple-500 h-32 w-full resize-none rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-sm text-zinc-300 outline-none focus:ring-1 focus:ring-purple-500"
          placeholder="描述你想要的图片..."
        />

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
          >
            取消
          </button>
          <button
            onClick={() => onConfirm(prompt)}
            className="bg-purple-600 hover:bg-purple-500 rounded-lg px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-purple-900/30 transition"
          >
            生成新图片
          </button>
        </div>
      </div>
    </div>
  );
};

export default RegenerateModal;
