import { Flame, ChevronRight } from 'lucide-react'
import type { DerivedRow } from '../../types/profitability'

interface Props {
  rows: DerivedRow[]
  onJump: () => void
}

export function CostChangeAlertBanner({ rows, onJump }: Props) {
  const drift = rows.filter(r => r.costDrift)
  if (drift.length === 0) return null

  const preview = drift.slice(0, 3).map(r => r.name).join(' · ')
  const more = drift.length > 3 ? ` · +${drift.length - 3} más` : ''

  return (
    <button
      type="button"
      onClick={onJump}
      className="group w-full overflow-hidden rounded-2xl border border-amber-200 dark:border-amber-900/50 bg-gradient-to-r from-amber-50 to-amber-50/30 dark:from-amber-950/40 dark:to-amber-950/10 p-4 text-left transition-all hover:shadow-md hover:border-amber-300 dark:hover:border-amber-800"
    >
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex-none rounded-xl bg-amber-500/15 p-2.5">
            <Flame className="h-5 w-5 text-amber-700 dark:text-amber-400" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              {drift.length} {drift.length === 1 ? 'producto' : 'productos'}: el costo subió y no ajustaste el precio
            </p>
            <p className="text-xs text-amber-800/80 dark:text-amber-400/80 truncate mt-0.5">
              {preview}
              {more}
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 flex-none text-amber-700/70 dark:text-amber-400/70 group-hover:translate-x-1 transition-transform" />
      </div>
    </button>
  )
}
