"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface LoginFormProps {
  onSwitchToRegister: () => void;
}

export function LoginForm({ onSwitchToRegister }: LoginFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const router = useRouter();
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signIn(email, password);
      if (error) {
        setError(error.message);
      } else {
        router.push("/");
        router.refresh();
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="font-serif text-[32px] font-medium leading-tight tracking-tight text-[hsl(var(--foreground))]">
          Welcome back
        </h1>
        <p className="text-[15px] text-[hsl(var(--muted-foreground))]">
          Sign in to your analytics workspace
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-[hsl(var(--destructive)/0.2)] bg-[hsl(var(--destructive)/0.1)] p-3 text-sm text-[hsl(var(--destructive))]">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Login */}
      <button
        type="button"
        className="flex h-12 w-full items-center justify-center gap-3 rounded-lg border border-transparent bg-[hsl(var(--secondary))] transition-all duration-200 hover:border-[hsl(var(--border))]"
      >
        <svg
          className="h-[18px] w-[18px]"
          viewBox="0 0 24 24"
        >
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
          />
        </svg>
        <span className="text-[15px] font-medium text-[hsl(var(--secondary-foreground))]">
          Continue with Google
        </span>
      </button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t border-[hsl(var(--border))]" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-[hsl(var(--card))] px-4 text-[13px] text-[hsl(var(--muted-foreground))]">
            or continue with email
          </span>
        </div>
      </div>

      <form
        onSubmit={handleSubmit}
        className="space-y-5"
      >
        <div className="space-y-2">
          <Label
            htmlFor="email"
            className="text-[13px] font-medium text-[hsl(var(--foreground))]"
          >
            Email address
          </Label>
          <Input
            id="email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 border-[hsl(var(--border))] bg-[hsl(var(--background))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.6)]"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label
              htmlFor="password"
              className="text-[13px] font-medium text-[hsl(var(--foreground))]"
            >
              Password
            </Label>
            <button
              type="button"
              className="text-[13px] text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--primary)/0.8)]"
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 border-[hsl(var(--border))] bg-[hsl(var(--background))] pr-11 text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.6)]"
              required
              disabled={loading}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] transition-colors hover:text-[hsl(var(--foreground))]"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="group h-11 w-full rounded-lg bg-[hsl(var(--primary))] text-[15px] font-medium text-[hsl(var(--primary-foreground))] transition-all duration-200 hover:bg-[hsl(var(--primary)/0.9)]"
        >
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-[14px] text-[hsl(var(--muted-foreground))]">
        Don&apos;t have an account?{" "}
        <button
          onClick={onSwitchToRegister}
          className="font-medium text-[hsl(var(--primary))] transition-colors hover:text-[hsl(var(--primary)/0.8)]"
        >
          Sign up
        </button>
      </p>
    </div>
  );
}
