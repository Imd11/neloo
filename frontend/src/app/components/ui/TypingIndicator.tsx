"use client";

import { motion } from "framer-motion";

export function TypingIndicator({
  className,
  dotClassName,
}: {
  className?: string;
  dotClassName?: string;
}) {
  const resolvedDotClassName = dotClassName ?? "w-2 h-2 bg-foreground/60 rounded-full";
  return (
    <div className={className ?? "flex items-center gap-1.5 py-2"}>
      <motion.span
        className={resolvedDotClassName}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0 }}
      />
      <motion.span
        className={resolvedDotClassName}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
      />
      <motion.span
        className={resolvedDotClassName}
        animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1, repeat: Infinity, delay: 0.4 }}
      />
    </div>
  );
}
