/**
 * StatusBadge Component
 *
 * Theme-aware badge for displaying status states following THEME-GUIDELINES.md
 * Provides consistent status colors across the application
 */

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

export type StatusVariant =
  | 'success'  // Green - Active, Approved, Completed
  | 'warning'  // Yellow - Pending, In Progress
  | 'error'    // Red - Suspended, Failed, Rejected
  | 'info'     // Blue - Trial, New
  | 'neutral'  // Gray - Cancelled, Inactive

interface StatusBadgeProps {
  variant: StatusVariant
  children: React.ReactNode
  className?: string
}

/**
 * Get theme-aware classes for status badge
 * Following THEME-GUIDELINES.md Section 7: Colored Elements
 */
const getStatusClasses = (variant: StatusVariant): string => {
  const variants = {
    success: 'bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800',
    warning: 'bg-yellow-50 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800',
    error: 'bg-destructive/10 text-destructive border border-destructive/20',
    info: 'bg-blue-50 dark:bg-blue-950/50 text-blue-800 dark:text-blue-200 border border-blue-200 dark:border-blue-800',
    neutral: 'bg-muted text-muted-foreground border border-border',
  }

  return variants[variant]
}

export function StatusBadge({ variant, children, className }: StatusBadgeProps) {
  return (
    <Badge className={cn(getStatusClasses(variant), className)}>
      {children}
    </Badge>
  )
}

/**
 * Convenience component for venue status
 * Maps VenueStatus enum to StatusVariant
 */
export type VenueStatusType = 'ACTIVE' | 'PENDING' | 'SUSPENDED' | 'CANCELLED' | 'TRIAL'

interface VenueStatusBadgeProps {
  status: VenueStatusType
  label: string
  className?: string
}

const venueStatusMap: Record<VenueStatusType, StatusVariant> = {
  ACTIVE: 'success',
  PENDING: 'warning',
  SUSPENDED: 'error',
  CANCELLED: 'neutral',
  TRIAL: 'info',
}

export function VenueStatusBadge({ status, label, className }: VenueStatusBadgeProps) {
  return (
    <StatusBadge variant={venueStatusMap[status]} className={className}>
      {label}
    </StatusBadge>
  )
}

/**
 * Convenience component for KYC status
 */
export type KYCStatusType = 'APPROVED' | 'PENDING_REVIEW' | 'IN_REVIEW' | 'REJECTED' | 'NOT_STARTED'

interface KYCStatusBadgeProps {
  status: KYCStatusType
  label: string
  className?: string
}

const kycStatusMap: Record<KYCStatusType, StatusVariant> = {
  APPROVED: 'success',
  PENDING_REVIEW: 'warning',
  IN_REVIEW: 'info',
  REJECTED: 'error',
  NOT_STARTED: 'neutral',
}

export function KYCStatusBadge({ status, label, className }: KYCStatusBadgeProps) {
  return (
    <StatusBadge variant={kycStatusMap[status]} className={className}>
      {label}
    </StatusBadge>
  )
}

/**
 * Convenience component for payment status
 */
export type PaymentStatusType = 'PAID' | 'PENDING' | 'OVERDUE' | 'FAILED'

interface PaymentStatusBadgeProps {
  status: PaymentStatusType
  label: string
  className?: string
}

const paymentStatusMap: Record<PaymentStatusType, StatusVariant> = {
  PAID: 'success',
  PENDING: 'warning',
  OVERDUE: 'error',
  FAILED: 'error',
}

export function PaymentStatusBadge({ status, label, className }: PaymentStatusBadgeProps) {
  return (
    <StatusBadge variant={paymentStatusMap[status]} className={className}>
      {label}
    </StatusBadge>
  )
}
