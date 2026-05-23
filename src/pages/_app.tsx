import type { AppProps } from 'next/app'
import { SessionProvider } from 'next-auth/react'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import '@/app/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <SessionProvider session={pageProps.session}>
      <ThemeProvider>
        <AuthProvider>
          <Component {...pageProps} />
          <Toaster />
        </AuthProvider>
      </ThemeProvider>
    </SessionProvider>
  )
}
