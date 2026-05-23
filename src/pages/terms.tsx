import React from 'react'
import Link from 'next/link'
import {
  FileText,
  ShieldCheck,
  UserCheck,
  Server,
} from 'lucide-react'

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 glass mb-6">
              <FileText className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Terms and conditions
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Terms of <span className="text-gradient">Service</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              These Terms of Service govern your access to and use of GitVerse,
              including repository analysis, AI-powered mentoring, and platform
              services.
            </p>

            <p className="text-sm text-muted-foreground mt-4">
              Last updated: May 2026
            </p>

          </div>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-6 py-20">
        <div className="max-w-5xl mx-auto grid gap-8">

          {/* Card 1 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <UserCheck className="text-primary" />
              <h2 className="text-2xl font-semibold">
                User Responsibilities
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              Users are responsible for maintaining account security,
              protecting credentials, and ensuring that platform usage
              complies with applicable laws and GitHub policies.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Acceptable Usage
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              GitVerse must not be used for malicious activity, unauthorized
              access attempts, abusive automation, or any actions that may
              disrupt platform stability or compromise security.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Server className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Platform Availability
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              GitVerse continuously improves platform reliability, though
              temporary interruptions, maintenance periods, or service updates
              may occasionally affect availability.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <FileText className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Contact and Support
              </h2>
            </div>

            <p className="text-muted-foreground leading-7 mb-4">
              For questions regarding these Terms of Service, users may contact
              the GitVerse team for clarification and support.
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