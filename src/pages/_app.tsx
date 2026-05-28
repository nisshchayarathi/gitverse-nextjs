import type { AppProps } from 'next/app'
import { useEffect } from 'react'
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from '@/components/ThemeProvider'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { initGlobalInterceptors } from '@/services/apiInterceptor'
import '@/app/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    initGlobalInterceptors();
  }, []);

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

