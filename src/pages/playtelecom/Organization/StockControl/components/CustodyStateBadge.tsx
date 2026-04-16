/**
 * CustodyStateBadge — shared visual for SIM custody states (plan §2.0.2).
 *
 * Single source of truth for colors + labels. Mirrors the Compose equivalent
 * in avoqado-tpv so both surfaces stay consistent. Uses semantic tokens so
 * the badge still reads correctly in dark mode; icon + label guarantees
 * WCAG compliance (we never rely on color alone).
 */
import { Badge } from '@/components/ui/badge'
import { Warehouse, UserCog, Clock, CheckCircle2, XCircle, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { SimCustodyState } from '@/services/simCustody.service'

type PaletteEntry = {
  label: string
  className: string
  Icon: typeof Warehouse
}

const PALETTE: Record<SimCustodyState, PaletteEntry> = {
  ADMIN_HELD: {
    label: 'En almacén',
    className: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800/60 dark:text-slate-200 dark:border-slate-700',
    Icon: Warehouse,
  },
  SUPERVISOR_HELD: {
    label: 'Con Supervisor',
    className: 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-200 dark:border-blue-800',
    Icon: UserCog,
  },
  PROMOTER_PENDING: {
    label: 'Pendiente aceptar',
    className: 'bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800',
    Icon: Clock,
  },
  PROMOTER_HELD: {
    label: 'Con Promotor',
    className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800',
    Icon: CheckCircle2,
  },
  PROMOTER_REJECTED: {
    label: 'Rechazado',
    className: 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-200 dark:border-red-800',
    Icon: XCircle,
  },
  SOLD: {
    label: 'Vendido',
    className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800',
    Icon: DollarSign,
  },
}

export function CustodyStateBadge({ state, className }: { state: SimCustodyState; className?: string }) {
  const entry = PALETTE[state]
  const Icon = entry.Icon
  return (
    <Badge variant="outline" className={cn('gap-1 font-medium', entry.className, className)}>
      <Icon className="h-3 w-3" aria-hidden />
      {entry.label}
    </Badge>
  )
}
