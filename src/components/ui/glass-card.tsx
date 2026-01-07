import * as React from 'react'
import { cn } from '@/lib/utils'

export interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode
  hover?: boolean
}

/**
 * GlassCard - Glassmorphism card wrapper
 *
 * Modern 2025/2026 design component with:
 * - Subtle backdrop blur effect
 * - Semi-transparent background
 * - Smooth hover transitions
 *
 * @example
 * <GlassCard hover onClick={() => console.log('clicked')}>
 *   <p>Content here</p>
 * </GlassCard>
 */
const GlassCard = React.forwardRef<HTMLDivElement, GlassCardProps>(({ children, className, hover = false, onClick, ...props }, ref) => (
  <div
    ref={ref}
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className,
    )}
    {...props}
  >
    {children}
  </div>
))
GlassCard.displayName = 'GlassCard'

export { GlassCard }
