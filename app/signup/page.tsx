'use client'

import Signup from '@/pages/Signup'
import { Suspense } from 'react'

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400">Loading signup...</div>}>
      <Signup />
    </Suspense>
  )
}

