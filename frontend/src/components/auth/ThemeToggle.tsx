"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/providers/ThemeProvider";

interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className = "" }: ThemeToggleProps) {
  const { isDark, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className={`
        p-2.5 rounded-lg
        bg-[hsl(var(--auth-secondary))]/80
        hover:bg-[hsl(var(--auth-secondary))]
        text-[hsl(var(--auth-foreground))]
        backdrop-blur-sm
        transition-all duration-200
        hover:scale-105
        ${className}
      `}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="w-4 h-4" />
      ) : (
        <Moon className="w-4 h-4" />
      )}
    </button>
  );
}
