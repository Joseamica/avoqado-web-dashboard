/**
 * ManagerKpiCards - 4 KPI cards: Store status, Incidents, Stock SIMs, Total in field
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { AlertTriangle, DollarSign } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ManagerKpiData {
  storesOpen: number
  storesClosed: number
  incidents: Array<{ label: string; count: number | string; severity: 'ok' | 'warning' | 'critical' }>
  stockByCategory: Array<{ name: string; count: number; maxCount: number; color: string }>
  totalCashInField: number
  cashCollectedPercent: number
}

interface ManagerKpiCardsProps {
  data: ManagerKpiData
  formatCurrency: (value: number) => string
}

export function ManagerKpiCards({ data, formatCurrency }: ManagerKpiCardsProps) {
  const { t } = useTranslation('playtelecom')

  const severityColor = (s: string) => {
    if (s === 'ok') return 'bg-green-500/10 text-green-400 border-green-500/20'
    if (s === 'warning') return 'bg-amber-500/10 text-amber-400 border-amber-500/20'
    return 'bg-red-500/10 text-red-400 border-red-500/20'
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
      {/* Store Status */}
      <GlassCard className="p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">
          {t('managers.kpi.storeStatus', { defaultValue: 'Estatus Tiendas' })}
        </h3>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <span className="text-2xl font-black text-green-400 block">{data.storesOpen}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">
              {t('managers.kpi.open', { defaultValue: 'Abiertas' })}
            </span>
          </div>
          <div className="h-8 w-px bg-border" />
          <div className="text-center">
            <span className="text-2xl font-black text-red-400 block">{data.storesClosed}</span>
            <span className="text-[10px] text-muted-foreground uppercase font-bold">
              {t('managers.kpi.closed', { defaultValue: 'Cerradas' })}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Incidents */}
      <GlassCard className="p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3 flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
          {t('managers.kpi.incidents', { defaultValue: 'Incidencias' })}
        </h3>
        <ul className="space-y-2">
          {data.incidents.map((inc, i) => (
            <li key={i} className="flex justify-between items-center text-xs">
              <span>{inc.label}</span>
              <span className={cn('px-1.5 py-0.5 rounded font-bold border text-[10px]', severityColor(inc.severity))}>
                {inc.count}
              </span>
            </li>
          ))}
        </ul>
      </GlassCard>

      {/* Stock SIMs */}
      <GlassCard className="p-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase mb-3">
          {t('managers.kpi.stockSims', { defaultValue: 'Stock SIMs' })}
        </h3>
        <div className="space-y-3">
          {data.stockByCategory.map((cat, i) => (
            <div key={i}>
              <div className="flex justify-between text-[10px] font-bold mb-1">
                <span style={{ color: cat.color }}>{cat.name}</span>
                <span style={{ color: cat.color }}>{cat.count} un.</span>
              </div>
              <div className="h-1.5 bg-muted rounded-full">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{
                    width: `${Math.min((cat.count / cat.maxCount) * 100, 100)}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      {/* Total Cash in Field */}
      <GlassCard className="p-5 relative overflow-hidden">
        <DollarSign className="absolute top-2 right-2 w-12 h-12 text-green-500/10" />
        <p className="text-muted-foreground text-[10px] font-bold uppercase tracking-widest mb-1">
          {t('managers.kpi.totalInField', { defaultValue: 'Total en Calle' })}
        </p>
        <h3 className="text-3xl font-black tracking-tight">{formatCurrency(data.totalCashInField)}</h3>
        <div className="flex items-center gap-2 mt-2">
          <span className="text-[10px] bg-green-500/10 text-green-400 px-2 rounded border border-green-500/20 font-bold">
            {data.cashCollectedPercent}% {t('managers.kpi.collected', { defaultValue: 'Recaudado' })}
          </span>
        </div>
      </GlassCard>
    </div>
  )
}
