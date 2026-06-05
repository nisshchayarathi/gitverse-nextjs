import React from "react";
import { Navbar, Footer } from "@/components/layout";

export default function CookiePolicy() {
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
              Cookie <span className="text-gradient">Policy</span>
            </h1>

            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Understand how GitVerse uses cookies and similar technologies to improve platform functionality and user experience.
            </p>
          </div>
        </section>

        {/* Content */}
        <section className="container mx-auto px-4 pb-24 relative z-10">
          <div className="max-w-4xl mx-auto">
            <div className="space-y-6">

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  What Are Cookies
                </h2>

                <p className="text-muted-foreground leading-7">
                  Cookies are small data files stored on your device that help websites remember preferences, maintain 
                  sessions, and improve usability.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Essential Cookies
                </h2>

                <p className="text-muted-foreground leading-7">
                  Essential cookies help enable core platform functionality such as authentication, navigation, and 
                  maintaining secure user sessions.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Analytics Cookies
                </h2>

                <p className="text-muted-foreground leading-7">
                  Analytics-related cookies may be used to better understand platform usage patterns and improve overall 
                  user experience and performance.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Managing Preferences
                </h2>

                <p className="text-muted-foreground leading-7">
                  Users can manage or disable cookies through browser settings, though some platform features may function 
                  differently when cookies are restricted.
                </p>
              </section>

              <section className="glass rounded-2xl p-8 border border-border/40 transition-all duration-300 hover:border-primary/50 hover:scale-[1.01] hover:-translate-y-1 hover:shadow-xl hover:shadow-primary/10">
                <h2 className="text-2xl font-semibold mb-4">
                  Policy Updates
                </h2>

                <p className="text-muted-foreground leading-7">
                  This cookie policy may be updated periodically to reflect changes in technologies, platform features, or 
                  legal requirements.
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