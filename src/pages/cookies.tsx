import React from 'react'
import Link from 'next/link'
import {
  Cookie,
  BarChart3,
  Settings,
  SlidersHorizontal,
} from 'lucide-react'

export default function CookiesPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 glass mb-6">
              <Cookie className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Cookie usage and preferences
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Cookie <span className="text-gradient">Policy</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              GitVerse uses cookies and related technologies to improve
              platform functionality, enhance user experience, and analyze
              website performance.
            </p>

            <p className="text-sm text-muted-foreground mt-4">
              Last updated: May 2026
            </p>

          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto grid gap-8 animate-fade-in-up">

          {/* Card 1 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <Cookie className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Essential Cookies
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              Essential cookies help maintain secure login sessions,
              authentication workflows, and core platform functionality
              required for GitVerse services to operate properly.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <BarChart3 className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Analytics and Performance
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              Analytics cookies help GitVerse understand platform usage,
              monitor performance, identify improvements, and enhance
              overall user experience.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <Settings className="text-primary" />
              <h2 className="text-2xl font-semibold">
                User Preferences
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              Preference cookies may store selected themes, interface
              settings, and personalization options to provide a more
              consistent browsing experience.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <SlidersHorizontal className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Managing Cookies
              </h2>
            </div>

            <p className="text-muted-foreground leading-7 mb-4">
              Users can control or disable cookies through browser settings.
              However, some platform features may not function correctly if
              essential cookies are restricted.
            </p>

            <Link
              href="/"
              className="text-primary hover:underline"
            >
              Return to Homepage
            </Link>
          </div>

        </div>
      </section>
    </main>
  )
}