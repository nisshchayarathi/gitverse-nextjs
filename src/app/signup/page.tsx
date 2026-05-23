import { Suspense } from 'react'
import Signup from '@/pages/Signup'

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-background text-foreground">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    }>
      <Signup />
    </Suspense>
  )
}
