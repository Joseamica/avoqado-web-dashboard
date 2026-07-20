import React, {
  createContext,
  useCallback,
  useContext,
  useId,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react'
import { cn } from '@/lib/utils'
import { VariantProps, cva } from 'class-variance-authority'
import { AvoqadoLoader } from '@/components/avoqado-loader'

const spinnerVariants = cva('flex-col items-center justify-center gap-3', {
  variants: {
    show: {
      true: 'flex',
      false: 'hidden',
    },
  },
  defaultVariants: {
    show: true,
  },
})

const loaderVariants = cva('', {
  variants: {
    size: {
      small: 'size-6',
      medium: 'size-8',
      large: 'size-20',
    },
  },
  defaultVariants: {
    size: 'medium',
  },
})

interface SpinnerContentProps extends VariantProps<typeof spinnerVariants>, VariantProps<typeof loaderVariants> {
  className?: string
  children?: React.ReactNode
}

interface LoadingScreenRequest {
  id: string
  message?: React.ReactNode
}

interface LoadingScreenRegistry {
  register: (request: LoadingScreenRequest) => void
  unregister: (id: string) => void
}

const LoadingScreenContext = createContext<LoadingScreenRegistry | null>(null)

export function Spinner({ size, show, children, className }: SpinnerContentProps) {
  return (
    <span className={spinnerVariants({ show })} role="status" aria-live="polite">
      <AvoqadoLoader className={cn(loaderVariants({ size }), className)} />
      {children ? <span className="text-sm font-medium text-muted-foreground">{children}</span> : null}
    </span>
  )
}

function LoadingScreenViewport({ message }: { message?: React.ReactNode }) {
  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center loading-screen bg-background"
      aria-busy="true"
    >
      <Spinner size="large" className="spinner">
        {message}
      </Spinner>
    </div>
  )
}

/**
 * Owns the only full-screen loader DOM node in the application. Loading states
 * register here instead of mounting competing fixed overlays; the most recent
 * request supplies the message while the animated mark remains mounted.
 */
export function LoadingScreenProvider({ children }: { children: React.ReactNode }) {
  const [requests, setRequests] = useState<LoadingScreenRequest[]>([])

  const register = useCallback((request: LoadingScreenRequest) => {
    setRequests((current) => [...current.filter(({ id }) => id !== request.id), request])
  }, [])

  const unregister = useCallback((id: string) => {
    setRequests((current) => current.filter((request) => request.id !== id))
  }, [])

  const registry = useMemo(() => ({ register, unregister }), [register, unregister])
  // Last request wins. Index access instead of `.at(-1)` because tsconfig lib is ES2020
  // (Array.prototype.at needs ES2022) — this keeps `tsc` green in the production build.
  const activeRequest = requests.length > 0 ? requests[requests.length - 1] : undefined

  return (
    <LoadingScreenContext.Provider value={registry}>
      {children}
      {activeRequest ? <LoadingScreenViewport message={activeRequest.message} /> : null}
    </LoadingScreenContext.Provider>
  )
}

export function LoadingScreen({ message }: { message?: React.ReactNode }) {
  const registry = useContext(LoadingScreenContext)
  const requestId = useId()

  useLayoutEffect(() => {
    if (!registry) return

    registry.register({ id: requestId, message })
    return () => registry.unregister(requestId)
  }, [message, registry, requestId])

  // Standalone rendering keeps component tests, isolated routes and previews
  // useful even when they are not wrapped in the application root provider.
  return registry ? null : <LoadingScreenViewport message={message} />
}
