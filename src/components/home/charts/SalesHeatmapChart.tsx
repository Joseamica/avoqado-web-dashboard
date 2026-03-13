import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
const HOURS = Array.from({ length: 24 }, (_, i) => i)

export const SalesHeatmapChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const [hoveredCell, setHoveredCell] = useState<{ hour: number; weekday: number; value: number } | null>(null)

  const { grid, maxValue } = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) {
      return { grid: new Map<string, number>(), maxValue: 0 }
    }

    const gridMap = new Map<string, number>()
    let max = 0

    data.forEach((item: any) => {
      const key = `${item.weekday}-${item.hour}`
      const val = item.value || 0
      gridMap.set(key, val)
      if (val > max) max = val
    })

    return { grid: gridMap, maxValue: max }
  }, [data])

  const hasData = grid.size > 0

  const getOpacity = (value: number): number => {
    if (maxValue === 0 || value === 0) return 0.05
    return 0.1 + (value / maxValue) * 0.9
  }

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('salesHeatmap.title')}</CardTitle>
        <CardDescription>{t('salesHeatmap.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-2 sm:px-4">
        {!hasData ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="relative">
            {/* Tooltip */}
            {hoveredCell && (
              <div className="absolute top-0 right-0 z-10 rounded-md border border-input bg-popover px-3 py-2 text-sm shadow-md">
                <p className="font-medium text-foreground">
                  {t(`weekdaysFull.${WEEKDAY_KEYS[hoveredCell.weekday]}`)} — {hoveredCell.hour}:00
                </p>
                <p className="text-muted-foreground">
                  {hoveredCell.value} {t('charts.orders')}
                </p>
              </div>
            )}

            {/* Grid */}
            <div className="overflow-x-auto">
              <div className="min-w-[600px]">
                {/* Hour labels */}
                <div className="grid gap-[2px] mb-1" style={{ gridTemplateColumns: '60px repeat(24, 1fr)' }}>
                  <div /> {/* empty corner */}
                  {HOURS.map((hour) => (
                    <div key={hour} className="text-center text-[10px] text-muted-foreground">
                      {hour}
                    </div>
                  ))}
                </div>

                {/* Rows: one per weekday */}
                {[0, 1, 2, 3, 4, 5, 6].map((weekday) => (
                  <div
                    key={weekday}
                    className="grid gap-[2px] mb-[2px]"
                    style={{ gridTemplateColumns: '60px repeat(24, 1fr)' }}
                  >
                    {/* Weekday label */}
                    <div className="flex items-center text-xs text-muted-foreground pr-2 justify-end">
                      {t(`weekdays.${WEEKDAY_KEYS[weekday]}`)}
                    </div>

                    {/* Hour cells */}
                    {HOURS.map((hour) => {
                      const value = grid.get(`${weekday}-${hour}`) || 0
                      return (
                        <div
                          key={`${weekday}-${hour}`}
                          className="aspect-square rounded-sm bg-primary cursor-pointer transition-transform hover:scale-110"
                          style={{ opacity: getOpacity(value) }}
                          onMouseEnter={() => setHoveredCell({ hour, weekday, value })}
                          onMouseLeave={() => setHoveredCell(null)}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
