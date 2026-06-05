import type { AppProps } from 'next/app'
import { SessionProvider } from "next-auth/react";
import { ThemeProvider } from '@/context/ThemeContext'
import { AuthProvider } from '@/contexts/AuthContext'
import { Toaster } from '@/components/ui/toaster'
import { ErrorBoundary } from '@/components/ui/ErrorBoundary'
import { AnimatePresence, motion } from "framer-motion";
import { useRouter } from "next/router";

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();

  return (
    <ErrorBoundary>
      <SessionProvider session={pageProps.session}>
        <ThemeProvider>
          <AuthProvider>

            <AnimatePresence mode="wait">
              <motion.div
                key={router.route}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.25 }}
              >
                <Component {...pageProps} />
              </motion.div>
            </AnimatePresence>

            <Toaster />

          </AuthProvider>
        </ThemeProvider>
      </SessionProvider>
    </ErrorBoundary>
  )
}