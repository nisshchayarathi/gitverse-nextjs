'use client'

import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import Settings from '@/pages/Settings'

export default function SettingsPage() {
  return (
    <ProtectedRoute>
      <Settings />
    </ProtectedRoute>
  )
}
