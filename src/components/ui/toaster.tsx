'use client'

import { ToastContainer } from '@/components/ui/toast'
import { useToast } from '@/hooks/use-toast'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return <ToastContainer toasts={toasts} onRemove={dismiss} />
}
