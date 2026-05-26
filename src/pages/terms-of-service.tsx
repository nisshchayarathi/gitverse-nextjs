import React from "react";
import { Navbar, Footer } from "@/components/layout";

export default function TermsOfService() {
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
              Terms of <span className="text-gradient">Service</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Understand the guidelines, responsibilities, and usage policies associated with using GitVerse and its 
              developer-focused platform features.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 pb-24 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Acceptance of Terms
                </h2>

                <p className="text-muted-foreground leading-7">
                  By accessing or using GitVerse, users agree to comply with the platform’s terms, policies, and 
                  applicable guidelines related to repository analysis and collaboration tools.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  User Responsibilities
                </h2>

                <p className="text-muted-foreground leading-7">
                  Users are responsible for maintaining the security of their accounts, protecting repository access credentials, 
                  and ensuring that uploaded or analyzed repositories comply with applicable laws and permissions.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Platform Usage
                </h2>

                <p className="text-muted-foreground leading-7">
                  GitVerse provides repository visualization, contributor insights, and AI-powered analysis tools intended to 
                  support developer productivity and collaboration workflows.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Limitations
                </h2>

                <p className="text-muted-foreground leading-7">
                  The platform is provided on an “as available” basis without guarantees regarding uptime, analysis accuracy, 
                  or uninterrupted access to all services and integrations.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Service Changes
                </h2>

                <p className="text-muted-foreground leading-7">
                  GitVerse may modify, improve, or discontinue features periodically in order to enhance platform stability, 
                  usability, and future development.
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