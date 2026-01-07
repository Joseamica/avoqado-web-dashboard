import * as React from 'react'
import { cn } from '@/lib/utils'

export interface StatusPulseProps extends React.HTMLAttributes<HTMLSpanElement> {
  status: 'success' | 'warning' | 'error' | 'neutral' | 'info'
  size?: 'sm' | 'md' | 'lg'
}

/**
 * StatusPulse - Animated status indicator
 *
 * Shows a pulsing dot to indicate status with visual feedback.
 * The pulse animation draws attention to important states.
 *
 * @example
 * <StatusPulse status="success" />
 * <StatusPulse status="warning" size="lg" />
 */
const StatusPulse = React.forwardRef<HTMLSpanElement, StatusPulseProps>(({ status, size = 'md', className, ...props }, ref) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted-foreground',
    info: 'bg-blue-500',
  }

  const sizes = {
    sm: 'h-2 w-2',
    md: 'h-3 w-3',
    lg: 'h-4 w-4',
  }

  return (
    <span ref={ref} className={cn('relative flex', sizes[size], className)} {...props}>
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-full w-full', colors[status])} />
    </span>
  )
})
StatusPulse.displayName = 'StatusPulse'

export { StatusPulse }
