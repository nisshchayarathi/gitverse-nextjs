'use client'

import Login from '@/pages/Login'
import { Suspense } from 'react'

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Loading login...</div>}>
      <Login />
    </Suspense>
  )
}

