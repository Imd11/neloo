"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, ArrowRight, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const { signUp } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await signUp(email, password);
      if (error) {
        setError(error.message);
      } else {
        setSuccess(true);
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="mx-auto w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
          <CheckCircle className="h-6 w-6 text-green-500" />
        </div>
        <h3 className="text-lg font-semibold text-[hsl(var(--foreground))]">
          Check your email
        </h3>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Please check your inbox and click the link to activate your account.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onSwitchToLogin}
          className="mt-4 border-[hsl(var(--border))] hover:bg-[hsl(var(--accent))]"
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-2">
        <h1 className="font-serif text-[32px] font-medium tracking-tight text-[hsl(var(--foreground))] leading-tight">
          Create account
        </h1>
        <p className="text-[hsl(var(--muted-foreground))] text-[15px]">
          Start your analytics journey today
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-[hsl(var(--destructive)/0.1)] border border-[hsl(var(--destructive)/0.2)] text-[hsl(var(--destructive))] text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Google Sign Up */}
      <button
        type="button"
        className="w-full h-12 flex items-center justify-center gap-3 rounded-lg bg-[hsl(var(--secondary))] border border-transparent hover:border-[hsl(var(--border))] transition-all duration-200"
      >
        <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24">
          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
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

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="name" className="text-[13px] font-medium text-[hsl(var(--foreground))]">
            Full name
          </Label>
          <Input
            id="name"
            type="text"
            placeholder="John Doe"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-11 bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.6)]"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-email" className="text-[13px] font-medium text-[hsl(var(--foreground))]">
            Email address
          </Label>
          <Input
            id="register-email"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-11 bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.6)]"
            required
            disabled={loading}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="register-password" className="text-[13px] font-medium text-[hsl(var(--foreground))]">
            Password
          </Label>
          <div className="relative">
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-11 pr-11 bg-[hsl(var(--background))] border-[hsl(var(--border))] text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground)/0.6)]"
              required
              disabled={loading}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))] transition-colors"
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <p className="text-[13px] text-[hsl(var(--muted-foreground))] leading-relaxed">
          By signing up, you agree to our{" "}
          <span className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.8)] cursor-pointer transition-colors">Terms of Service</span>
          {" "}and{" "}
          <span className="text-[hsl(var(--primary))] hover:text-[hsl(var(--primary)/0.8)] cursor-pointer transition-colors">Privacy Policy</span>
        </p>

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:bg-[hsl(var(--primary)/0.9)] font-medium text-[15px] rounded-lg transition-all duration-200 group"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Creating account...
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </Button>
      </form>

      <p className="text-center text-[14px] text-[hsl(var(--muted-foreground))]">
        Already have an account?{" "}
        <button
          onClick={onSwitchToLogin}
          className="text-[hsl(var(--primary))] font-medium hover:text-[hsl(var(--primary)/0.8)] transition-colors"
        >
          Sign in
        </button>
      </p>
    </div>
  );
}
