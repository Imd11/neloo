"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

export function RotatingHeadline() {
    const [index, setIndex] = useState(0);
    const headlines = [
        "有什么可以帮你的吗？",
        "写一个 python 脚本",
        "帮我写一个 PPT",
        "帮我优化简历",
        "帮我优化 prompt",
        "分析一下这个数据",
    ];

    useEffect(() => {
        const timer = setInterval(() => {
            setIndex((prev) => (prev + 1) % headlines.length);
        }, 3000);
        return () => clearInterval(timer);
    }, []);

    return (
        <div className="h-12 flex items-center justify-center overflow-hidden">
            <AnimatePresence mode="wait">
                <motion.h1
                    key={index}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ duration: 0.5 }}
                    className="text-4xl font-semibold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 dark:from-white dark:via-gray-200 dark:to-white"
                >
                    {headlines[index]}
                </motion.h1>
            </AnimatePresence>
        </div>
    );
}
