import type { ReactNode } from 'react'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'

interface SummaryQueryBoundaryProps {
  children: ReactNode
  isLoading?: boolean
  isError?: boolean
  message: string
  retryLabel: string
  onRetry: () => void
}

/** Evita presentar $0 como dato real cuando la consulta agregada no respondió. */
export function SummaryQueryBoundary({
  children,
  isLoading = false,
  isError = false,
  message,
  retryLabel,
  onRetry,
}: SummaryQueryBoundaryProps) {
  if (isLoading) {
    return (
      <div aria-label="Cargando resumen" className="mb-4 space-y-3">
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
          <Skeleton className="h-24 rounded-lg" />
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
        <p className="text-sm text-destructive">{message}</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          {retryLabel}
        </Button>
      </div>
    )
  }

  return <>{children}</>
}
