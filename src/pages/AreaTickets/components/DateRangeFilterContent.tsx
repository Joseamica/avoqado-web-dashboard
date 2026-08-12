import { useId, useState } from 'react'

import { FilterPopoverFooter, FilterPopoverHeader } from '@/components/filters'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export interface DateRangeValue {
  from: string | null
  to: string | null
}

interface DateRangeFilterContentProps {
  title: string
  value: DateRangeValue
  onApply: (value: DateRangeValue) => void
  onClose?: () => void
  labels: { from: string; to: string; apply: string; clear: string }
}

/**
 * Filtro de rango de fecha simple (desde/hasta) para las colas de la ruta externa
 * (§caja externa fase 1, Task 15). A propósito NO reusa `DateFilterContent`
 * (operador "en los últimos N días" / "antes de" / etc.) — estas dos colas son
 * trabajo pendiente, no un reporte por periodo, y el server sólo entiende un rango
 * `dateFrom`/`dateTo` simple. Menos opciones, más fácil de entender de un vistazo.
 */
export function DateRangeFilterContent({ title, value, onApply, onClose, labels }: DateRangeFilterContentProps) {
  const fromId = useId()
  const toId = useId()
  const [from, setFrom] = useState(value.from ?? '')
  const [to, setTo] = useState(value.to ?? '')

  const handleApply = () => {
    onApply({ from: from || null, to: to || null })
    onClose?.()
  }

  const handleClear = () => {
    setFrom('')
    setTo('')
    onApply({ from: null, to: null })
    onClose?.()
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />
      <div className="space-y-3 p-3">
        <div className="space-y-1.5">
          <Label htmlFor={fromId} className="text-xs text-muted-foreground">
            {labels.from}
          </Label>
          <Input id={fromId} type="date" value={from} onChange={event => setFrom(event.target.value)} className="h-9" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={toId} className="text-xs text-muted-foreground">
            {labels.to}
          </Label>
          <Input
            id={toId}
            type="date"
            value={to}
            onChange={event => setTo(event.target.value)}
            min={from || undefined}
            className="h-9"
          />
        </div>
      </div>
      <FilterPopoverFooter onApply={handleApply} onClear={handleClear} applyLabel={labels.apply} clearLabel={labels.clear} showClear={Boolean(from || to)} />
    </div>
  )
}
