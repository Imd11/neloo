"use client";

import { Sun, Moon } from "lucide-react";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  const toggleTheme = () => {
    setTheme(isDark ? "light" : "dark");
  };

  return (
    <button
      onClick={toggleTheme}
      className="bg-secondary/80 flex h-10 w-10 items-center justify-center rounded-xl backdrop-blur-sm transition-all duration-200 hover:scale-105 hover:bg-secondary"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {isDark ? (
        <Sun className="h-[18px] w-[18px] text-foreground" />
      ) : (
        <Moon className="h-[18px] w-[18px] text-foreground" />
      )}
    </button>
  );
}
