'use client'

import { Suspense } from 'react'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import SearchPage from '@/pages/SearchPage'

export default function Search() {
  return (
    <ProtectedRoute>
      <Suspense fallback={
        <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }>
        <SearchPage />
      </Suspense>
    </ProtectedRoute>
  )
}
