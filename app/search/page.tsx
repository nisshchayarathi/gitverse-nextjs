'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import SearchPage from '@/pages/SearchPage'
import { Suspense } from 'react'

export default function Search() {
  return (
    <ProtectedRoute>
      <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Loading search...</div>}>
        <SearchPage />
      </Suspense>
    </ProtectedRoute>
  )
}

