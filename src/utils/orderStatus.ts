import { CheckCircle2, Clock, XCircle } from 'lucide-react'

export const getOrderStatusConfig = (status: string) => {
  const s = status?.toUpperCase()
  switch (s) {
    case 'COMPLETED':
    case 'PAID':
    case 'CLOSED':
      return {
        icon: CheckCircle2,
        color: 'text-green-800 dark:text-green-400',
        bg: 'bg-green-100 dark:bg-green-900/30',
        border: 'border-transparent',
      }
    case 'PENDING':
    case 'OPEN':
    case 'CONFIRMED':
    case 'PREPARING':
    case 'READY':
      return {
        icon: Clock,
        color: 'text-yellow-800 dark:text-yellow-400',
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        border: 'border-transparent',
      }
    case 'CANCELLED':
    case 'CANCELED':
    case 'DELETED':
      return {
        icon: XCircle,
        color: 'text-red-800 dark:text-red-400',
        bg: 'bg-red-100 dark:bg-red-900/30',
        border: 'border-transparent',
      }
    default:
      return {
        icon: Clock,
        color: 'text-muted-foreground',
        bg: 'bg-muted',
        border: 'border-border',
      }
  }
}

export const getOrderTypeConfig = (type: string) => {
  const t = type?.toUpperCase()
  switch (t) {
    case 'DINE_IN':
      return { label: 'Dine In', bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-800 dark:text-blue-400' }
    case 'TAKEOUT':
      return { label: 'Takeout', bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-800 dark:text-purple-400' }
    case 'DELIVERY':
      return { label: 'Delivery', bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-800 dark:text-orange-400' }
    case 'PICKUP':
      return { label: 'Pickup', bg: 'bg-cyan-100 dark:bg-cyan-900/30', color: 'text-cyan-800 dark:text-cyan-400' }
    default:
      return { label: type || 'Unknown', bg: 'bg-muted', color: 'text-muted-foreground' }
  }
}

export const formatOrderNumber = (orderNumber?: string | null): string => {
  if (!orderNumber) return '-'
  const match = orderNumber.match(/(?:ORD|FAST)-(.+)/)
  if (!match) return orderNumber
  const digits = match[1].replace(/\D/g, '')
  if (!digits) return orderNumber
  return digits.length > 6 ? digits.slice(-6) : digits
}
