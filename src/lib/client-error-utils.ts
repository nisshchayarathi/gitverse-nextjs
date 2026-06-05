import { toast } from '@/hooks/use-toast'
import { AxiosError } from 'axios'

export function getErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    }
    const data = error.response.data as Record<string, unknown> | undefined
    if (data?.message && typeof data.message === 'string') return data.message
    if (data?.error && typeof data.error === 'string') return data.error
    if (error.response.status === 401) return 'Your session has expired. Please log in again.'
    if (error.response.status === 403) return 'You do not have permission to perform this action.'
    if (error.response.status === 404) return 'The requested resource was not found.'
    if (error.response.status === 429) return 'Too many requests. Please wait a moment and try again.'
    if (error.response.status >= 500) return 'A server error occurred. Please try again later.'
  }

  if (error instanceof Error) {
    if (error.message === 'Failed to fetch' || error.message === 'NetworkError') {
      return 'Unable to connect to the server. Please check your internet connection and try again.'
    }
    return error.message
  }

  return 'An unexpected error occurred. Please try again.'
}

export function handleApiError(error: unknown, fallbackMessage?: string) {
  const title = fallbackMessage || 'Error'
  const description = getErrorMessage(error)

  toast({
    title,
    description,
    variant: 'destructive',
  })
}

export function handleAuthError(error: unknown) {
  const title = 'Authentication failed'
  const description = getErrorMessage(error)

  toast({ title, description, variant: 'destructive' })
}

export function handleNetworkError() {
  toast({
    title: 'Network issue',
    description: 'Unable to connect to the server. Please check your internet connection and try again.',
    variant: 'destructive',
  })
}
