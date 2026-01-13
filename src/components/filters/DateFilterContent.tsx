import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { useState } from 'react'
import { FilterPopoverHeader, FilterPopoverFooter } from './FilterPill'

type DateOperator = 'last' | 'before' | 'after' | 'between' | 'on'
type DateUnit = 'hours' | 'days' | 'weeks' | 'months'

export interface DateFilter {
  operator: DateOperator
  value: number | string | null // number for "last X", string for specific dates
  value2?: string | null // For "between" operator (end date)
  unit?: DateUnit // For "last X" operator
}

interface DateFilterContentProps {
  title: string
  currentFilter: DateFilter | null
  onApply: (filter: DateFilter | null) => void
  onClose?: () => void
  timezone?: string
  showTimezone?: boolean
  labels?: {
    inTheLast?: string
    before?: string
    after?: string
    between?: string
    on?: string
    hours?: string
    days?: string
    weeks?: string
    months?: string
    and?: string
    apply?: string
    clear?: string
    timezone?: string
  }
}

const defaultLabels = {
  inTheLast: 'está en los últimos',
  before: 'es antes de',
  after: 'es después de',
  between: 'está entre',
  on: 'es en',
  hours: 'horas',
  days: 'días',
  weeks: 'semanas',
  months: 'meses',
  and: 'y',
  apply: 'Aplicar',
  clear: 'Limpiar',
  timezone: 'Zona horaria',
}

/**
 * Date/time filter content for date range filters.
 * Stripe-style "está en los últimos X días".
 */
export function DateFilterContent({
  title,
  currentFilter,
  onApply,
  onClose,
  timezone = 'America/Mexico_City',
  showTimezone = true,
  labels: customLabels,
}: DateFilterContentProps) {
  const labels = { ...defaultLabels, ...customLabels }

  const [operator, setOperator] = useState<DateOperator>(currentFilter?.operator || 'last')
  const [value, setValue] = useState<string>(currentFilter?.value?.toString() || '7')
  const [value2, setValue2] = useState<string>(currentFilter?.value2 || '')
  const [unit, setUnit] = useState<DateUnit>(currentFilter?.unit || 'days')
  const [useLocalTimezone, setUseLocalTimezone] = useState(true)

  // Get timezone abbreviation
  const getTimezoneAbbr = () => {
    try {
      const formatter = new Intl.DateTimeFormat('es', {
        timeZone: timezone,
        timeZoneName: 'short',
      })
      const parts = formatter.formatToParts(new Date())
      return parts.find(p => p.type === 'timeZoneName')?.value || timezone
    } catch {
      return timezone
    }
  }

  const handleApply = () => {
    if (operator === 'last') {
      const numValue = value ? parseInt(value) : null
      if (numValue === null || numValue <= 0) {
        onApply(null)
      } else {
        onApply({
          operator,
          value: numValue,
          unit,
        })
      }
    } else if (operator === 'between') {
      if (!value || !value2) {
        onApply(null)
      } else {
        onApply({
          operator,
          value,
          value2,
        })
      }
    } else {
      if (!value) {
        onApply(null)
      } else {
        onApply({
          operator,
          value,
        })
      }
    }
    onClose?.()
  }

  const handleClear = () => {
    setOperator('last')
    setValue('7')
    setValue2('')
    setUnit('days')
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />

      <div className="p-3 space-y-4">
        {/* Operator selector */}
        <Select value={operator} onValueChange={(v: DateOperator) => setOperator(v)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="last">{labels.inTheLast}</SelectItem>
            <SelectItem value="after">{labels.after}</SelectItem>
            <SelectItem value="before">{labels.before}</SelectItem>
            <SelectItem value="between">{labels.between}</SelectItem>
            <SelectItem value="on">{labels.on}</SelectItem>
          </SelectContent>
        </Select>

        {/* Value input based on operator */}
        {operator === 'last' ? (
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-muted-foreground">↳</span>
              <Input
                type="number"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="h-9 w-20"
                min={1}
              />
              <Select value={unit} onValueChange={(v: DateUnit) => setUnit(v)}>
                <SelectTrigger className="h-9 flex-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hours">{labels.hours}</SelectItem>
                  <SelectItem value="days">{labels.days}</SelectItem>
                  <SelectItem value="weeks">{labels.weeks}</SelectItem>
                  <SelectItem value="months">{labels.months}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        ) : operator === 'between' ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">↳</span>
              <Input
                type="date"
                value={value}
                onChange={e => setValue(e.target.value)}
                className="h-9 flex-1"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground text-sm pl-5">{labels.and}</span>
              <Input
                type="date"
                value={value2}
                onChange={e => setValue2(e.target.value)}
                className="h-9 flex-1"
              />
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">↳</span>
            <Input
              type="date"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="h-9 flex-1"
            />
          </div>
        )}

        {/* Timezone selector */}
        {showTimezone && operator === 'last' && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">{labels.timezone}:</p>
            <RadioGroup
              value={useLocalTimezone ? 'local' : 'utc'}
              onValueChange={v => setUseLocalTimezone(v === 'local')}
              className="flex items-center gap-4"
            >
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="local" id="tz-local" />
                <Label htmlFor="tz-local" className="text-sm font-normal cursor-pointer">
                  {getTimezoneAbbr()}
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                <RadioGroupItem value="utc" id="tz-utc" />
                <Label htmlFor="tz-utc" className="text-sm font-normal cursor-pointer">
                  UTC
                </Label>
              </div>
            </RadioGroup>
          </div>
        )}
      </div>

      <FilterPopoverFooter
        onApply={handleApply}
        onClear={handleClear}
        applyLabel={labels.apply}
        clearLabel={labels.clear}
        showClear={!!value}
      />
    </div>
  )
}
