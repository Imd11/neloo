"use client";

import { Loader2, Download, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { useLanguageSafe } from "@/providers/LanguageProvider";

interface DownloadOverlayProps {
    isVisible: boolean;
    status: "downloading" | "success" | "error";
    onComplete?: () => void;
}

export function DownloadOverlay({ isVisible, status, onComplete }: DownloadOverlayProps) {
    const { t } = useLanguageSafe();
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Auto-hide success state after 1.5s
    useEffect(() => {
        if (status === "success" && onComplete) {
            const timer = setTimeout(onComplete, 1500);
            return () => clearTimeout(timer);
        }
    }, [status, onComplete]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isVisible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm"
                >
                    <motion.div
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.8, opacity: 0 }}
                        transition={{ type: "spring", duration: 0.4 }}
                        className="flex flex-col items-center gap-4"
                    >
                        {status === "downloading" && (
                            <>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-cyan-500/30 blur-2xl rounded-full animate-pulse" />
                                    <div className="relative bg-card border border-border rounded-2xl p-6">
                                        <Loader2 className="w-12 h-12 text-primary animate-spin" />
                                    </div>
                                </div>
                                <p className="text-foreground font-medium text-lg">
                                    {t("canvas.downloading")}
                                </p>
                            </>
                        )}

                        {status === "success" && (
                            <>
                                <motion.div
                                    initial={{ scale: 0 }}
                                    animate={{ scale: 1 }}
                                    transition={{ type: "spring", stiffness: 300 }}
                                    className="relative"
                                >
                                    <div className="absolute inset-0 bg-emerald-500/30 blur-2xl rounded-full" />
                                    <div className="relative bg-card border border-border rounded-2xl p-6">
                                        <Check className="w-12 h-12 text-emerald-400" />
                                    </div>
                                </motion.div>
                                <p className="text-foreground font-medium text-lg">
                                    {t("canvas.download_complete")}
                                </p>
                            </>
                        )}

                        {status === "error" && (
                            <>
                                <div className="relative">
                                    <div className="absolute inset-0 bg-red-500/30 blur-2xl rounded-full" />
                                    <div className="relative bg-card border border-border rounded-2xl p-6">
                                        <Download className="w-12 h-12 text-red-400" />
                                    </div>
                                </div>
                                <p className="text-foreground font-medium text-lg">
                                    {t("canvas.download_failed")}
                                </p>
                            </>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>,
        document.body
    );
}
