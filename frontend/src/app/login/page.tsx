"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { LoginForm } from "@/components/auth/LoginForm";
import { RegisterForm } from "@/components/auth/RegisterForm";
import { AuthBackground } from "@/components/auth/AuthBackground";
import "./login.css";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <div className="login-page min-h-screen flex items-center justify-center relative px-5 py-10 bg-[hsl(var(--background))]">
      <AuthBackground />

      <div className="w-full max-w-[400px] relative z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 mb-10">
          <div className="w-9 h-9 rounded-lg bg-[hsl(var(--primary))] flex items-center justify-center">
            <TrendingUp className="w-[18px] h-[18px] text-[hsl(var(--primary-foreground))]" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-[hsl(var(--foreground))]">
            Deep Agent
          </span>
        </div>

        {/* Card */}
        <div className="bg-[hsl(var(--card))] rounded-2xl border border-[hsl(var(--border))] p-8 card-elevated">
          {isLogin ? (
            <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
          ) : (
            <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-5 mt-8 text-[13px] text-[hsl(var(--muted-foreground))]">
          <span className="hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer">Privacy</span>
          <span className="w-1 h-1 rounded-full bg-[hsl(var(--border))]" />
          <span className="hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer">Terms</span>
          <span className="w-1 h-1 rounded-full bg-[hsl(var(--border))]" />
          <span className="hover:text-[hsl(var(--foreground))] transition-colors cursor-pointer">Help</span>
        </div>
      </div>
    </div>
  );
}
