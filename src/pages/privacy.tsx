import React from 'react'
import Link from 'next/link'
import { ShieldCheck, Lock, Database, Mail } from 'lucide-react'

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 glass mb-6">
              <ShieldCheck className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Your privacy matters
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Privacy <span className="text-gradient">Policy</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              GitVerse is committed to protecting your data and ensuring
              transparency in how information is collected, used, and secured.
            </p>

            <p className="text-sm text-muted-foreground mt-4">
              Last updated: January 2026
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
              <Database className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Information We Collect
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              GitVerse may collect GitHub profile data, repository metadata,
              contribution activity, email information, and platform analytics
              to improve repository visualization and AI mentorship features.
            </p>
          </div>

          {/* Card 2 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Lock className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Data Protection
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              We implement industry-standard security practices to protect user
              information and maintain platform integrity. Sensitive information
              is securely processed and protected from unauthorized access.
            </p>
          </div>

          {/* Card 3 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Third-Party Services
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              GitVerse may integrate with GitHub authentication and cloud
              infrastructure providers to deliver AI-powered repository analysis
              and contribution insights.
            </p>
          </div>

          {/* Card 4 */}
          <div className="bg-card/80 backdrop-blur-md rounded-2xl border border-border/50 p-8">
            <div className="flex items-center gap-3 mb-4">
              <Mail className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Contact
              </h2>
            </div>

            <p className="text-muted-foreground leading-7 mb-4">
              If you have any questions regarding this Privacy Policy,
              feel free to contact the GitVerse team.
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