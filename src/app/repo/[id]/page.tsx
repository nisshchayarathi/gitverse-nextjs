'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import RepositoryAnalysis from '@/pages/RepositoryAnalysis'

export default function RepoPage() {
  return (
    <ProtectedRoute>
      <RepositoryAnalysis />
    </ProtectedRoute>
  )
}
