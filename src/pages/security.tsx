import React from 'react'
import Link from 'next/link'
import {
  Shield,
  Lock,
  ServerCrash,
  Bug,
} from 'lucide-react'
import { Navbar, Footer } from "@/components/layout";

export default function SecurityPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <main className="min-h-screen bg-background text-foreground">

      {/* Hero Section */}
      <section className="relative overflow-hidden border-b border-border/50">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-background to-background" />

        <div className="container mx-auto px-6 py-24 relative z-10">
          <div className="max-w-4xl mx-auto text-center">

            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 glass mb-6">
              <Shield className="text-primary" size={18} />
              <span className="text-sm text-muted-foreground">
                Platform protection and reliability
              </span>
            </div>

            <h1 className="text-5xl md:text-6xl font-bold leading-tight mb-6">
              Platform <span className="text-gradient">Security</span>
            </h1>

            <p className="text-lg text-muted-foreground leading-8 max-w-2xl mx-auto">
              GitVerse follows modern security practices to protect user data,
              repository insights, authentication systems, and platform
              infrastructure.
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
              <Lock className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Data Protection
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              GitVerse uses industry-standard practices to protect sensitive
              user information, repository insights, and authentication data
              from unauthorized access or misuse.
            </p>
          </div>

          {/* Card 2 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <Shield className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Encryption Standards
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              Secure communication channels and encrypted connections help
              protect repository analysis, AI interactions, and platform
              authentication workflows.
            </p>
          </div>

          {/* Card 3 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <ServerCrash className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Infrastructure Security
              </h2>
            </div>

            <p className="text-muted-foreground leading-7">
              GitVerse continuously monitors infrastructure reliability,
              applies security updates, and improves operational stability
              to reduce downtime and system vulnerabilities.
            </p>
          </div>

          {/* Card 4 */}
          <div className="glass rounded-2xl border border-border/50 p-8 transition-all duration-300 hover:-translate-y-1 hover:border-primary/40">
            <div className="flex items-center gap-3 mb-4">
              <Bug className="text-primary" />
              <h2 className="text-2xl font-semibold">
                Responsible Disclosure
              </h2>
            </div>

            <p className="text-muted-foreground leading-7 mb-4">
              Security researchers and contributors are encouraged to report
              vulnerabilities responsibly to help improve platform safety
              and maintain a secure experience for all users.
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
       
        <Footer />
    </div>
  )
}
