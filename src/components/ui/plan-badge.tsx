/**
 * PlanBadge Component
 *
 * Theme-aware badge for displaying subscription plans following THEME-GUIDELINES.md
 * Provides consistent plan colors across the application
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type PlanVariant = 'starter' | 'professional' | 'enterprise' | 'free' | 'custom'

interface PlanBadgeProps {
  variant: PlanVariant
  children: React.ReactNode
  className?: string
}

/**
 * Get theme-aware classes for plan badge
 * Following THEME-GUIDELINES.md Section 7: Colored Elements
 */
const getPlanClasses = (variant: PlanVariant): string => {
  const variants = {
    starter: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
    professional: 'bg-purple-50 dark:bg-purple-950/50 text-purple-800 dark:text-purple-200 border border-purple-200 dark:border-purple-800',
    enterprise: 'bg-orange-50 dark:bg-orange-950/50 text-orange-800 dark:text-orange-200 border border-orange-200 dark:border-orange-800',
    free: 'bg-muted text-muted-foreground border border-border',
    custom: 'bg-primary/10 text-primary border border-primary/20',
  }

  return variants[variant]
}

export function PlanBadge({ variant, children, className }: PlanBadgeProps) {
  return (
    <Badge className={cn(getPlanClasses(variant), className)}>
      {children}
    </Badge>
  )
}

/**
 * Convenience component for subscription plans
 * Maps SubscriptionPlan enum to PlanVariant
 */
export type SubscriptionPlanType = 'STARTER' | 'PROFESSIONAL' | 'ENTERPRISE' | 'FREE' | 'CUSTOM'

interface SubscriptionPlanBadgeProps {
  plan: SubscriptionPlanType
  label: string
  className?: string
}

const subscriptionPlanMap: Record<SubscriptionPlanType, PlanVariant> = {
  STARTER: 'starter',
  PROFESSIONAL: 'professional',
  ENTERPRISE: 'enterprise',
  FREE: 'free',
  CUSTOM: 'custom',
}

export function SubscriptionPlanBadge({ plan, label, className }: SubscriptionPlanBadgeProps) {
  return (
    <PlanBadge variant={subscriptionPlanMap[plan]} className={className}>
      {label}
    </PlanBadge>
  )
}
