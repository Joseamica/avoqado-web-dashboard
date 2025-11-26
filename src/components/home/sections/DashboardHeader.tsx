import { useTranslation } from 'react-i18next'
import { Download, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { DateRangePicker } from '@/components/date-range-picker'
import { getIntlLocale } from '@/utils/i18n-locale'
import { getPreviousPeriod } from '@/utils/datetime'

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
    <div className="sticky top-0 z-10 bg-background border-b border-border shadow-sm p-4">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h1 className="text-2xl font-bold text-foreground">{t('title')}</h1>
        <div className="flex items-center gap-3 overflow-x-auto pb-1 md:pb-0">
          {/* Quick filter buttons */}
          <div className="flex space-x-2">
            <Button
              size="sm"
              variant={activeFilter === 'today' ? 'default' : 'outline'}
              onClick={handleToday}
              className="whitespace-nowrap"
            >
              {t('filters.today')}
            </Button>
            <Button
              size="sm"
              variant={activeFilter === '7days' ? 'default' : 'outline'}
              onClick={handleLast7Days}
              className="whitespace-nowrap"
            >
              {t('filters.last7')}
            </Button>
            <Button
              size="sm"
              variant={activeFilter === '30days' ? 'default' : 'outline'}
              onClick={handleLast30Days}
              className="whitespace-nowrap"
            >
              {t('filters.last30')}
            </Button>
          </div>

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

          <div className="relative">
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isBasicLoading || exportLoading || isBasicError}
                  className="flex items-center gap-2"
                >
                  {exportLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{t('export.exporting')}</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>{t('export.export')}</span>
                    </>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48" sideOffset={5}>
                <DropdownMenuItem onClick={exportToJSON}>{t('export.json')}</DropdownMenuItem>
                <DropdownMenuItem onClick={exportToCSV}>{t('export.csv')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </div>
  )
}
