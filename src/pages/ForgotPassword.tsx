"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, GitBranch, Loader2, CheckCircle2 } from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  toast,
  Skeleton,
} from "@/components/ui";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      <path
        d="M100 32 C100 58 76 72 60 96"
        className="repo-graph__line stroke-primary"
        style={{ animationDelay: "0ms" }}
      />
      <path
        d="M100 32 C100 58 124 72 140 96"
        className="repo-graph__line stroke-primary"
        style={{ animationDelay: "140ms" }}
      />
      <path
        d="M60 96 C74 118 86 132 100 162"
        className="repo-graph__line stroke-accent"
        style={{ animationDelay: "320ms" }}
      />
      <path
        d="M140 96 C126 118 114 132 100 162"
        className="repo-graph__line stroke-accent"
        style={{ animationDelay: "460ms" }}
      />
      <path
        d="M100 162 C100 176 100 186 100 192"
        className="repo-graph__line stroke-primary"
        style={{ animationDelay: "620ms" }}
      />
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

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(true);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsPageLoading(false), 400);
    return () => clearTimeout(timer);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const trimmed = email.trim();

    if (!trimmed) {
      toast({ title: "Error", description: "Please enter your email address", variant: "destructive" });
      return;
    }

    if (!EMAIL_REGEX.test(trimmed)) {
      toast({ title: "Error", description: "Please enter a valid email address", variant: "destructive" });
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? "Something went wrong. Please try again.");
      }

      // Always show the generic success state — never reveal whether the email exists.
      setSubmitted(true);
    } catch (error: unknown) {
      toast({
        title: "Request Failed",
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
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float"
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
              <Skeleton width="65%" height={28} className="mx-auto" />
              <Skeleton width="75%" height={18} className="mx-auto" />
            </div>
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton width={50} height={16} />
                <Skeleton width="100%" height={44} />
              </div>
              <Skeleton width="100%" height={44} />
              <div className="text-center">
                <Skeleton width={130} height={16} className="mx-auto" />
              </div>
            </div>
          </CardContent>
        ) : submitted ? (
          /* ── Success state ── */
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center text-center space-y-4 animate-fade-in-up">
              <div className="p-3 rounded-full bg-accent/10">
                <CheckCircle2 className="h-10 w-10 text-accent" />
              </div>
              <h2 className="text-xl font-heading font-bold">Check your inbox</h2>
              <p className="text-muted-foreground text-sm leading-relaxed max-w-xs">
                If an account with that email exists, we&apos;ve sent a password reset link.
                The link expires in <strong className="text-foreground">60 minutes</strong>.
              </p>
              <p className="text-xs text-muted-foreground">
                Didn&apos;t receive it? Check your spam folder or{" "}
                <button
                  type="button"
                  className="text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
                  onClick={() => setSubmitted(false)}
                >
                  try again
                </button>
                .
              </p>
              <Link
                href="/login"
                className="mt-2 text-sm text-primary hover:text-primary/80 font-medium transition-colors"
              >
                Back to sign in
              </Link>
            </div>
          </CardContent>
        ) : (
          /* ── Request form ── */
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
              <h1 className="text-2xl font-heading font-bold mb-2">Forgot password?</h1>
              <p className="text-muted-foreground text-sm">
                Enter your email and we&apos;ll send you a reset link.
              </p>
            </CardHeader>

            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div
                  className="space-y-2 animate-fade-in-up"
                  style={{ animationDelay: "70ms" }}
                >
                  <label htmlFor="email" className="text-sm font-medium">
                    Email
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-10"
                      autoComplete="email"
                      required
                      aria-label="Email address"
                    />
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full bg-gradient-primary hover:opacity-90 transition-opacity font-semibold animate-fade-in-up"
                  style={{ animationDelay: "120ms" }}
                  disabled={isLoading}
                  aria-label="Send reset link"
                >
                  {isLoading ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    "Send reset link"
                  )}
                </Button>
              </form>

              <div
                className="mt-6 text-center text-sm text-muted-foreground animate-fade-in-up"
                style={{ animationDelay: "170ms" }}
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
