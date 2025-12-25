"use client";

import { useState, useEffect } from "react";
import { TrendingUp } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthBackground } from "@/components/auth/AuthBackground";
import { ThemeToggle } from "@/components/auth/ThemeToggle";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check system preference
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    setIsDark(prefersDark);
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
    document.documentElement.classList.toggle("dark");
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative px-5 py-10 bg-background">
      <AuthBackground />

      {/* Theme Toggle - Fixed Position */}
      <div className="fixed top-5 right-5 z-20">
        <ThemeToggle isDark={isDark} onToggle={toggleTheme} />
      </div>

      <div className="w-full max-w-[400px] relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-[18px] h-[18px] text-primary-foreground" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Deep Agent
          </span>
        </div>

        {/* Card */}
        <div className="bg-card rounded-2xl border border-border p-8 card-elevated">
          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-5 mt-8 text-[13px] text-muted-foreground">
          <span className="hover:text-foreground transition-colors cursor-pointer">Privacy</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="hover:text-foreground transition-colors cursor-pointer">Terms</span>
          <span className="w-1 h-1 rounded-full bg-border" />
          <span className="hover:text-foreground transition-colors cursor-pointer">Help</span>
        </div>
      </div>
    </div>
  );
}
