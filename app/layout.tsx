import "@/lib/env";
import { ReactNode } from "react";
import { Metadata } from "next";
import { Inter, Source_Sans_3 } from "next/font/google";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextAuthProvider } from "@/components/auth/NextAuthProvider";
import { Toaster } from "@/components/ui/toaster";
import { ScrollToTop } from "@/components/ui/ScrollToTop";
import { FocusRingManager } from "@/components/ui/FocusRingManager";
import ProgressBarProvider from "@/components/providers/ProgressBarProvider";
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
  description: "Accelerate your open-source journey with interactive repository visualization, structural dependency graphs, and automated AI PR mentoring.",
  keywords: ["GitHub", "Next.js", "AI Code Analysis", "Open Source", "PR Mentor", "Repository Visualization", "GitVerse"],
  authors: [{ name: "GitVerse Team" }],
  creator: "GitVerse",
  openGraph: {
    type: "website",
    locale: "en_US",
    url: appUrl,
    title: "GitVerse - AI-Powered Repository Analysis",
    description: "Accelerate your open-source journey with interactive repository visualization, structural dependency graphs, and automated AI PR mentoring.",
    siteName: "GitVerse",
    images: [
      {
        url: "/api/og?title=GitVerse%20-%20AI%20Repository%20Analysis",
        width: 1200,
        height: 630,
        alt: "GitVerse Preview Image",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "GitVerse - AI-Powered Repository Analysis",
    description: "Accelerate your open-source journey with interactive repository visualization, structural dependency graphs, and automated AI PR mentoring.",
    images: ["/api/og?title=GitVerse%20-%20AI%20Repository%20Analysis"],
    creator: "@gitverse",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
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
              <FocusRingManager />
              <ProgressBarProvider>
                <main id="main-content">
                  {children}
                </main>
              </ProgressBarProvider>

                <Toaster />
                <ScrollToTop />
              </AuthProvider>
            </SessionGuard>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
