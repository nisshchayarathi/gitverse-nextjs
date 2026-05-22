import type { AppProps } from 'next/app'
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { NextAuthProvider } from '@/components/auth/NextAuthProvider'
import { Toaster } from '@/components/ui/toaster'
import '@/app/globals.css'

export default function App({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <NextAuthProvider>
        <AuthProvider>
          <Component {...pageProps} />
          <Toaster />
        </AuthProvider>
      </NextAuthProvider>
    </ThemeProvider>
  )
}

