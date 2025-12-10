import React from 'react'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Glassmorphism card wrapper - Modern 2025/2026 Design
 */
export const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className,
    )}
  >
    {children}
  </div>
)

/**
 * Status indicator with pulse animation
 */
export const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  }

  return (
    <span className="relative flex h-3 w-3">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}

/**
 * Step indicator component for wizards
 */
export const StepIndicator: React.FC<{
  steps: { label: string; description?: string }[]
  currentStep: number
}> = ({ steps, currentStep }) => (
  <div className="flex items-center gap-2">
    {steps.map((step, index) => (
      <React.Fragment key={step.label}>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
              index < currentStep && 'bg-green-500 text-primary-foreground',
              index === currentStep && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
              index > currentStep && 'bg-muted text-muted-foreground',
            )}
          >
            {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
          </div>
          <div className="hidden sm:block">
            <p className={cn('text-sm font-medium', index <= currentStep ? 'text-foreground' : 'text-muted-foreground')}>{step.label}</p>
          </div>
        </div>
        {index < steps.length - 1 && (
          <div className={cn('flex-1 h-0.5 rounded-full mx-2', index < currentStep ? 'bg-green-500' : 'bg-muted')} />
        )}
      </React.Fragment>
    ))}
  </div>
)
