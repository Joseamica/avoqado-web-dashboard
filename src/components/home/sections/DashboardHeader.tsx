import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DateRangePicker } from '@/components/date-range-picker'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { getIntlLocale } from '@/utils/i18n-locale'
import { getPreviousPeriod } from '@/utils/datetime'
import { cn } from '@/lib/utils'

interface DashboardHeaderProps {
  activeFilter: string
  handleToday: () => void
  handleLast7Days: () => void
  handleLast30Days: () => void
  selectedRange: { from: Date; to: Date }
  setSelectedRange: (range: { from: Date; to: Date }) => void
  setCompareRange: (range: { from: Date; to: Date }) => void
  setCompareType: (type: any) => void
  setComparisonLabel: (label: string) => void
  setActiveFilter: (filter: string) => void
  isBasicLoading: boolean
  exportLoading: boolean
  isBasicError: boolean
  exportToJSON: () => void
  exportToCSV: () => void
}

const filterPillClass = (active: boolean) =>
  cn(
    'h-7 px-3 text-xs font-medium rounded-full transition-colors cursor-pointer',
    active
      ? 'bg-foreground text-background'
      : 'bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground',
  )

export const DashboardHeader = ({
  activeFilter,
  handleToday,
  handleLast7Days,
  handleLast30Days,
  selectedRange,
  setSelectedRange,
  setCompareRange,
  setCompareType,
  setComparisonLabel,
  setActiveFilter,
  isBasicLoading,
  exportLoading,
  isBasicError,
  exportToJSON,
  exportToCSV,
}: DashboardHeaderProps) => {
  const { t, i18n } = useTranslation('home')
  const localeCode = getIntlLocale(i18n.language)

  return (
    <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm border-b border-border px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        {/* Title */}
        <PageTitleWithInfo
          title={t('title')}
          className="text-lg font-semibold text-foreground shrink-0"
          tooltip={t('info.overview', {
            defaultValue: 'Resumen general del rendimiento del venue.',
          })}
        />

        {/* Controls */}
        <div className="flex items-center gap-2 overflow-x-auto">
          {/* Quick filter pills */}
          <div className="flex items-center gap-1 rounded-full bg-muted/60 p-0.5">
            <button className={filterPillClass(activeFilter === 'today')} onClick={handleToday}>
              {t('filters.today')}
            </button>
            <button className={filterPillClass(activeFilter === '7days')} onClick={handleLast7Days}>
              {t('filters.last7')}
            </button>
            <button className={filterPillClass(activeFilter === '30days')} onClick={handleLast30Days}>
              {t('filters.last30')}
            </button>
          </div>

          {/* Date range picker */}
          <DateRangePicker
            showCompare={false}
            onUpdate={({ range }) => {
              setSelectedRange(range)
              const prevRange = getPreviousPeriod(range)
              setCompareRange(prevRange)
              setCompareType('custom')
              setComparisonLabel(t('comparison.previousPeriod'))
              setActiveFilter('custom')
            }}
            initialDateFrom={selectedRange.from}
            initialDateTo={selectedRange.to}
            align="start"
            locale={localeCode}
          />

          {/* Export — icon-only with tooltip */}
          <DropdownMenu modal={false}>
            <Tooltip>
              <TooltipTrigger asChild>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    disabled={isBasicLoading || exportLoading || isBasicError}
                    className="h-8 w-8 shrink-0 cursor-pointer"
                  >
                    {exportLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                  </Button>
                </DropdownMenuTrigger>
              </TooltipTrigger>
              <TooltipContent>{t('export.export')}</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-40" sideOffset={5}>
              <DropdownMenuItem onClick={exportToJSON}>{t('export.json')}</DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV}>{t('export.csv')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </div>
  )
}
