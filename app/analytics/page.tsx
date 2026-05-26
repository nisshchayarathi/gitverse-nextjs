'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import DeveloperGrowth from '@/pages/DeveloperGrowth'

export default function AnalyticsPage() {
  return (
    <ProtectedRoute>
      <DeveloperGrowth />
    </ProtectedRoute>
  )
}
