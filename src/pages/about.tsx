import React from 'react'
import Link from 'next/link'
import {
  Rocket,
  Brain,
  GitBranch,
  Users,
  ArrowRight,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

import { Button } from '@/components/ui/button'

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 glass mb-6">
              <Rocket className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Built for developers and contributors
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              About <span className="text-gradient">GitVerse</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              GitVerse helps developers understand repositories faster with
              interactive visualizations, contributor insights, and AI-powered
              pull request mentorship.
            </p>

          </div>
        </div>
      </section>

      {/* Mission Section */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Our Mission
            </h2>

            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Making open source contribution easier, smarter, and more
              accessible for developers around the world.
            </p>
          </div>

          {/* Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Brain className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  AI-Powered Insights
                </CardTitle>

                <CardDescription>
                  Understand repositories faster
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  GitVerse uses intelligent repository analysis and PR mentoring
                  to help contributors understand architecture, code quality,
                  and development workflows more efficiently.
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <GitBranch className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  Repository Visualization
                </CardTitle>

                <CardDescription>
                  Explore project structure visually
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  Interactive graphs and repository insights help developers
                  explore dependencies, branches, commits, and contribution
                  patterns with clarity.
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  Contributor Experience
                </CardTitle>

                <CardDescription>
                  Helping developers collaborate better
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  GitVerse improves onboarding for contributors by simplifying
                  repository understanding and reducing the learning curve for
                  open source collaboration.
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>
                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Rocket className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  Built for Modern Development
                </CardTitle>

                <CardDescription>
                  Optimized for fast-moving teams
                </CardDescription>
              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  From solo developers to large teams, GitVerse provides tools
                  that support faster reviews, smarter decisions, and better
                  development workflows.
                </p>
              </CardContent>
            </Card>

          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center">
            <h2 className="text-3xl font-bold mb-4">
              Start Exploring with GitVerse
            </h2>

            <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
              Discover repository insights, contribution analytics, and
              AI-powered development tools designed for modern developers.
            </p>

            <Button
              size="lg"
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
              asChild
            >
              <Link href="/">
                Get Started
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>
          </div>

        </div>
      </section>
    </main>
  )
}