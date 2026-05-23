import { ReactNode } from "react";
import { Metadata } from "next";
import { ThemeProvider } from "@/context/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { NextAuthProvider } from "@/components/auth/NextAuthProvider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

export const metadata: Metadata = {
  title: "GitVerse - AI-Powered Repository Analysis",
  description: "Contribution made easy with repo visualization and PR Mentor",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var saved = localStorage.getItem('theme');
                  var theme = saved;
                  if (!theme) {
                    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                    theme = prefersDark ? 'dark' : 'light';
                  }
                  if (theme === 'dark') {
                    document.documentElement.classList.add('dark');
                  } else {
                    document.documentElement.classList.remove('dark');
                  }
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body>
        <ThemeProvider>
          <NextAuthProvider>
            <AuthProvider>
              {children}
              <Toaster />
            </AuthProvider>
          </NextAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
