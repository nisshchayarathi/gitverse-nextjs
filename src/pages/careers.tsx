import React from 'react'
import Link from 'next/link'
import {
  Briefcase,
  Users,
  Rocket,
  Sparkles,
  ArrowRight,
  MapPin,
} from 'lucide-react'

import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from '@/components/ui/card'

import { Button } from '@/components/ui/button'

export default function CareersPage() {
  const roles = [
    {
      title: 'Frontend Developer',
      location: 'Remote',
      description:
        'Build modern developer experiences with React, TypeScript, and interactive repository visualizations.',
    },
    {
      title: 'Backend Engineer',
      location: 'Remote',
      description:
        'Develop scalable APIs, repository analysis systems, and AI-powered backend infrastructure.',
    },
    {
      title: 'UI/UX Designer',
      location: 'Hybrid',
      description:
        'Design intuitive interfaces and improve contributor workflows for developers worldwide.',
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
              <Briefcase className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Build the future of developer tools
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Careers at <span className="text-gradient">GitVerse</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              Join a team focused on improving repository understanding,
              developer collaboration, and AI-powered engineering workflows.
            </p>

          </div>
        </div>
      </section>

      {/* Why Join Us */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-6xl mx-auto">

          <div className="text-center mb-14">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">
              Why Join GitVerse
            </h2>

            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Work on impactful developer tools and help contributors build
              better software experiences.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-20">

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>

                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Rocket className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  Fast-Growing Platform
                </CardTitle>

                <CardDescription>
                  Shape the future of developer productivity
                </CardDescription>

              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  Build innovative tools that simplify repository analysis,
                  contribution workflows, and code collaboration.
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>

                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Users className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  Collaborative Culture
                </CardTitle>

                <CardDescription>
                  Work with passionate engineers and creators
                </CardDescription>

              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  Collaborate in a modern development environment focused
                  on innovation, learning, and open communication.
                </p>
              </CardContent>
            </Card>

            <Card className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
              <CardHeader>

                <div className="w-12 h-12 rounded-lg bg-gradient-primary flex items-center justify-center mb-4">
                  <Sparkles className="h-6 w-6 text-primary-foreground" />
                </div>

                <CardTitle>
                  Modern Technologies
                </CardTitle>

                <CardDescription>
                  Build with cutting-edge tools and systems
                </CardDescription>

              </CardHeader>

              <CardContent>
                <p className="text-muted-foreground leading-7">
                  Work with AI systems, scalable infrastructure, and modern
                  frontend technologies to create powerful developer experiences.
                </p>
              </CardContent>
            </Card>

          </div>

          {/* Open Roles */}
          <div className="mb-20">

            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold mb-4">
                Open Positions
              </h2>

              <p className="text-muted-foreground">
                Explore opportunities to join the GitVerse team.
              </p>
            </div>

            <div className="grid gap-8">

              {roles.map((role) => (
                <Card
                  key={role.title}
                  className="glass border-border/50 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40"
                >
                  <CardHeader>

                    <div className="flex items-center justify-between flex-wrap gap-4">

                      <div>
                        <CardTitle>
                          {role.title}
                        </CardTitle>

                        <CardDescription className="flex items-center gap-2 mt-2">
                          <MapPin size={14} />
                          {role.location}
                        </CardDescription>
                      </div>

                      <Button>
                        Apply Now
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>

                    </div>

                  </CardHeader>

                  <CardContent>
                    <p className="text-muted-foreground leading-7">
                      {role.description}
                    </p>
                  </CardContent>

                </Card>
              ))}

            </div>

          </div>

          {/* CTA */}
          <div className="text-center">

            <h2 className="text-3xl font-bold mb-4">
              Ready to Build with Us?
            </h2>

            <p className="text-muted-foreground max-w-2xl mx-auto mb-8">
              Join GitVerse and help developers explore repositories,
              collaborate better, and contribute with confidence.
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