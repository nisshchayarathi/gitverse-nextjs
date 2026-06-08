import PageTransition from "@/components/PageTransition";

import "@/lib/env";
import { ReactNode } from "react";
import { Metadata } from "next";
import { Inter, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextAuthProvider } from "@/components/auth/NextAuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { SessionExpiryHandler } from "@/components/auth/SessionExpiryHandler";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const sourceSans = Source_Sans_3({
  subsets: ["latin"],
  variable: "--font-source-sans",
  display: "swap",
});

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://gitverse.dev";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "GitVerse - AI-Powered Repository Analysis & PR Mentoring",
    template: "%s | GitVerse",
  },
  description:
    "Accelerate your open-source journey with interactive repository visualization, structural dependency graphs, and automated AI PR mentoring.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${sourceSans.variable}`}>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:bg-black focus:text-white focus:px-4 focus:py-2 focus:rounded"
        >
          Skip to main content
        </a>

        <ThemeProvider>
          <NextAuthProvider>
            <AuthProvider>
<<<<<<< HEAD
              <FocusRingManager />
              <ProgressBarProvider>
                <main id="main-content">
                  <PageTransition>
                    {children}
                  </PageTransition>
                </main>
              </ProgressBarProvider>

              <Toaster />
              <ScrollToTop />
=======
              <SessionExpiryHandler />
              {children}
              <Toaster />
>>>>>>> upstream/main
            </AuthProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}