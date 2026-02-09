/**
 * ManagerCharts - 3 charts: Sales by SIM type (bar), Goal progress bars, 7-day sales (bar)
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Store, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface SalesBySIMType {
  label: string
  value: number
  color: string
}

export interface GoalProgress {
  id: string
  storeName: string
  percent: number
  barPercent: number
  color: string
  hasGoal: boolean
  goalId?: string | null
  goalAmount: number
  goalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY'
  amount: number
}

export interface DailySales {
  day: string
  value: number
  isHighlight?: boolean
}

interface ManagerChartsProps {
  salesBySIM: SalesBySIMType[]
  goals: GoalProgress[]
  dailySales: DailySales[]
  formatCurrency?: (value: number) => string
  onCreateGoal?: () => void
  onEditGoal?: (storeId: string, goalId?: string | null, goalAmount?: number, goalPeriod?: 'DAILY' | 'WEEKLY' | 'MONTHLY') => void
}

export function ManagerCharts({ salesBySIM, goals, dailySales, formatCurrency, onCreateGoal, onEditGoal }: ManagerChartsProps) {
  const { t } = useTranslation('playtelecom')

  const maxSIM = Math.max(...salesBySIM.map(s => s.value), 1)
  const maxDaily = Math.max(...dailySales.map(d => d.value), 1)
  const fmt = formatCurrency ?? ((v: number) => `$${v.toLocaleString()}`)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* Sales by SIM type */}
      <GlassCard className="p-5 flex flex-col">
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">
          {t('managers.charts.salesBySIM', { defaultValue: 'Ventas por Tipo SIM' })}
        </h4>
        {salesBySIM.length > 0 ? (
          <div className="flex-1 flex items-end justify-around gap-4 min-h-[140px]">
            {salesBySIM.map((item, i) => (
              <div key={i} className="flex flex-col items-center w-full h-full justify-end group">
                <div className="text-[10px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition">
                  {item.value} un.
                </div>
                <div
                  className="w-full rounded-t transition-all hover:opacity-80"
                  style={{
                    height: `${(item.value / maxSIM) * 100}%`,
                    backgroundColor: item.color,
                    minHeight: '4px',
                  }}
                />
                <span
                  className="text-[10px] mt-2 font-bold max-w-full truncate"
                  style={{ color: item.color }}
                  title={item.label}
                >
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground">
            <Store className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">{t('managers.charts.noSIMData', { defaultValue: 'Sin datos de stock' })}</p>
          </div>
        )}
      </GlassCard>

      {/* Goal progress */}
      <GlassCard className="p-5 flex flex-col justify-center">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-xs font-bold text-muted-foreground uppercase">
            {t('managers.charts.goalProgress', { defaultValue: 'Cumplimiento de Metas' })}
          </h4>
          {onCreateGoal && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[10px] text-green-400 hover:text-green-300 hover:bg-green-500/10"
              onClick={onCreateGoal}
            >
              <Plus className="w-3 h-3 mr-1" />
              {t('managers.charts.createGoal', { defaultValue: 'Asignar Meta' })}
            </Button>
          )}
        </div>
        {goals.length > 0 ? (
          <div className="space-y-6">
            {goals.map((goal, i) => (
              <div key={i} className="group/goal relative">
                <div className="flex justify-between text-xs mb-1 gap-2">
                  <span className="font-medium truncate min-w-0">{goal.storeName}</span>
                  {goal.hasGoal ? (
                    <>
                      <button
                        type="button"
                        className={cn(
                          'font-bold shrink-0 group-hover/goal:hidden cursor-pointer hover:underline',
                          goal.percent >= 70 ? 'text-green-400' : 'text-amber-400',
                        )}
                        onClick={() => onEditGoal?.(goal.id, goal.goalId, goal.goalAmount, goal.goalPeriod)}
                      >
                        {goal.percent}%
                      </button>
                      <span className="hidden group-hover/goal:inline text-[10px] font-bold shrink-0 text-foreground">
                        {fmt(goal.amount)} / {fmt(goal.goalAmount)}
                      </span>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        className="text-muted-foreground shrink-0 text-[10px] group-hover/goal:hidden cursor-pointer hover:text-green-400 hover:underline"
                        onClick={() => onEditGoal?.(goal.id)}
                      >
                        {t('managers.charts.noGoal', { defaultValue: 'Sin meta' })}
                      </button>
                      <span className="hidden group-hover/goal:inline text-[10px] font-bold shrink-0 text-foreground">
                        {fmt(goal.amount)}
                      </span>
                    </>
                  )}
                </div>
                <div className="h-3 bg-muted rounded-full overflow-hidden relative">
                  <div className={cn('h-full rounded-full transition-all', goal.color)} style={{ width: `${goal.barPercent}%` }} />
                  {goal.hasGoal && <div className="absolute top-0 bottom-0 w-[2px] bg-foreground/30" style={{ left: '90%' }} />}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground min-h-[100px]">
            <Store className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">{t('managers.charts.noGoalData', { defaultValue: 'Sin metas configuradas' })}</p>
          </div>
        )}
      </GlassCard>

      {/* 7-day sales */}
      <GlassCard className="p-5 flex flex-col">
        <h4 className="text-xs font-bold text-muted-foreground uppercase mb-4">
          {t('managers.charts.last7Days', { defaultValue: 'Ventas: Ultimos 7 Dias' })}
        </h4>
        {dailySales.length > 0 ? (
          <>
            <div className="flex-1 flex items-end justify-between gap-2 min-h-[140px]">
              {dailySales.map((day, i) => (
                <div key={i} className="w-full h-full flex flex-col items-center justify-end group">
                  <div className="text-[10px] font-bold mb-1 opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {fmt(day.value)}
                  </div>
                  <div
                    className={cn(
                      'w-full rounded-t-sm transition-colors',
                      day.isHighlight
                        ? 'bg-green-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]'
                        : 'bg-muted-foreground/30 group-hover:bg-green-500'
                    )}
                    style={{ height: `${(day.value / maxDaily) * 100}%`, minHeight: '4px' }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2 text-[10px] text-muted-foreground font-bold uppercase">
              {dailySales.map((day, i) => (
                <span key={i} className={cn(day.isHighlight && 'text-green-400')}>
                  {day.day}
                </span>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground min-h-[140px]">
            <Store className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-xs">{t('managers.charts.noSalesData', { defaultValue: 'Sin ventas registradas' })}</p>
          </div>
        )}
      </GlassCard>
    </div>
  )
}
