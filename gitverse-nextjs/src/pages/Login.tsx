"use client";

export const dynamic = "force-dynamic";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Mail, Lock, GitBranch, Loader2 } from "lucide-react";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardContent,
  toast,
} from "@/components/ui";
import { useAuth } from "@/contexts/AuthContext";
import { signIn } from "next-auth/react";

export default function Login() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

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
        <circle
          cx="100"
          cy="32"
          r="8"
          className="repo-graph__node fill-primary"
          style={{ animationDelay: "0ms" }}
        />
        <circle
          cx="60"
          cy="96"
          r="8"
          className="repo-graph__node fill-accent"
          style={{ animationDelay: "220ms" }}
        />
        <circle
          cx="140"
          cy="96"
          r="8"
          className="repo-graph__node fill-primary"
          style={{ animationDelay: "300ms" }}
        />
        <circle
          cx="100"
          cy="162"
          r="8"
          className="repo-graph__node fill-accent"
          style={{ animationDelay: "520ms" }}
        />
        <circle
          cx="100"
          cy="192"
          r="5"
          className="repo-graph__node fill-primary"
          style={{ animationDelay: "720ms" }}
        />
      </g>
    </svg>
  );

  const from = searchParams?.get("from") || "/dashboard";

  useEffect(() => {
    const error = searchParams?.get("error");
    if (!error) return;

    const messageByCode: Record<string, string> = {
      OAuthSignin:
        "Google sign-in could not be started. This is usually caused by a temporary cookie/CSRF issue or a local OAuth configuration problem. Try again, or clear site cookies for localhost.",
      OAuthAccountNotLinked:
        "This email is already registered. Please sign in using the same method you used originally.",
      OAuthCallback:
        "Google sign-in failed during the callback. This is usually a cookie/state issue, a DB error, or token verification failure. Try again; if it keeps happening, clear cookies for localhost and ensure NEXTAUTH_SECRET is a real 32-byte secret (not a placeholder), then restart the dev server.",
      Callback: "Sign-in failed. Please try again.",
      AccessDenied: "Access denied. Please try again.",
      Configuration: "Authentication is misconfigured. Please contact support.",
      Verification: "Verification failed. Please try again.",
      Default: "Authentication failed. Please try again.",
    };

    toast({
      title: "Authentication Failed",
      description: messageByCode[error] || messageByCode.Default,
      variant: "destructive",
    });
  }, [searchParams]);

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    try {
      const callbackUrl = from.startsWith("/") ? from : "/dashboard";
      const result = await signIn("google", {
        callbackUrl,
        redirect: false,
      });

      // NextAuth may return a URL that is actually the error page (e.g. /login?error=OAuthSignin).
      // Treat that as an error and avoid navigating away.
      const errorFromUrl = (() => {
        try {
          if (!result?.url) return null;
          const asUrl = new URL(result.url, window.location.origin);
          return asUrl.searchParams.get("error");
        } catch {
          return null;
        }
      })();

      if (result?.error || errorFromUrl) {
        const code = result?.error || errorFromUrl || "Default";
        toast({
          title: "Authentication Failed",
          description:
            code === "OAuthSignin"
              ? "Google sign-in could not be started. Try again, or clear site cookies for localhost."
              : code,
          variant: "destructive",
        });
      } else if (result?.url) {
        router.push(result.url);
      }
    } catch (error: any) {
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to sign in with Google",
        variant: "destructive",
      });
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      toast({
        title: "Error",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    if (!email.includes("@")) {
      toast({
        title: "Error",
        description: "Please enter a valid email address",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password);
      toast({
        title: "Success!",
        description: "Welcome back to GitVerse",
      });
      router.push(from);
    } catch (error: any) {
      toast({
        title: "Login Failed",
        description: error.message || "Invalid email or password",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
      <div className="absolute top-20 left-20 w-96 h-96 bg-primary/10 rounded-full blur-3xl animate-float" />
      <div
        className="absolute bottom-20 right-20 w-96 h-96 bg-accent/10 rounded-full blur-3xl animate-float"
        style={{ animationDelay: "1.5s" }}
      />

      {/* Animated repo graph (git tree) decoration */}
      <div className="absolute inset-0 pointer-events-none opacity-25">
        <RepoGraph
          className="absolute left-[-140px] top-1/2 -translate-y-1/2 w-[28rem] h-[28rem] rotate-[-8deg]"
          style={{ filter: "blur(0.25px)" }}
        />
      </div>

      {/* Login Card */}
      <Card className="w-full max-w-md glass glow-primary relative z-10 animate-fade-in-up overflow-hidden">
        <CardHeader className="text-center pb-4">
          <Link
            href="/"
            className="inline-flex items-center justify-center space-x-2 mb-4 group"
          >
            <div className="p-2 bg-gradient-primary rounded-lg group-hover:scale-110 transition-transform">
              <GitBranch className="text-primary-foreground" size={24} />
            </div>
            <span className="text-2xl font-heading font-bold text-gradient">
              GitVerse
            </span>
          </Link>
          <h1 className="text-2xl font-heading font-bold mb-2">Welcome Back</h1>
          <p className="text-muted-foreground">Sign in to your account</p>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                  required
                />
              </div>
            </div>

            <div
              className="space-y-2 animate-fade-in-up"
              style={{ animationDelay: "120ms" }}
            >
              <label htmlFor="password" className="text-sm font-medium">
                Password
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
                  required
                />
              </div>
            </div>

            <div
              className="flex items-center justify-between text-sm animate-fade-in-up"
              style={{ animationDelay: "170ms" }}
            >
              <label className="flex items-center cursor-pointer">
                <input type="checkbox" className="mr-2 rounded border-input" />
                <span className="text-muted-foreground">Remember me</span>
              </label>
              <Link
                href="/forgot-password"
                className="text-primary hover:text-primary/80 transition-colors"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              className="w-full bg-gradient-primary hover:opacity-90 transition-opacity font-semibold"
              disabled={isLoading}
            >
              {isLoading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                "Sign In"
              )}
            </Button>
          </form>

          <div className="mt-6 mb-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-muted-foreground/20" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">
                  Or continue with
                </span>
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={handleGoogleSignIn}
            disabled={isGoogleLoading || isLoading}
          >
            {isGoogleLoading ? (
              <Loader2 className="h-5 w-5 animate-spin mr-2" />
            ) : (
              <svg className="h-5 w-5 mr-2" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
            )}
            Sign in with Google
          </Button>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            Don&apos;t have an account?{" "}
            <Link
              href="/signup"
              className="text-primary hover:text-primary/80 font-medium transition-colors"
            >
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
