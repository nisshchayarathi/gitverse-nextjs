'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import SearchPage from '@/pages/SearchPage'

export default function Search() {
  return (
    <ProtectedRoute>
      <SearchPage />
    </ProtectedRoute>
  )
}
