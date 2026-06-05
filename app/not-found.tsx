import Link from 'next/link'
import { FileX } from 'lucide-react'
import { Button } from '@/components/ui/Button'

export default function NotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-8 text-center">
      <FileX className="mb-4 h-16 w-16 text-muted-foreground" />
      <h2 className="mb-2 text-2xl font-semibold">Page not found</h2>
      <p className="mb-6 max-w-md text-muted-foreground">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link href="/">
        <Button>Go home</Button>
      </Link>
    </div>
  )
}
