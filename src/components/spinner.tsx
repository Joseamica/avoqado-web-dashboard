import React from 'react'
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

export function Spinner({ size, show, children, className }: SpinnerContentProps) {
  return (
    <span className={spinnerVariants({ show })} role="status" aria-live="polite">
      <AvoqadoLoader className={cn(loaderVariants({ size }), className)} />
      {children ? <span className="text-sm font-medium text-muted-foreground">{children}</span> : null}
    </span>
  )
}

export function LoadingScreen({ message }: { message?: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center loading-screen bg-background" aria-busy="true">
      <Spinner size="large" className="spinner">
        {message}
      </Spinner>
    </div>
  )
}
