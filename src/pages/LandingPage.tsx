import React, { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  GitBranch,
  Network,
  Users,
  Brain,
  Code,
  Sparkles,
  ArrowRight,
  Check,
  Link2,
  MessageSquare,
  Loader2,
} from "lucide-react";
import { Navbar, Footer } from "@/components/layout";
import {
  Button,
  Input,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui";

export default function LandingPage() {
  const router = useRouter();
  const [repoUrl, setRepoUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [scoreAnimate, setScoreAnimate] = useState(false);
  const isAnalyzeDisabled = !repoUrl.trim() || isLoading;

  const mentorMessages = useMemo(
    () => [
      "Summarizing repository…",
      "Tech Stack: React, Node, MongoDB…",
      "Hotspots: /api routes + auth middleware…",
      "PR Mentor: risk checks & suggestions ready.",
    ],
    [],
  );
  const [mentorMessageIndex, setMentorMessageIndex] = useState(0);
  const [mentorTyped, setMentorTyped] = useState("");
  const [mentorIsErasing, setMentorIsErasing] = useState(false);
  const heatmapCells = useMemo(
    () => Array.from({ length: 72 }, (_, i) => i),
    [],
  );

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    if (media?.matches) {
      document
        .querySelectorAll<HTMLElement>("[data-reveal]")
        .forEach((el) => el.classList.add("reveal-in"));
      return;
    }

    const rafId = window.requestAnimationFrame(() => {
      // Trigger CSS transitions (e.g., score ring fill) after first paint.
      setScoreAnimate(true);
    });

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("reveal-in");
            observer.unobserve(entry.target);
          }
        }
      },
      {
        threshold: 0.15,
        rootMargin: "0px 0px -10% 0px",
      },
    );

    document
      .querySelectorAll<HTMLElement>("[data-reveal]")
      .forEach((el) => observer.observe(el));

    return () => {
      window.cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const full = mentorMessages[mentorMessageIndex] ?? "";

    const typingSpeedMs = 18;
    const erasingSpeedMs = 10;
    const pauseAfterTypeMs = 900;
    const pauseAfterEraseMs = 250;

    const timeoutId = window.setTimeout(
      () => {
        if (!mentorIsErasing) {
          if (mentorTyped.length < full.length) {
            setMentorTyped(full.slice(0, mentorTyped.length + 1));
            return;
          }
          setMentorIsErasing(true);
          return;
        }

        if (mentorTyped.length > 0) {
          setMentorTyped(full.slice(0, mentorTyped.length - 1));
          return;
        }

        setMentorIsErasing(false);
        setMentorMessageIndex((i) => (i + 1) % mentorMessages.length);
      },
      !mentorIsErasing
        ? mentorTyped.length < full.length
          ? typingSpeedMs
          : pauseAfterTypeMs
        : mentorTyped.length > 0
          ? erasingSpeedMs
          : pauseAfterEraseMs,
    );

    return () => window.clearTimeout(timeoutId);
  }, [mentorIsErasing, mentorMessageIndex, mentorMessages, mentorTyped]);

  const handleAnalyze = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!repoUrl.trim() || isLoading) return;

    // Demo-only CTA: keep it as UI (no navigation / no analysis).
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
    }, 1500);
  };

  const features = [
    {
      icon: Network,
      title: "Repository Structure Visualization",
      description:
        "Interactive tree graph of your entire repository. Zoom, filter, and explore files with rich metadata and dependencies.",
    },
    {
      icon: Brain,
      title: "PR Mentor",
      description:
        "Install the GitHub App to get automated PR feedback, risk warnings, and an overall score before you merge.",
    },
    {
      icon: GitBranch,
      title: "Branch & Commit Graph",
      description:
        "Visualize all branches, commits, and merges on an interactive timeline. See your project's evolution at a glance.",
    },
    {
      icon: Users,
      title: "Contributor Intelligence",
      description:
        "Map contributor activities, identify core maintainers, track code ownership, and analyze collaboration patterns.",
    },
    {
      icon: MessageSquare,
      title: "AI-Powered Assistant",
      description:
        "Ask questions in natural language. Get instant answers about code structure, functionality, and architecture.",
    },
    {
      icon: Code,
      title: "Coding Standards Analysis",
      description:
        "Automated analysis of naming conventions, code style, and best practices across your entire codebase.",
    },
    {
      icon: Sparkles,
      title: "Smart Insights",
      description:
        "Production readiness assessment, architecture pattern recognition, and intelligent recommendations.",
    },
  ];

  const howItWorks = [
    {
      icon: Link2,
      step: "01",
      title: "Install GitVerse GitHub App",
      description:
        "Connect GitVerse to your GitHub org/user. No tokens to paste — installs in seconds.",
    },
    {
      icon: Network,
      step: "02",
      title: "Visualize Your Repo",
      description:
        "Explore structure, dependencies, and activity hotspots with fast, interactive graphs.",
    },
    {
      icon: MessageSquare,
      step: "03",
      title: "Ask the AI Mentor",
      description:
        "Get architecture summaries, file explanations, and change impact in plain language.",
    },
    {
      icon: Sparkles,
      step: "04",
      title: "PR Mentor in Your PRs",
      description:
        "Automatically score PR quality and surface risks before merging — right where you work.",
    },
  ];

  const pricingPlans = [
    {
      name: "Free",
      price: "$0",
      period: "forever",
      description: "Perfect for exploring public repositories",
      features: [
        "5 repository analyses per month",
        "Basic visualization tools",
        "Commit history graph",
        "Community support",
      ],
      popular: false,
    },
    {
      name: "Pro",
      price: "$19",
      period: "per month",
      description: "For developers who need deeper insights",
      features: [
        "Unlimited repository analyses",
        "Full visualization suite",
        "AI-powered assistant",
        "Contributor intelligence",
        "Code standards analysis",
        "Priority support",
      ],
      popular: true,
    },
    {
      name: "Team",
      price: "$49",
      period: "per month",
      description: "Collaboration features for teams",
      features: [
        "Everything in Pro",
        "Up to 10 team members",
        "Private repository support",
        "Team dashboards",
        "Export & reporting",
        "Dedicated support",
      ],
      popular: false,
    },
  ];

  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-radial pointer-events-none" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "1.5s" }}
        />

        {/* Graph Decoration */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none opacity-20">
          <svg
            className="absolute top-20 right-10 w-72 h-72 repo-graph"
            viewBox="0 0 200 200"
          >
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
        </div>

        {/* Content */}
        <div className="container mx-auto px-4 relative z-10">
          <div className="max-w-4xl mx-auto text-center pt-8 md:pt-12">
            <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6 animate-fade-in-up">
              Contribution made easy with
              <span className="text-gradient"> Repo Visualization</span> and
              <span className="text-gradient"> PR Mentor</span>
            </h1>

            <p
              className="text-lg md:text-xl text-muted-foreground mb-10 max-w-2xl mx-auto animate-fade-in-up"
              style={{ animationDelay: "0.2s" }}
            >
              Explore repositories with rich visualizations and get
              mentorship-style PR feedback. Understand changes faster, spot
              risks earlier, and contribute with confidence.
            </p>

            {/* Repository Input */}
            <form
              onSubmit={handleAnalyze}
              className="max-w-2xl mx-auto animate-fade-in-up"
              style={{ animationDelay: "0.3s" }}
            >
              <div
                className={`cta-shell ${isLoading ? "cta-shell--active" : ""}`}
              >
                <div className="cta-shell__inner flex flex-col sm:flex-row gap-3 p-2 rounded-xl glass">
                  <Input
                    type="url"
                    placeholder="https://github.com/username/repository"
                    value={repoUrl}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      setRepoUrl(e.target.value)
                    }
                    className="flex-1 h-12 bg-background/50 border-0 text-base placeholder:text-muted-foreground/60 focus-visible:ring-primary"
                  />
                  <Button
                    type="submit"
                    size="lg"
                    disabled={isAnalyzeDisabled}
                    className="group h-12 px-6 bg-gradient-primary font-semibold transition-all hover:opacity-90 hover:scale-[1.01] active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:scale-100"
                  >
                    {isLoading ? (
                      <>
                        <Loader2 className="h-5 w-5 animate-spin" />
                        <span className="ml-2">Preview…</span>
                      </>
                    ) : (
                      <>
                        Analyze Repository
                        <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
                      </>
                    )}
                  </Button>
                </div>
                <div className="cta-shell__scan" aria-hidden="true" />
              </div>
              <p className="text-sm text-muted-foreground mt-3">
                Demo UI only — real analysis happens after install/sign up.
              </p>
            </form>

            {/* Demos */}
            <div
              className="mt-10 grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto animate-fade-in-up"
              style={{ animationDelay: "0.35s" }}
            >
              <Card className="glass glass-hover">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <MessageSquare className="h-5 w-5 text-primary" /> AI Mentor
                  </CardTitle>
                  <CardDescription>
                    See how GitVerse explains code changes in real time.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="rounded-xl border border-border/60 bg-background/50 p-4">
                    <div className="text-xs text-muted-foreground mb-2">
                      GitVerse Mentor
                    </div>
                    <div className="font-mono text-sm leading-relaxed min-h-[3.5rem]">
                      {mentorTyped}
                      <span className="typing-cursor" aria-hidden="true">
                        |
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card className="glass glass-hover">
                <CardHeader>
                  <CardTitle className="font-heading flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-accent" /> PR Quality
                    Score
                  </CardTitle>
                  <CardDescription>
                    Quick signal before you merge.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div
                      className={`progress-ring ${scoreAnimate ? "progress-ring--animate" : ""}`}
                      style={{ ["--progress"]: "0.85" } as React.CSSProperties}
                      aria-label="PR Quality Score: 85%"
                    >
                      <svg viewBox="0 0 120 120" className="h-16 w-16">
                        <circle
                          cx="60"
                          cy="60"
                          r="46"
                          className="progress-ring__track"
                        />
                        <circle
                          cx="60"
                          cy="60"
                          r="46"
                          className="progress-ring__value"
                        />
                      </svg>
                      <div className="progress-ring__label">
                        <div className="progress-ring__labelInner">
                          <div className="text-lg font-heading font-bold leading-none">
                            85
                          </div>
                          <div className="text-[10px] text-muted-foreground leading-none mt-1">
                            score
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="text-sm text-muted-foreground">
                      Flags risky diffs, missing tests, and breaking changes—
                      directly in the PR.
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Stats */}
            <div
              className="grid grid-cols-3 gap-8 mt-16 animate-fade-in-up"
              style={{ animationDelay: "0.4s" }}
            >
              {[
                { value: "10K+", label: "Repositories Analyzed" },
                { value: "50M+", label: "Commits Processed" },
                { value: "99.9%", label: "Uptime" },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl md:text-3xl font-heading font-bold text-gradient">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-24 relative">
        <div className="absolute inset-0 bg-gradient-radial opacity-50 pointer-events-none" />

        <div className="heatmap-bg" aria-hidden="true">
          <div className="heatmap-bg__grid">
            {heatmapCells.map((i) => {
              const alpha =
                i % 13 === 0
                  ? 0.48
                  : i % 7 === 0
                    ? 0.36
                    : i % 4 === 0
                      ? 0.24
                      : 0.14;
              const hue = i % 9 === 0 ? "var(--primary)" : "var(--accent)";
              return (
                <span
                  key={i}
                  className="heatmap-bg__cell"
                  style={
                    {
                      ["--cell-alpha"]: String(alpha),
                      ["--cell-hsl"]: hue,
                      animationDelay: `${(i % 12) * 90}ms`,
                    } as React.CSSProperties
                  }
                />
              );
            })}
          </div>
        </div>

        <div className="container mx-auto px-4 relative z-10">
          <div
            className="text-center max-w-3xl mx-auto mb-16 reveal"
            data-reveal
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Everything You Need to
              <span className="text-gradient"> Understand Your Code</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Powerful features designed to give you complete visibility into
              your repositories
            </p>
          </div>

          <div className="marquee marquee--pause-on-hover reveal" data-reveal>
            <div
              className="marquee__track gap-6 py-2"
              style={{ ["--marquee-duration"]: "34s" } as React.CSSProperties}
            >
              {[...features, ...features].map((feature, index) => (
                <Card
                  key={`${feature.title}-${index}`}
                  className="glass feature-card group shrink-0 w-[320px] md:w-[360px]"
                >
                  <CardHeader>
                    <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                      <feature.icon className="h-6 w-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="font-heading">
                      {feature.title}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-muted-foreground text-base">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Edge fades */}
            <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-background to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-background to-transparent" />
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4">
          <div
            className="text-center max-w-3xl mx-auto mb-16 reveal"
            data-reveal
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              How <span className="text-gradient">GitVerse</span> Works
            </h2>
            <p className="text-lg text-muted-foreground">
              From repository URL to actionable insights in seconds
            </p>
          </div>

          <div
            className="relative max-w-5xl mx-auto reveal how-steps"
            data-reveal
          >
            <div className="hidden md:block absolute left-6 top-0 bottom-0 w-px how-steps__line" />

            <div className="space-y-6">
              {howItWorks.map((step, index) => (
                <div
                  key={step.step}
                  className="relative md:pl-16 how-step"
                  style={
                    {
                      ["--step-delay"]: `${index * 90}ms`,
                    } as React.CSSProperties
                  }
                >
                  <div className="hidden md:flex absolute left-0 top-4 w-12 h-12 rounded-2xl bg-gradient-primary items-center justify-center shadow-sm how-step__icon">
                    <step.icon className="h-6 w-6 text-primary-foreground" />
                  </div>

                  <Card className="glass feature-card">
                    <CardHeader>
                      <div className="flex items-center justify-between gap-4">
                        <CardTitle className="font-heading text-xl">
                          {step.title}
                        </CardTitle>
                        <span className="text-xs font-medium text-muted-foreground bg-muted/60 border border-border/60 rounded-full px-3 py-1">
                          Step {step.step}
                        </span>
                      </div>
                      <CardDescription className="text-base">
                        {step.description}
                      </CardDescription>
                    </CardHeader>
                  </Card>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-24">
        <div className="container mx-auto px-4">
          <div
            className="text-center max-w-3xl mx-auto mb-16 reveal"
            data-reveal
          >
            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Simple, Transparent <span className="text-gradient">Pricing</span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Start free and scale as you grow. No hidden fees.
            </p>
          </div>

          <div
            className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl mx-auto reveal"
            data-reveal
          >
            {pricingPlans.map((plan) => (
              <Card
                key={plan.name}
                className={`relative glass transition-all duration-300 ${plan.popular ? "border-primary glow-primary" : "border-border/50 hover:border-primary hover:shadow-lg hover:shadow-primary/10 hover:-translate-y-1"}`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 px-4 py-1 bg-gradient-primary rounded-full text-sm font-medium text-primary-foreground">
                    Most Popular
                  </div>
                )}
                <CardHeader className="text-center pb-4">
                  <CardTitle className="font-heading text-xl">
                    {plan.name}
                  </CardTitle>
                  <div className="mt-4">
                    <span className="text-4xl font-heading font-bold">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">
                      /{plan.period}
                    </span>
                  </div>
                  <CardDescription className="mt-2">
                    {plan.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-3 mb-8">
                    {plan.features.map((feature) => (
                      <li key={feature} className="flex items-start gap-3">
                        <Check className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{feature}</span>
                      </li>
                    ))}
                  </ul>
                  <Button
                    className={`w-full ${plan.popular ? "bg-gradient-primary hover:opacity-90" : ""}`}
                    variant={plan.popular ? "default" : "outline"}
                    onClick={() => router.push("/signup")}
                  >
                    {plan.name === "Free"
                      ? "Get Started"
                      : plan.name === "Team"
                        ? "Contact Sales"
                        : "Start Free Trial"}
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-primary opacity-10" />
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-primary/20 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-3xl" />
        <div className="cta-ambient" aria-hidden="true" />

        <div className="container mx-auto px-4 relative z-10">
          <div
            className="max-w-3xl mx-auto text-center glass rounded-2xl p-12 reveal cta-card"
            data-reveal
          >
            <div className="cta-card__shine" aria-hidden="true" />

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-primary mb-6 cta-card__icon">
              <GitBranch className="h-8 w-8 text-primary-foreground" />
            </div>

            <h2 className="text-3xl md:text-4xl font-heading font-bold mb-4">
              Ready to Transform Your
              <span className="text-gradient"> Repository Experience?</span>
            </h2>

            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Join thousands of developers who are already using GitVerse to
              understand and navigate their codebases.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Button
                size="lg"
                className="group bg-gradient-primary hover:opacity-90 font-semibold transition-transform hover:scale-[1.01] active:scale-[0.99]"
                onClick={() => router.push("/signup")}
              >
                Get Started for Free
                <ArrowRight className="ml-2 h-5 w-5 transition-transform group-hover:translate-x-1" />
              </Button>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
