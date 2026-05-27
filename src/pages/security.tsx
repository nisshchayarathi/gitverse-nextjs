import React from "react";
import { Navbar, Footer } from "@/components/layout";

export default function Security() {
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
              <span className="text-gradient">Security</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Learn about the security practices, authentication protections, and responsible disclosure processes followed 
              by GitVerse.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 pb-24 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Authentication Security
                </h2>

                <p className="text-muted-foreground leading-7">
                  GitVerse uses secure authentication mechanisms and protected access flows to help safeguard user sessions 
                  and repository permissions.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Repository Access
                </h2>

                <p className="text-muted-foreground leading-7">
                  Repository access is limited to the permissions explicitly granted by users during authentication and 
                  integration setup processes.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Data Protection
                </h2>

                <p className="text-muted-foreground leading-7">
                  Sensitive information and repository metadata are handled with security-focused practices designed to 
                  minimize unauthorized access and misuse.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Infrastructure Practices
                </h2>

                <p className="text-muted-foreground leading-7">
                  The platform follows modern development and deployment practices aimed at maintaining reliability, 
                  monitoring performance, and reducing operational risks.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Responsible Disclosure
                </h2>

                <p className="text-muted-foreground leading-7">
                  Security researchers and contributors are encouraged to responsibly report vulnerabilities or security 
                  concerns to help improve the safety of the platform.
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