import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import { DateTime } from 'luxon'

import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

interface DateRange {
  from: Date
  to: Date
}

type PresetId =
  | 'today'
  | 'yesterday'
  | 'thisWeek'
  | 'lastWeek'
  | 'thisMonth'
  | 'lastMonth'
  | 'thisYear'
  | 'lastYear'
  | 'custom'

interface Preset {
  id: PresetId
  labelKey: string
  /** Compute the range in venue tz; returns Date instants (UTC) */
  build: (tz: string) => DateRange | null
}

const presets: Preset[] = [
  {
    id: 'today',
    labelKey: 'newHome.datePicker.today',
    build: tz => {
      const now = DateTime.now().setZone(tz)
      return { from: now.startOf('day').toJSDate(), to: now.endOf('day').toJSDate() }
    },
  },
  {
    id: 'yesterday',
    labelKey: 'newHome.datePicker.yesterday',
    build: tz => {
      const y = DateTime.now().setZone(tz).minus({ days: 1 })
      return { from: y.startOf('day').toJSDate(), to: y.endOf('day').toJSDate() }
    },
  },
  {
    id: 'thisWeek',
    labelKey: 'newHome.datePicker.thisWeek',
    build: tz => {
      const now = DateTime.now().setZone(tz)
      return { from: now.startOf('week').toJSDate(), to: now.endOf('week').toJSDate() }
    },
  },
  {
    id: 'lastWeek',
    labelKey: 'newHome.datePicker.lastWeek',
    build: tz => {
      const w = DateTime.now().setZone(tz).minus({ weeks: 1 })
      return { from: w.startOf('week').toJSDate(), to: w.endOf('week').toJSDate() }
    },
  },
  {
    id: 'thisMonth',
    labelKey: 'newHome.datePicker.thisMonth',
    build: tz => {
      const now = DateTime.now().setZone(tz)
      return { from: now.startOf('month').toJSDate(), to: now.endOf('month').toJSDate() }
    },
  },
  {
    id: 'lastMonth',
    labelKey: 'newHome.datePicker.lastMonth',
    build: tz => {
      const m = DateTime.now().setZone(tz).minus({ months: 1 })
      return { from: m.startOf('month').toJSDate(), to: m.endOf('month').toJSDate() }
    },
  },
  {
    id: 'thisYear',
    labelKey: 'newHome.datePicker.thisYear',
    build: tz => {
      const now = DateTime.now().setZone(tz)
      return { from: now.startOf('year').toJSDate(), to: now.endOf('year').toJSDate() }
    },
  },
  {
    id: 'lastYear',
    labelKey: 'newHome.datePicker.lastYear',
    build: tz => {
      const y = DateTime.now().setZone(tz).minus({ years: 1 })
      return { from: y.startOf('year').toJSDate(), to: y.endOf('year').toJSDate() }
    },
  },
  {
    id: 'custom',
    labelKey: 'newHome.datePicker.custom',
    build: () => null,
  },
]

const detectActivePreset = (range: DateRange, tz: string): PresetId => {
  const target = (built: DateRange | null) => {
    if (!built) return false
    return Math.abs(built.from.getTime() - range.from.getTime()) < 60_000 && Math.abs(built.to.getTime() - range.to.getTime()) < 60_000
  }
  for (const preset of presets) {
    if (preset.id === 'custom') continue
    if (target(preset.build(tz))) return preset.id
  }
  return 'custom'
}

interface HomeDatePickerProps {
  range: DateRange
  venueTimezone: string
  locale: string
  onChange: (range: DateRange) => void
  /** Optional CSS classes for the trigger button */
  className?: string
}

export function HomeDatePicker({ range, venueTimezone, locale, onChange, className }: HomeDatePickerProps) {
  const { t } = useTranslation('home')
  const [open, setOpen] = useState(false)

  const activePreset = useMemo(() => detectActivePreset(range, venueTimezone), [range, venueTimezone])

  const triggerLabel = useMemo(() => {
    const fromDt = DateTime.fromJSDate(range.from).setZone(venueTimezone).setLocale(locale)
    const toDt = DateTime.fromJSDate(range.to).setZone(venueTimezone).setLocale(locale)
    if (fromDt.hasSame(toDt, 'day')) return fromDt.toFormat('d LLL')
    if (fromDt.hasSame(toDt, 'year')) return `${fromDt.toFormat('d LLL')} – ${toDt.toFormat('d LLL')}`
    return `${fromDt.toFormat('d LLL yyyy')} – ${toDt.toFormat('d LLL yyyy')}`
  }, [range, venueTimezone, locale])

  const calendarSelected = { from: range.from, to: range.to }
  const defaultMonth = range.from

  const applyPreset = (preset: Preset) => {
    const built = preset.build(venueTimezone)
    if (!built) return // 'custom' has no built range; user uses calendar directly
    onChange(built)
    setOpen(false)
  }

  const handleCalendarSelect = (value: { from?: Date; to?: Date } | undefined) => {
    if (!value?.from) return
    const tz = venueTimezone
    const from = DateTime.fromJSDate(value.from).setZone(tz).startOf('day').toJSDate()
    const to = value.to ? DateTime.fromJSDate(value.to).setZone(tz).endOf('day').toJSDate() : DateTime.fromJSDate(value.from).setZone(tz).endOf('day').toJSDate()
    onChange({ from, to })
    if (value.to) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen} modal={false}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn('h-9 cursor-pointer gap-2 rounded-full border-input px-4 text-sm font-normal', className)}
          data-tour="home-performance-date"
        >
          <span className="text-muted-foreground">{t('newHome.datePicker.label')}</span>
          <span className="font-semibold">{triggerLabel}</span>
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-auto rounded-2xl p-0">
        <div className="flex">
          <ul className="flex w-44 flex-col gap-1 border-r border-input p-3">
            {presets.map(preset => {
              const isActive = preset.id === activePreset
              return (
                <li key={preset.id}>
                  <button
                    type="button"
                    onClick={() => applyPreset(preset)}
                    className={cn(
                      'flex w-full cursor-pointer items-center rounded-lg px-3 py-2 text-left text-sm font-medium transition-colors',
                      isActive ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                    )}
                  >
                    {t(preset.labelKey)}
                  </button>
                </li>
              )
            })}
          </ul>
          <div className="p-3">
            <Calendar
              mode="range"
              selected={calendarSelected}
              onSelect={handleCalendarSelect}
              defaultMonth={defaultMonth}
              numberOfMonths={1}
            />
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
