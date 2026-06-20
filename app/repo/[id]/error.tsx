'use client'

import { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function RepositoryAnalysisError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Repository analysis error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <AlertTriangle className="mb-4 h-12 w-12 text-amber-500" />
      <h2 className="mb-2 text-2xl font-semibold">Repository analysis failed</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        We encountered an error while analyzing the repository or rendering the visualization data. Please try again.
      </p>
      {process.env.NODE_ENV === 'development' && error.digest && (
        <p className="mb-4 text-xs text-muted-foreground">Error ID: {error.digest}</p>
      )}
      <Button onClick={reset}>
        <RefreshCw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  )
}
