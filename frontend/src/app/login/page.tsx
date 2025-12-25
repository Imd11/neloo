"use client";

import { useState } from "react";
import { BarChart3 } from "lucide-react";
import { ThemeProvider } from "@/providers/ThemeProvider";
import {
  ThemeToggle,
  AuthBackground,
  LoginForm,
  RegisterForm,
} from "@/components/auth";

export default function LoginPage() {
  const [isLogin, setIsLogin] = useState(true);

  return (
    <ThemeProvider>
      <div className="auth-page min-h-screen flex items-center justify-center relative px-5 py-10 bg-[hsl(var(--auth-background))]">
        {/* Animated background */}
        <AuthBackground />

        {/* Theme toggle - fixed top right */}
        <div className="fixed top-5 right-5 z-20">
          <ThemeToggle />
        </div>

        {/* Main content */}
        <div className="w-full max-w-[400px] relative z-10">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[hsl(var(--auth-primary))] mb-4">
              <BarChart3 className="w-7 h-7 text-[hsl(var(--auth-primary-foreground))]" />
            </div>
            <h1 className="text-2xl font-semibold text-[hsl(var(--auth-foreground))] font-serif">
              Deep Agent
            </h1>
            <p className="mt-1 text-sm text-[hsl(var(--auth-muted-foreground))]">
              AI-Powered Data Analysis Platform
            </p>
          </div>

          {/* Auth card */}
          <div className="auth-card rounded-2xl p-8">
            {/* Tabs */}
            <div className="flex mb-6 p-1 rounded-lg bg-[hsl(var(--auth-muted))]">
              <button
                type="button"
                onClick={() => setIsLogin(true)}
                className={`
                  flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all
                  ${
                    isLogin
                      ? "bg-[hsl(var(--auth-card))] text-[hsl(var(--auth-foreground))] shadow-sm"
                      : "text-[hsl(var(--auth-muted-foreground))] hover:text-[hsl(var(--auth-foreground))]"
                  }
                `}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => setIsLogin(false)}
                className={`
                  flex-1 py-2 px-4 text-sm font-medium rounded-md transition-all
                  ${
                    !isLogin
                      ? "bg-[hsl(var(--auth-card))] text-[hsl(var(--auth-foreground))] shadow-sm"
                      : "text-[hsl(var(--auth-muted-foreground))] hover:text-[hsl(var(--auth-foreground))]"
                  }
                `}
              >
                Sign up
              </button>
            </div>

            {/* Forms */}
            {isLogin ? (
              <LoginForm onSwitchToRegister={() => setIsLogin(false)} />
            ) : (
              <RegisterForm onSwitchToLogin={() => setIsLogin(true)} />
            )}
          </div>

          {/* Footer */}
          <p className="mt-8 text-center text-xs text-[hsl(var(--auth-muted-foreground))]">
            By continuing, you agree to our{" "}
            <a
              href="#"
              className="text-[hsl(var(--auth-primary))] hover:underline"
            >
              Terms of Service
            </a>{" "}
            and{" "}
            <a
              href="#"
              className="text-[hsl(var(--auth-primary))] hover:underline"
            >
              Privacy Policy
            </a>
          </p>
        </div>
      </div>
    </ThemeProvider>
  );
}
