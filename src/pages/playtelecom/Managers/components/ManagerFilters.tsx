/**
 * ManagerFilters - Period, validation status, and store dropdown filters
 */

import { useTranslation } from 'react-i18next'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Calendar, ShieldCheck, Store } from 'lucide-react'

export interface ManagerFilterValues {
  period: string
  state: string
  store: string
}

interface ManagerFiltersProps {
  values: ManagerFilterValues
  onChange: (key: keyof ManagerFilterValues, value: string) => void
  stores: Array<{ id: string; name: string }>
}

export function ManagerFilters({ values, onChange, stores }: ManagerFiltersProps) {
  const { t } = useTranslation('playtelecom')

  return (
    <div className="flex gap-3">
      {/* Period */}
      <div className="flex items-center gap-2 bg-card border border-border/50 rounded-lg px-3 py-1.5">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <Select value={values.period} onValueChange={(v) => onChange('period', v)}>
          <SelectTrigger className="border-0 bg-transparent h-7 text-xs font-semibold w-[120px] p-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="today">{t('managers.filters.today', { defaultValue: 'Hoy' })}</SelectItem>
            <SelectItem value="week">{t('managers.filters.thisWeek', { defaultValue: 'Esta Semana' })}</SelectItem>
            <SelectItem value="month">{t('managers.filters.thisMonth', { defaultValue: 'Este Mes' })}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Validation Status */}
      <div className="flex items-center gap-2 bg-card border border-primary/30 hover:border-primary rounded-lg px-3 py-1.5 transition-colors">
        <ShieldCheck className="w-4 h-4 text-primary" />
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">
            {t('managers.filters.status', { defaultValue: 'Estado' })}
          </span>
          <Select value={values.state} onValueChange={(v) => onChange('state', v)}>
            <SelectTrigger className="border-0 bg-transparent h-5 text-xs font-semibold w-[100px] p-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('managers.filters.all', { defaultValue: 'Todos' })}</SelectItem>
              <SelectItem value="PENDING">{t('managers.filters.pending', { defaultValue: 'Pendiente' })}</SelectItem>
              <SelectItem value="APPROVED">{t('managers.filters.approved', { defaultValue: 'Aprobado' })}</SelectItem>
              <SelectItem value="REJECTED">{t('managers.filters.rejected', { defaultValue: 'Rechazado' })}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Store */}
      <div className="flex items-center gap-2 bg-card border border-primary/30 hover:border-primary rounded-lg px-3 py-1.5 transition-colors">
        <Store className="w-4 h-4 text-primary" />
        <div className="flex flex-col">
          <span className="text-[8px] font-bold text-muted-foreground uppercase leading-none">
            {t('managers.filters.store', { defaultValue: 'Tienda' })}
          </span>
          <Select value={values.store} onValueChange={(v) => onChange('store', v)}>
            <SelectTrigger className="border-0 bg-transparent h-5 text-xs font-semibold w-[130px] p-0">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('managers.filters.allStores', { defaultValue: 'Todas' })}</SelectItem>
              {stores.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  )
}
