'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import Dashboard from '@/pages/Dashboard'

export default async function DashboardPage() {
  await new Promise((res) => setTimeout(res, 2000));
  return (
    <ProtectedRoute>
      <Dashboard />
    </ProtectedRoute>
  )
}
