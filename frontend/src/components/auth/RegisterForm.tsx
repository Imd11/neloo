"use client";

import { useState } from "react";
import { Eye, EyeOff, Mail, Lock, User, Loader2, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/providers/AuthProvider";

interface RegisterFormProps {
  onSwitchToLogin: () => void;
}

export function RegisterForm({ onSwitchToLogin }: RegisterFormProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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
        <h3 className="text-lg font-semibold text-[hsl(var(--auth-foreground))]">
          Check your email
        </h3>
        <p className="text-sm text-[hsl(var(--auth-muted-foreground))]">
          We&apos;ve sent a confirmation link to <strong>{email}</strong>.
          Please check your inbox and click the link to activate your account.
        </p>
        <Button
          type="button"
          variant="outline"
          onClick={onSwitchToLogin}
          className="mt-4 border-[hsl(var(--auth-border))] hover:bg-[hsl(var(--auth-accent))]"
        >
          Back to sign in
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 dark:text-red-400 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="space-y-4">
        {/* Name field */}
        <div className="space-y-2">
          <Label
            htmlFor="name"
            className="text-sm font-medium text-[hsl(var(--auth-foreground))]"
          >
            Name
          </Label>
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--auth-muted-foreground))]" />
            <Input
              id="name"
              type="text"
              placeholder="John Doe"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="pl-10 h-11 bg-[hsl(var(--auth-input))]/50 border-[hsl(var(--auth-border))] focus:border-[hsl(var(--auth-primary))] focus:ring-[hsl(var(--auth-ring))]/20"
              disabled={loading}
            />
          </div>
        </div>

        {/* Email field */}
        <div className="space-y-2">
          <Label
            htmlFor="register-email"
            className="text-sm font-medium text-[hsl(var(--auth-foreground))]"
          >
            Email
          </Label>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--auth-muted-foreground))]" />
            <Input
              id="register-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="pl-10 h-11 bg-[hsl(var(--auth-input))]/50 border-[hsl(var(--auth-border))] focus:border-[hsl(var(--auth-primary))] focus:ring-[hsl(var(--auth-ring))]/20"
              required
              disabled={loading}
            />
          </div>
        </div>

        {/* Password field */}
        <div className="space-y-2">
          <Label
            htmlFor="register-password"
            className="text-sm font-medium text-[hsl(var(--auth-foreground))]"
          >
            Password
          </Label>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[hsl(var(--auth-muted-foreground))]" />
            <Input
              id="register-password"
              type={showPassword ? "text" : "password"}
              placeholder="Create a password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="pl-10 pr-10 h-11 bg-[hsl(var(--auth-input))]/50 border-[hsl(var(--auth-border))] focus:border-[hsl(var(--auth-primary))] focus:ring-[hsl(var(--auth-ring))]/20"
              required
              disabled={loading}
              minLength={6}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[hsl(var(--auth-muted-foreground))] hover:text-[hsl(var(--auth-foreground))] transition-colors"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
          <p className="text-xs text-[hsl(var(--auth-muted-foreground))]">
            Must be at least 6 characters
          </p>
        </div>
      </div>

      {/* Submit button */}
      <Button
        type="submit"
        disabled={loading}
        className="w-full h-11 bg-[hsl(var(--auth-primary))] hover:bg-[hsl(var(--auth-primary))]/90 text-[hsl(var(--auth-primary-foreground))] font-medium transition-all"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Creating account...
          </>
        ) : (
          "Create account"
        )}
      </Button>

      {/* Switch to login */}
      <p className="text-center text-sm text-[hsl(var(--auth-muted-foreground))]">
        Already have an account?{" "}
        <button
          type="button"
          onClick={onSwitchToLogin}
          className="font-medium text-[hsl(var(--auth-primary))] hover:underline"
        >
          Sign in
        </button>
      </p>
    </form>
  );
}
