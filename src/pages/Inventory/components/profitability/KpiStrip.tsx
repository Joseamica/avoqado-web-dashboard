import { TrendingUp, AlertTriangle, Sparkles, Flame } from 'lucide-react'
import { cn } from '@/lib/utils'

interface KpiTile {
  label: string
  value: string
  hint?: string
  tone: 'neutral' | 'warning' | 'danger' | 'success'
  icon: typeof TrendingUp
  onClick?: () => void
}

interface Props {
  /** Median margin across the catalog — robust to outliers (e.g. typo'd recipe cost) */
  medianMarginPct: number
  atRiskCount: number
  withoutPolicyCount: number
  costDriftCount: number
  onJumpAtRisk?: () => void
  onJumpWithoutPolicy?: () => void
  onJumpCostDrift?: () => void
}

const TONE: Record<KpiTile['tone'], { ring: string; text: string; iconBg: string; iconText: string }> = {
  neutral: {
    ring: 'border-border/60',
    text: 'text-foreground',
    iconBg: 'bg-foreground/[0.04]',
    iconText: 'text-foreground/70',
  },
  warning: {
    ring: 'border-amber-200 dark:border-amber-900/60',
    text: 'text-amber-700 dark:text-amber-400',
    iconBg: 'bg-amber-500/10',
    iconText: 'text-amber-600 dark:text-amber-400',
  },
  danger: {
    ring: 'border-rose-200 dark:border-rose-900/60',
    text: 'text-rose-700 dark:text-rose-400',
    iconBg: 'bg-rose-500/10',
    iconText: 'text-rose-600 dark:text-rose-400',
  },
  success: {
    ring: 'border-emerald-200 dark:border-emerald-900/60',
    text: 'text-emerald-700 dark:text-emerald-400',
    iconBg: 'bg-emerald-500/10',
    iconText: 'text-emerald-600 dark:text-emerald-400',
  },
}

function Tile({ label, value, hint, tone, icon: Icon, onClick }: KpiTile) {
  const t = TONE[tone]
  const interactive = !!onClick
  return (
    <button
      onClick={onClick}
      disabled={!interactive}
      className={cn(
        'group relative overflow-hidden rounded-2xl border bg-card p-4 text-left transition-all',
        t.ring,
        interactive && 'hover:shadow-md hover:-translate-y-px cursor-pointer',
        !interactive && 'cursor-default',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1.5 min-w-0">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</div>
          <div className={cn('text-3xl font-semibold tabular-nums tracking-tight', t.text)}>{value}</div>
          {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
        </div>
        <div className={cn('flex-none rounded-xl p-2', t.iconBg)}>
          <Icon className={cn('h-4 w-4', t.iconText)} />
        </div>
      </div>
    </button>
  )
}

export function KpiStrip({
  medianMarginPct,
  atRiskCount,
  withoutPolicyCount,
  costDriftCount,
  onJumpAtRisk,
  onJumpWithoutPolicy,
  onJumpCostDrift,
}: Props) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <Tile
        label="Margen típico"
        value={`${(medianMarginPct * 100).toFixed(1)}%`}
        hint="mediana del catálogo activo"
        tone={medianMarginPct >= 0.5 ? 'success' : medianMarginPct >= 0.35 ? 'warning' : 'danger'}
        icon={TrendingUp}
      />
      <Tile
        label="En riesgo"
        value={atRiskCount.toString()}
        hint={atRiskCount === 0 ? 'todo en verde' : 'margen por debajo de aceptable'}
        tone={atRiskCount === 0 ? 'success' : 'danger'}
        icon={AlertTriangle}
        onClick={atRiskCount > 0 ? onJumpAtRisk : undefined}
      />
      <Tile
        label="Sin política definida"
        value={withoutPolicyCount.toString()}
        hint={withoutPolicyCount === 0 ? 'catálogo cubierto' : 'sin objetivo de margen'}
        tone={withoutPolicyCount === 0 ? 'success' : 'warning'}
        icon={Sparkles}
        onClick={withoutPolicyCount > 0 ? onJumpWithoutPolicy : undefined}
      />
      <Tile
        label="Costo subió recientemente"
        value={costDriftCount === 0 ? '—' : costDriftCount.toString()}
        hint={costDriftCount === 0 ? 'detección próximamente' : 'precio no se ha ajustado'}
        tone={costDriftCount === 0 ? 'neutral' : 'warning'}
        icon={Flame}
        onClick={costDriftCount > 0 ? onJumpCostDrift : undefined}
      />
    </div>
  )
}
