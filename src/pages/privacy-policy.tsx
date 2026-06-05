import React from "react";
import { Navbar, Footer } from "@/components/layout";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />

      <main className="relative overflow-hidden">
        {/* Background Glow */}
        <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-20 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />

        {/* Hero Section */}
        <section className="container mx-auto px-4 pt-28 pb-16 relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <h1 className="text-5xl md:text-6xl font-heading font-bold mb-6">
              Privacy <span className="text-gradient">Policy</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Learn how GitVerse collects, uses, and protects your data while
              providing repository visualization and developer insights.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 pb-24 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Information Collection
                </h2>

                <p className="text-muted-foreground leading-7">
                  GitVerse may collect repository metadata, authentication
                  details, and usage analytics to improve platform features,
                  user experience, and repository analysis capabilities.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  How We Use Data
                </h2>

                <p className="text-muted-foreground leading-7">
                  The collected information is used to generate repository
                  visualizations, contributor insights, code analytics, and
                  AI-powered recommendations for developers and teams.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Security Practices
                </h2>

                <p className="text-muted-foreground leading-7">
                  We prioritize secure authentication, protected API access,
                  and safe handling of repository permissions to ensure user
                  data remains protected.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Third-Party Services
                </h2>

                <p className="text-muted-foreground leading-7">
                  GitVerse may integrate with external services such as GitHub
                  authentication and analytics providers to enhance platform
                  functionality and improve user workflows.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Policy Updates
                </h2>

                <p className="text-muted-foreground leading-7">
                  This privacy policy may be updated periodically to reflect
                  improvements, legal requirements, or platform changes.
                </p>
              </section>

            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}