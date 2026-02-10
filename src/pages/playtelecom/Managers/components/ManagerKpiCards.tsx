/**
 * ManagerKpiCards - 4 KPI cards: Store status, Incidents, Stock SIMs, Total in field
 */

import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, DollarSign, Inbox, Clock, Store, User, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CrossStoreAnomaly } from '@/services/storesAnalysis.service'

export interface ManagerKpiData {
  storesOpen: number
  storesClosed: number
  incidents: Array<{
    label: string
    count: number | string
    severity: 'ok' | 'warning' | 'critical'
    anomalyType: CrossStoreAnomaly['type']
  }>
  stockByCategory: Array<{ name: string; count: number; maxCount: number; color: string }>
  totalCashInField: number
  cashCollectedPercent: number
}

interface ManagerKpiCardsProps {
  data: ManagerKpiData
  formatCurrency: (value: number) => string
  anomalies?: CrossStoreAnomaly[]
}

export function ManagerKpiCards({ data, formatCurrency, anomalies = [] }: ManagerKpiCardsProps) {
  const { t } = useTranslation('playtelecom')
  const [selectedType, setSelectedType] = useState<CrossStoreAnomaly['type'] | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)

  const severityColor = (s: string) => {
    if (s === 'ok') return 'bg-green-500/10 text-green-400 border-green-500/20'
    return 'bg-red-500/10 text-red-400 border-red-500/20'
  }

  const severityLabel = (s: string) => {
    if (s === 'CRITICAL') return t('managers.kpi.severityCritical', { defaultValue: 'Critico' })
    if (s === 'WARNING') return t('managers.kpi.severityWarning', { defaultValue: 'Advertencia' })
    return s
  }

  const severityBadgeColor = (s: string) => {
    if (s === 'CRITICAL') return 'bg-red-500/15 text-red-400 border-red-500/30'
    return 'bg-amber-500/15 text-amber-400 border-amber-500/30'
  }

  const selectedLabel = selectedType
    ? data.incidents.find(inc => inc.anomalyType === selectedType)?.label ?? ''
    : ''

  const filteredAnomalies = selectedType
    ? anomalies.filter(a => a.type === selectedType)
    : []

  return (
    <>
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
              <li
                key={i}
                className="flex justify-between items-center text-xs cursor-pointer rounded px-1 -mx-1 py-0.5 hover:bg-muted/50 transition-colors"
                onClick={() => setSelectedType(inc.anomalyType)}
              >
                <span className="underline decoration-dotted underline-offset-2">{inc.label}</span>
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

      {/* Incident Detail Dialog */}
      <Dialog open={!!selectedType} onOpenChange={open => { if (!open) { setSelectedType(null); setExpandedId(null) } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              {selectedLabel}
            </DialogTitle>
          </DialogHeader>
          {filteredAnomalies.length > 0 ? (
            <ul className="space-y-2 max-h-96 overflow-y-auto">
              {filteredAnomalies.map(a => {
                const isExpanded = expandedId === a.id
                return (
                  <li
                    key={a.id}
                    className={cn(
                      'rounded-lg border border-border transition-colors cursor-pointer',
                      isExpanded ? 'bg-muted/30' : 'hover:bg-muted/20'
                    )}
                    onClick={() => setExpandedId(isExpanded ? null : a.id)}
                  >
                    {/* Summary row */}
                    <div className="flex items-center justify-between p-3">
                      <div className="flex items-center gap-2 min-w-0">
                        <Store className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                        <span className="text-sm font-semibold truncate">{a.storeName}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge className={cn('text-[10px] border', severityBadgeColor(a.severity))}>
                          {severityLabel(a.severity)}
                        </Badge>
                        {isExpanded
                          ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
                          : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                        }
                      </div>
                    </div>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="px-3 pb-3 pt-0 space-y-2 border-t border-border/50">
                        <div className="flex items-center gap-2 mt-2">
                          <User className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="text-xs font-medium">{a.description}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                          <span className="text-xs text-muted-foreground">{a.timestamp}</span>
                        </div>
                        {a.title && (
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            <span className="text-xs text-muted-foreground">
                              {t('managers.kpi.incidentType', { defaultValue: 'Tipo' })}: {a.title}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Inbox className="w-10 h-10 mb-2 opacity-40" />
              <p className="text-sm">
                {t('managers.kpi.noIncidents', { defaultValue: 'Sin incidencias de este tipo' })}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
