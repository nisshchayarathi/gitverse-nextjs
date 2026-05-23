"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { Lock, GitBranch, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  toast,
  Skeleton,
} from "@/components/ui";

const MIN_PASSWORD_LENGTH = 8;

/** Animated git-graph SVG decoration — same as Login/Signup. */
const RepoGraph = ({
  className,
  style,
}: {
  className: string;
  style?: React.CSSProperties;
}) => (
  <svg className={className} style={style} viewBox="0 0 200 200">
    <g fill="none" strokeLinecap="round" strokeLinejoin="round">
      <path d="M100 32 C100 58 76 72 60 96" className="repo-graph__line stroke-primary" style={{ animationDelay: "0ms" }} />
      <path d="M100 32 C100 58 124 72 140 96" className="repo-graph__line stroke-primary" style={{ animationDelay: "140ms" }} />
      <path d="M60 96 C74 118 86 132 100 162" className="repo-graph__line stroke-accent" style={{ animationDelay: "320ms" }} />
      <path d="M140 96 C126 118 114 132 100 162" className="repo-graph__line stroke-accent" style={{ animationDelay: "460ms" }} />
      <path d="M100 162 C100 176 100 186 100 192" className="repo-graph__line stroke-primary" style={{ animationDelay: "620ms" }} />
    </g>
    <g>
      <circle cx="100" cy="32" r="8" className="repo-graph__node fill-primary" style={{ animationDelay: "0ms" }} />
      <circle cx="60" cy="96" r="8" className="repo-graph__node fill-accent" style={{ animationDelay: "220ms" }} />
      <circle cx="140" cy="96" r="8" className="repo-graph__node fill-primary" style={{ animationDelay: "300ms" }} />
      <circle cx="100" cy="162" r="8" className="repo-graph__node fill-accent" style={{ animationDelay: "520ms" }} />
      <circle cx="100" cy="192" r="5" className="repo-graph__node fill-primary" style={{ animationDelay: "720ms" }} />
    </g>
  </svg>
);

type PageState = "loading" | "form" | "success" | "invalid";

export default function ResetPassword() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [pageState, setPageState] = useState<PageState>("loading");
  const [apiError, setApiError] = useState<string | null>(null);

  const token = searchParams?.get("token") ?? "";

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsPageLoading(false);
      // If no token in URL, show invalid state immediately.
      setPageState(token.trim() ? "form" : "invalid");
    }, 400);
    return () => clearTimeout(timer);
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setApiError(null);

    if (!password) {
      toast({ title: "Error", description: "Please enter a new password", variant: "destructive" });
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      toast({
        title: "Error",
        description: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
        variant: "destructive",
      });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Error", description: "Passwords do not match", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: token.trim(), password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const msg = data?.error ?? "Something went wrong. Please try again.";
        // If the token is invalid/expired, show the dedicated invalid state.
        if (res.status === 400) {
          setApiError(msg);
          setPageState("invalid");
          return;
        }
        throw new Error(msg);
      }

      setPageState("success");
      // Redirect to login after a short delay.
      setTimeout(() => router.push("/login"), 3000);
    } catch (error: unknown) {
      toast({
        title: "Reset Failed",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
      <div className="absolute top-20 right-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-20 left-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Animated git-graph decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <RepoGraph
          className="absolute left-[-140px] top-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rotate-[-8deg]"
          style={{ filter: "blur(0.25px)" }}
        />
      </div>

      <Card className="w-full max-w-md glass glow-primary relative z-10 animate-fade-in-up overflow-hidden">
        {isPageLoading ? (
          <CardContent className="pt-6 space-y-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <Skeleton variant="circular" width={48} height={48} />
              </div>
              <Skeleton width="60%" height={28} className="mx-auto" />
              <Skeleton width="50%" height={18} className="mx-auto" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton width={100} height={16} />
                <Skeleton width="100%" height={44} />
              </div>
              <div className="space-y-2">
                <Skeleton width={130} height={16} />
                <Skeleton width="100%" height={44} />
              </div>
              <Skeleton width="100%" height={44} />
            </div>
          </CardContent>
        ) : pageState === "success" ? (
          /* ── Success state ── */
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-full bg-accent/10">
                <CheckCircle2 className="h-10 w-10 text-accent" />
              </div>
              <h2 className="text-xl font-heading font-bold">Password updated</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                Your password has been changed successfully. Redirecting you to sign in…
              </p>
              <Link
                href="/login"
                className="mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Sign in now
              </Link>
            </div>
          </CardContent>
        ) : pageState === "invalid" ? (
          /* ── Invalid / expired token state ── */
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertCircle className="h-10 w-10 text-destructive" />
              </div>
              <h2 className="text-xl font-heading font-bold">Link invalid or expired</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                {apiError ?? "This password reset link is invalid or has already been used."}
                {" "}Reset links expire after 60 minutes.
              </p>
              <Link
                href="/forgot-password"
                className="mt-2 inline-flex items-center justify-center rounded-md bg-gradient-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                Request a new link
              </Link>
            </div>
          </CardContent>
        ) : (
          /* ── Reset form ── */
          <>
            <CardHeader className="text-center pb-4">
              <Link
                href="/"
                className="inline-flex items-center justify-center space-x-2 mb-4 group"
              >
                <div className="p-2 bg-gradient-primary rounded-lg group-hover:scale-110 transition-transform">
                  <GitBranch className="text-primary-foreground" size={24} />
                </div>
                <span className="text-2xl font-heading font-bold text-gradient">GitVerse</span>
              </Link>
              <h1 className="text-2xl font-heading font-bold mb-2">Set new password</h1>
              <p className="text-muted-foreground text-sm">
                Choose a strong password for your account.
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div
                  className="space-y-2 animate-fade-in-up"
                  style={{ animationDelay: "70ms" }}
                >
                  <label htmlFor="password" className="text-sm font-medium">
                    New password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                      required
                      aria-label="New password"
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Must be at least {MIN_PASSWORD_LENGTH} characters
                  </p>
                </div>

                <div
                  className="space-y-2 animate-fade-in-up"
                  style={{ animationDelay: "120ms" }}
                >
                  <label htmlFor="confirmPassword" className="text-sm font-medium">
                    Confirm new password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="confirmPassword"
                      type="password"
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="pl-10"
                      autoComplete="new-password"
                      required
                      aria-label="Confirm new password"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity font-semibold animate-fade-in-up"
                  style={{ animationDelay: "170ms" }}
                  disabled={isLoading}
                  aria-label="Update password"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Update password"
                  )}
                </Button>
              </form>

              <div
                className="mt-6 text-center text-sm text-muted-foreground animate-fade-in-up"
                style={{ animationDelay: "220ms" }}
              >
                Remember your password?{" "}
                <Link
                  href="/login"
                  className="text-primary hover:text-primary/80 font-medium transition-colors"
                >
                  Sign in
                </Link>
              </div>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
