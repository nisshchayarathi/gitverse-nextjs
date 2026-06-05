'use client'

import React, { Suspense } from 'react'
import Signup from '@/pages/Signup'

export default function SignupPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Signup />
    </Suspense>
  )
}
