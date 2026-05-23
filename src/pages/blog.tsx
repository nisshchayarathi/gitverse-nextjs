import React from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Sparkles,
  GitBranch,
  Brain,
  ArrowRight,
  CalendarDays,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

import { Button } from '@/components/ui/button'

export default function BlogPage() {
  const blogPosts = [
    {
      icon: Brain,
      title: 'How AI Improves Pull Request Reviews',
      description:
        'Discover how AI-powered insights help developers identify risks, improve code quality, and review changes faster.',
      date: 'May 2026',
    },
    {
      icon: GitBranch,
      title: 'Understanding Repository Visualization',
      description:
        'Learn how interactive repository graphs help contributors understand architecture and navigate large codebases.',
      date: 'April 2026',
    },
    {
      icon: Sparkles,
      title: 'Improving Open Source Contribution',
      description:
        'Explore practical ways GitVerse helps developers contribute confidently to modern open source projects.',
      date: 'March 2026',
    },
  ]

  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 glass mb-6">
              <BookOpen className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Insights, updates, and developer stories
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              GitVerse <span className="text-gradient">Blog</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              Explore articles about repository analysis, AI-powered
              development, contributor workflows, and modern engineering
              practices.
            </p>

          </div>
        </div>
      </section>

      {/* Blog Cards */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">

            {blogPosts.map((post) => (
              <Card
                key={post.title}
                className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
              >
                <CardHeader>

                  <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                    <post.icon className="h-6 w-6 text-primary-foreground" />
                  </div>

                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
                    <CalendarDays size={14} />
                    {post.date}
                  </div>

                  <CardTitle>
                    {post.title}
                  </CardTitle>

                  <CardDescription>
                    GitVerse Engineering
                  </CardDescription>

                </CardHeader>

                <CardContent>
                  <p className="text-muted-foreground leading-7 mb-6">
                    {post.description}
                  </p>

                  <Button
                    variant="outline"
                    className="w-full"
                  >
                    Read More
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}

          </div>

          {/* CTA Section */}
          <div className="mt-20 text-center">

            <h2 className="text-3xl font-bold mb-4">
              Stay Updated with GitVerse
            </h2>

            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Follow the latest product updates, engineering insights,
              and contributor-focused improvements from the GitVerse team.
            </p>

            <Button
              size="lg"
              className="bg-gradient-primary hover:opacity-90 transition-opacity"
              asChild
            >
              <Link href="/">
                Explore GitVerse
                <ArrowRight className="ml-2 h-5 w-5" />
              </Link>
            </Button>

          </div>

        </div>
      </section>

    </main>
  )
}