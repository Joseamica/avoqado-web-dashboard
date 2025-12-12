import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateRangePicker } from '@/components/date-range-picker'
import { DateTime } from 'luxon'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Outlet, useSearchParams } from 'react-router-dom'

const compares = ['previous_period', 'previous_year'] as const

export default function AnalyticsLayout() {
  const [sp, setSp] = useSearchParams()
  const compareTo = (sp.get('compareTo') as any) || 'previous_period'
  const from = sp.get('from') || undefined
  const to = sp.get('to') || undefined
  const fromCompare = sp.get('fromCompare') || undefined
  const toCompare = sp.get('toCompare') || undefined
  const { t, i18n } = useTranslation('analytics')
  const { venue } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'

  const onChange = (key: string, val: string) => {
    const next = new URLSearchParams(sp)
    next.set(key, val)
    setSp(next, { replace: true })
  }

  const lastRefreshed = useMemo(
    () =>
      DateTime.now()
        .setZone(venueTimezone)
        .setLocale(getIntlLocale(i18n.language))
        .toLocaleString(DateTime.DATETIME_MED),
    [venueTimezone, i18n.language]
  )

  return (
    <div className="p-4 grid gap-3">
      <header className="flex items-center justify-between">
        <div className="grid gap-1">
          <h1 className="text-xl font-semibold">{t('title')}</h1>
          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem>
                <BreadcrumbLink to="/analytics">{t('title')}</BreadcrumbLink>
              </BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{t('overview')}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>
        </div>
      </header>

      <section className="flex gap-3 items-center flex-wrap">
        <div className="text-sm flex items-center gap-2">
          <span>{t('range.label')}</span>
          <DateRangePicker
            initialDateFrom={from}
            initialDateTo={to}
            initialCompareFrom={fromCompare}
            initialCompareTo={toCompare}
            onUpdate={({ range, rangeCompare }) => {
              const next = new URLSearchParams(sp)
              next.delete('timeRange')
              const toISO = (d?: Date) => (d ? new Date(d).toISOString().slice(0, 10) : undefined)
              const f = toISO(range.from)
              const tval = toISO(range.to ?? range.from)
              if (f) next.set('from', f)
              if (tval) next.set('to', tval)
              if (rangeCompare?.from) next.set('fromCompare', toISO(rangeCompare.from)!)
              else next.delete('fromCompare')
              if (rangeCompare?.to) next.set('toCompare', toISO(rangeCompare.to)!)
              else next.delete('toCompare')
              setSp(next, { replace: true })
            }}
          />
        </div>

        <div className="text-sm flex items-center gap-2">
          <span>{t('compare.label')}</span>
          <Select value={compareTo} onValueChange={val => onChange('compareTo', val)}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {compares.map(c => (
                <SelectItem key={c} value={c}>
                  {t(`analytics.compare.${c}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <span className="ml-auto text-xs text-muted-foreground">{t('lastRefreshed', { date: lastRefreshed })}</span>
      </section>

      <Outlet />
    </div>
  )
}
