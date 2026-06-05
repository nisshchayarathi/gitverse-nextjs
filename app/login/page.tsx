'use client'

import React, { Suspense } from 'react'
import Login from '@/pages/Login'

export default function LoginPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <Login />
    </Suspense>
  )
}
