import type { AppProps } from 'next/app'
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from '@/contexts/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import '@/app/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ErrorBoundary>
      <SessionProvider session={pageProps.session}>
        <ThemeProvider>
          <AuthProvider>
            <Component {...pageProps} />
            <Toaster />
          </AuthProvider>
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  )
}
