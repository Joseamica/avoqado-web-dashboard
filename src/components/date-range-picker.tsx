import React, { type FC, useState, useEffect, useRef, useCallback } from 'react'
import { Button } from './ui/button'
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover'
import { Calendar } from './ui/calendar'
import { DateInput } from './date-input'
import { Label } from './ui/label'

import { Switch } from './ui/switch'

import { cn } from '@/lib/utils'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select'
import { CheckIcon, ChevronDownIcon, ChevronUpIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { getToday, getYesterday, getLast7Days, getLast30Days } from '@/utils/datetime'
import { useAuth } from '@/context/AuthContext'
import { DateTime } from 'luxon'
import { getIntlLocale, getDateFnsLocale } from '@/utils/i18n-locale'
import { diaDelNegocio, instantesDelNegocio, mismoDia, mismoRango } from './fechasDelSelector'

export interface DateRangePickerProps {
  /** Click handler for applying the updates from DateRangePicker. */
  onUpdate?: (values: { range: DateRange; rangeCompare?: DateRange }) => void
  /** Initial value for start date */
  initialDateFrom?: Date | string
  /** Initial value for end date */
  initialDateTo?: Date | string
  /** Initial value for start date for compare */
  initialCompareFrom?: Date | string
  /** Initial value for end date for compare */
  initialCompareTo?: Date | string
  /** Alignment of popover */
  align?: 'start' | 'center' | 'end'
  /** Option for locale */
  locale?: string
  /** Option for showing compare feature */
  showCompare?: boolean
}

const formatDate = (date: Date, locale: string = 'en-US'): string => {
  // Compact 2-digit-year format ("20 may 25") so the trigger fits inside the table tab.
  return DateTime.fromJSDate(date).setLocale(getIntlLocale(locale)).toFormat('d LLL yy')
}

// Lo que llega de la pantalla, como DÍA del calendario: un 'YYYY-MM-DD' ya es un día; un instante es el día del negocio.
const getDateAdjustedForTimezone = (dateInput: Date | string, timezone: string): Date => {
  if (typeof dateInput === 'string') {
    // Split the date string to get year, month, and day parts
    const parts = dateInput.split('-').map(part => parseInt(part, 10))
    // Create a new Date object using the local timezone
    // Note: Month is 0-indexed, so subtract 1 from the month part
    const date = new Date(parts[0], parts[1] - 1, parts[2])
    return date
  } else {
    return diaDelNegocio(dateInput, timezone)
  }
}

interface DateRange {
  from: Date
  to: Date | undefined
}

interface Preset {
  name: string
  label: string
}

// Define presets
const PRESETS: Preset[] = [
  { name: 'today', label: 'today' },
  { name: 'yesterday', label: 'yesterday' },
  { name: 'last7', label: 'last7' },
  { name: 'last14', label: 'last14' },
  { name: 'last30', label: 'last30' },
  { name: 'last365', label: 'last365' },
  { name: 'thisWeek', label: 'thisWeek' },
  { name: 'lastWeek', label: 'lastWeek' },
  { name: 'thisMonth', label: 'thisMonth' },
  { name: 'lastMonth', label: 'lastMonth' },
  { name: 'thisYear', label: 'thisYear' },
  { name: 'lastYear', label: 'lastYear' },
  { name: 'allTime', label: 'allTime' },
]

/** The DateRangePicker component allows a user to select a range of dates */
export const DateRangePicker: FC<DateRangePickerProps> & {
  filePath: string
} = ({
  initialDateFrom,
  initialDateTo,
  initialCompareFrom,
  initialCompareTo,
  onUpdate,
  align = 'end',
  locale,
  showCompare = true,
}): JSX.Element => {
  const { t, i18n } = useTranslation()
  const { activeVenue } = useAuth()
  const venueTimezone = activeVenue?.timezone || 'America/Mexico_City'
  // Resolve locale from i18n when not explicitly provided so day names and
  // formatted dates match the user's current language.
  const resolvedLocale = locale ?? getIntlLocale(i18n.language)
  const dateFnsLocale = getDateFnsLocale(i18n.language)
  const [isOpen, setIsOpen] = useState(false)

  // Default to "today" in venue timezone if no initial date provided
  const defaultFrom = initialDateFrom ?? getToday(venueTimezone).from
  const defaultTo = initialDateTo ?? initialDateFrom ?? getToday(venueTimezone).to

  // 🔴 `range` y `rangeCompare` guardan DÍAS del calendario (medianoche del navegador), nunca instantes: se pintan tal
  // cual y se vuelven instantes del negocio sólo al avisarle a la pantalla (D1).
  const [range, setRange] = useState<DateRange>({
    from: getDateAdjustedForTimezone(defaultFrom, venueTimezone),
    to: getDateAdjustedForTimezone(defaultTo, venueTimezone),
  })
  const [rangeCompare, setRangeCompare] = useState<DateRange | undefined>(
    initialCompareFrom
      ? {
          from: getDateAdjustedForTimezone(initialCompareFrom, venueTimezone),
          to: getDateAdjustedForTimezone(initialCompareTo ?? initialCompareFrom, venueTimezone),
        }
      : undefined,
  )

  // Refs to store the values of range and rangeCompare when the date picker is opened
  const openedRangeRef = useRef<DateRange | undefined>()
  const openedRangeCompareRef = useRef<DateRange | undefined>()
  const prevIsOpenRef = useRef(isOpen)

  const [selectedPreset, setSelectedPreset] = useState<string | undefined>(undefined)

  const [isSmallScreen, setIsSmallScreen] = useState(typeof window !== 'undefined' ? window.innerWidth < 960 : false)

  // Refs for focus management
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const handleResize = (): void => {
      setIsSmallScreen(window.innerWidth < 960)
    }

    window.addEventListener('resize', handleResize)

    // Clean up event listener on unmount
    return () => {
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  const getPresetRange = (presetName: string, timezone: string): DateRange => {
    const preset = PRESETS.find(({ name }) => name === presetName)
    if (!preset) throw new Error(`Unknown date range preset: ${presetName}`)

    const now = DateTime.now().setZone(timezone)

    switch (preset.name) {
      case 'today': {
        const range = getToday(timezone)
        return { from: range.from, to: range.to }
      }
      case 'yesterday': {
        const range = getYesterday(timezone)
        return { from: range.from, to: range.to }
      }
      case 'last7': {
        const range = getLast7Days(timezone)
        return { from: range.from, to: range.to }
      }
      case 'last14': {
        const fourteenDaysAgo = now.minus({ days: 14 })
        return {
          from: fourteenDaysAgo.toJSDate(),
          to: now.toJSDate(),
        }
      }
      case 'last30': {
        const range = getLast30Days(timezone)
        return { from: range.from, to: range.to }
      }
      case 'last365': {
        // Last 365 days ending today. Use the same start-of-day / end-of-day
        // semantics as the other rolling presets so timezone math stays consistent.
        const startOfRange = now.minus({ days: 365 }).startOf('day')
        const endOfRange = now.endOf('day')
        return {
          from: startOfRange.toJSDate(),
          to: endOfRange.toJSDate(),
        }
      }
      case 'thisWeek': {
        // Calendar week (Monday-Sunday)
        const startOfWeek = now.startOf('week')
        const endOfWeek = now.endOf('week')
        return {
          from: startOfWeek.toJSDate(),
          to: endOfWeek.toJSDate(),
        }
      }
      case 'lastWeek': {
        // Previous calendar week
        const lastWeekStart = now.minus({ weeks: 1 }).startOf('week')
        const lastWeekEnd = now.minus({ weeks: 1 }).endOf('week')
        return {
          from: lastWeekStart.toJSDate(),
          to: lastWeekEnd.toJSDate(),
        }
      }
      case 'thisMonth': {
        // Calendar month
        const startOfMonth = now.startOf('month')
        const endOfMonth = now.endOf('month')
        return {
          from: startOfMonth.toJSDate(),
          to: endOfMonth.toJSDate(),
        }
      }
      case 'lastMonth': {
        // Previous calendar month
        const lastMonthStart = now.minus({ months: 1 }).startOf('month')
        const lastMonthEnd = now.minus({ months: 1 }).endOf('month')
        return {
          from: lastMonthStart.toJSDate(),
          to: lastMonthEnd.toJSDate(),
        }
      }
      case 'thisYear': {
        // Calendar year
        const startOfYear = now.startOf('year')
        const endOfYear = now.endOf('year')
        return {
          from: startOfYear.toJSDate(),
          to: endOfYear.toJSDate(),
        }
      }
      case 'lastYear': {
        // Previous calendar year
        const lastYearStart = now.minus({ years: 1 }).startOf('year')
        const lastYearEnd = now.minus({ years: 1 }).endOf('year')
        return {
          from: lastYearStart.toJSDate(),
          to: lastYearEnd.toJSDate(),
        }
      }
      case 'allTime': {
        // "All time" — use a far-past date as start so every record is included
        const allTimeStart = DateTime.fromObject({ year: 2000, month: 1, day: 1 }, { zone: timezone }).startOf('day')
        return {
          from: allTimeStart.toJSDate(),
          to: now.endOf('day').toJSDate(),
        }
      }
      default: {
        // Fallback to today
        const range = getToday(timezone)
        return { from: range.from, to: range.to }
      }
    }
  }

  const setPreset = (preset: string): void => {
    // Los atajos ya traen instantes del negocio: la pantalla los recibe tal cual y el calendario pinta sus días.
    const range = getPresetRange(preset, venueTimezone)
    const dias = { from: diaDelNegocio(range.from, venueTimezone), to: range.to && diaDelNegocio(range.to, venueTimezone) }
    setRange(dias)

    let updatedRangeCompare = rangeCompare
    if (rangeCompare) {
      updatedRangeCompare = {
        from: new Date(dias.from.getFullYear() - 1, dias.from.getMonth(), dias.from.getDate()),
        to: dias.to ? new Date(dias.to.getFullYear() - 1, dias.to.getMonth(), dias.to.getDate()) : undefined,
      }
      setRangeCompare(updatedRangeCompare)
    }

    // Auto-apply preset selection (don't wait for "Apply" button)
    setIsOpen(false)
    onUpdate?.({ range, rangeCompare: updatedRangeCompare && instantesDelNegocio(updatedRangeCompare, venueTimezone) })
  }

  const checkPreset = useCallback((): void => {
    for (const preset of PRESETS) {
      const presetRange = getPresetRange(preset.name, venueTimezone)

      // Se comparan DÍAS del negocio: `range` ya los guarda así y el atajo trae instantes.
      if (
        mismoDia(range.from, diaDelNegocio(presetRange.from, venueTimezone)) &&
        mismoDia(range.to, presetRange.to && diaDelNegocio(presetRange.to, venueTimezone))
      ) {
        setSelectedPreset(preset.name)
        return
      }
    }

    setSelectedPreset(undefined)
  }, [range, setSelectedPreset, venueTimezone])

  const resetValues = (): void => {
    setRange({
      from: getDateAdjustedForTimezone(defaultFrom, venueTimezone),
      to: getDateAdjustedForTimezone(defaultTo, venueTimezone),
    })
    setRangeCompare(
      initialCompareFrom
        ? {
            from: getDateAdjustedForTimezone(initialCompareFrom, venueTimezone),
            to: getDateAdjustedForTimezone(initialCompareTo ?? initialCompareFrom, venueTimezone),
          }
        : undefined,
    )
  }

  // Sync props to internal state ONLY when popover is closed
  // This allows external buttons (Hoy, Últimos 7 días) to update the display
  // while NOT interfering with manual date selection when popover is open
  useEffect(() => {
    if (!isOpen) {
      const newFrom = getDateAdjustedForTimezone(defaultFrom, venueTimezone)
      const newTo = getDateAdjustedForTimezone(defaultTo, venueTimezone)

      // Only update if dates actually changed (avoid unnecessary re-renders)
      if (range.from.getTime() !== newFrom.getTime() || range.to?.getTime() !== newTo.getTime()) {
        setRange({
          from: newFrom,
          to: newTo,
        })
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialDateFrom, initialDateTo, isOpen, venueTimezone])

  useEffect(() => {
    checkPreset()
  }, [range, checkPreset])

  // Save initial values ONLY when popover opens (not while it's open)
  // This ensures "Apply" button can detect changes made by the user
  useEffect(() => {
    if (isOpen && !prevIsOpenRef.current) {
      // Popover just opened - save the current values
      openedRangeRef.current = range
      openedRangeCompareRef.current = rangeCompare
    }
    prevIsOpenRef.current = isOpen
  }, [isOpen, range, rangeCompare])

  const PresetButton = ({ preset, label, isSelected }: { preset: string; label: string; isSelected: boolean }): JSX.Element => (
    <Button
      className={cn(isSelected && 'pointer-events-none')}
      variant="ghost"
      onClick={() => {
        setPreset(preset)
      }}
    >
      <>
        <span className={cn('pr-2 opacity-0', isSelected && 'opacity-70')}>
          <CheckIcon width={18} height={18} />
        </span>
        {label}
      </>
    </Button>
  )

  // Helper to focus the first focusable element within the popover
  const focusFirstInPopover = (): void => {
    const el = contentRef.current?.querySelector<HTMLElement>('input, button, [tabindex]:not([tabindex="-1"])')
    if (el) {
      el.focus({ preventScroll: true })
    }
  }

  return (
    <Popover
      modal={false}
      open={isOpen}
      onOpenChange={(open: boolean) => {
        if (!open) {
          resetValues()
        }
        setIsOpen(open)
      }}
    >
      <PopoverTrigger asChild>
        <Button ref={triggerRef} size="sm" variant="outline" className="h-7 gap-1.5 rounded-full px-3 text-xs font-normal">
          <span className="whitespace-nowrap">
            {`${formatDate(range.from, resolvedLocale)}${range.to != null ? ' – ' + formatDate(range.to, resolvedLocale) : ''}`}
          </span>
          {rangeCompare != null && (
            <span className="opacity-60 text-[10px]">
              vs. {formatDate(rangeCompare.from, resolvedLocale)}
              {rangeCompare.to != null ? ` – ${formatDate(rangeCompare.to, resolvedLocale)}` : ''}
            </span>
          )}
          {isOpen ? <ChevronUpIcon className="h-3 w-3 opacity-60" /> : <ChevronDownIcon className="h-3 w-3 opacity-60" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        ref={contentRef}
        align={align}
        className="w-auto"
        // Prevent focus from escaping to the trigger prematurely
        onFocusCapture={e => e.stopPropagation()}
        onOpenAutoFocus={e => {
          // Prevent Radix default focusing to avoid retaining focus on trigger during aria-hidden application
          e.preventDefault()
          // Defer to ensure content is fully mounted before focusing
          setTimeout(() => {
            focusFirstInPopover()
          }, 0)
        }}
        onCloseAutoFocus={e => {
          // Prevent default to control where focus returns
          e.preventDefault()
          // Restore focus back to the trigger button
          triggerRef.current?.focus({ preventScroll: true })
        }}
      >
        <div className="flex py-2">
          <div className="flex">
            <div className="flex flex-col">
              <div className="flex flex-col lg:flex-row gap-2 px-3 justify-end items-center lg:items-start pb-4 lg:pb-0">
                {showCompare && (
                  <div className="flex items-center space-x-2 pr-4 py-1">
                    <Switch
                      defaultChecked={Boolean(rangeCompare)}
                      onCheckedChange={(checked: boolean) => {
                        if (checked) {
                          if (!range.to) {
                            setRange({
                              from: range.from,
                              to: range.from,
                            })
                          }
                          setRangeCompare({
                            from: new Date(range.from.getFullYear(), range.from.getMonth(), range.from.getDate() - 365),
                            to: range.to
                              ? new Date(range.to.getFullYear() - 1, range.to.getMonth(), range.to.getDate())
                              : new Date(range.from.getFullYear() - 1, range.from.getMonth(), range.from.getDate()),
                          })
                        } else {
                          setRangeCompare(undefined)
                        }
                      }}
                      id="compare-mode"
                    />
                    <Label htmlFor="compare-mode">{t('compare')}</Label>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-2">
                    <DateInput
                      value={range.from}
                      onChange={date => {
                        const toDate = range.to == null || date > range.to ? date : range.to
                        setRange(prevRange => ({
                          ...prevRange,
                          from: date,
                          to: toDate,
                        }))
                      }}
                    />
                    <div className="py-1">-</div>
                    <DateInput
                      value={range.to}
                      onChange={date => {
                        const fromDate = date < range.from ? date : range.from
                        setRange(prevRange => ({
                          ...prevRange,
                          from: fromDate,
                          to: date,
                        }))
                      }}
                    />
                  </div>
                  {rangeCompare != null && (
                    <div className="flex gap-2">
                      <DateInput
                        value={rangeCompare?.from}
                        onChange={date => {
                          if (rangeCompare) {
                            const compareToDate = rangeCompare.to == null || date > rangeCompare.to ? date : rangeCompare.to
                            setRangeCompare(prevRangeCompare => ({
                              ...prevRangeCompare,
                              from: date,
                              to: compareToDate,
                            }))
                          } else {
                            setRangeCompare({
                              from: date,
                              to: new Date(),
                            })
                          }
                        }}
                      />
                      <div className="py-1">-</div>
                      <DateInput
                        value={rangeCompare?.to}
                        onChange={date => {
                          if (rangeCompare && rangeCompare.from) {
                            const compareFromDate = date < rangeCompare.from ? date : rangeCompare.from
                            setRangeCompare({
                              ...rangeCompare,
                              from: compareFromDate,
                              to: date,
                            })
                          }
                        }}
                      />
                    </div>
                  )}
                </div>
              </div>
              {isSmallScreen && (
                <Select
                  defaultValue={selectedPreset}
                  onValueChange={value => {
                    setPreset(value)
                  }}
                >
                  <SelectTrigger className="w-[180px] mx-auto mb-2">
                    <SelectValue placeholder={t('selectPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {PRESETS.map(preset => (
                      <SelectItem key={preset.name} value={preset.name}>
                        {t(`dateRange.${preset.name}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div>
                <Calendar
                  mode="range"
                  onSelect={(value: { from?: Date; to?: Date } | undefined) => {
                    if (value?.from != null) {
                      setRange({ from: value.from, to: value?.to })
                    }
                  }}
                  selected={range}
                  numberOfMonths={isSmallScreen ? 1 : 2}
                  defaultMonth={new Date(new Date().setMonth(new Date().getMonth() - (isSmallScreen ? 0 : 1)))}
                  locale={dateFnsLocale}
                />
              </div>
            </div>
          </div>
          {!isSmallScreen && (
            <div className="flex flex-col items-end gap-1 pr-2 pl-6 pb-6">
              <div className="flex w-full flex-col items-end gap-1 pr-2 pl-6 pb-6">
                {PRESETS.map(preset => (
                  <PresetButton
                    key={preset.name}
                    preset={preset.name}
                    label={t(`dateRange.${preset.name}`)}
                    isSelected={selectedPreset === preset.name}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="flex justify-end gap-2 py-2 pr-4">
          <Button
            onClick={() => {
              setIsOpen(false)
              resetValues()
            }}
            variant="ghost"
          >
            {t('cancel')}
          </Button>
          <Button
            onClick={() => {
              setIsOpen(false)
              if (!mismoRango(range, openedRangeRef.current) || !mismoRango(rangeCompare, openedRangeCompareRef.current)) {
                // Los días elegidos se vuelven instantes del negocio: del inicio del primero al final del último.
                onUpdate?.({
                  range: instantesDelNegocio(range, venueTimezone),
                  rangeCompare: rangeCompare && instantesDelNegocio(rangeCompare, venueTimezone),
                })
              }
            }}
          >
            {t('apply')}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

DateRangePicker.displayName = 'DateRangePicker'
DateRangePicker.filePath = 'libs/shared/ui-kit/src/lib/date-range-picker/date-range-picker.tsx'
