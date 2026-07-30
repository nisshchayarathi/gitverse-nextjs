'use client'

import PageTransition from '@/components/PageTransition'
import LandingPage from '@/pages/LandingPage'

export default function Home() {
  return (
    <PageTransition>
      <LandingPage />
    </PageTransition>
  )
}