"use client";

import React from "react";
import { AlertTriangle, X } from "lucide-react";

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onClose: () => void;
  isDangerous?: boolean;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  message,
  confirmText = "确认",
  cancelText = "取消",
  onConfirm,
  onClose,
  isDangerous = false,
}) => {
  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
      <div className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-700 bg-zinc-900 p-6 shadow-2xl duration-200 animate-in fade-in zoom-in">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className={`rounded-full p-2 ${
                isDangerous
                  ? "bg-red-500/10 text-red-400"
                  : "bg-zinc-800 text-zinc-400"
              }`}
            >
              <AlertTriangle size={20} />
            </div>
            <h3 className="text-lg font-bold text-white">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 transition hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-sm leading-relaxed text-zinc-400">{message}</p>

        <div className="flex justify-end gap-3 pt-2">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800"
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold shadow-lg transition ${
              isDangerous
                ? "bg-red-600 text-white shadow-red-900/20 hover:bg-red-500"
                : "bg-purple-600 hover:bg-purple-500 text-white"
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationModal;
