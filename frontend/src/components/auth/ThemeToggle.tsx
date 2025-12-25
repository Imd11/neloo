"use client";

import { Sun, Moon } from "lucide-react";

interface ThemeToggleProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps) {
  return (
    <button
      onClick={onToggle}
      className="w-10 h-10 rounded-xl bg-secondary/80 backdrop-blur-sm flex items-center justify-center hover:bg-secondary transition-all duration-200 hover:scale-105"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-[18px] h-[18px] text-foreground" />
      ) : (
        <Moon className="w-[18px] h-[18px] text-foreground" />
      )}
    </button>
  );
}
