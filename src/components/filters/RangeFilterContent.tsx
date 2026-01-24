import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

interface RangeFilterContentProps {
  title: string
  currentRange: { min: string; max: string } | null
  onApply: (range: { min: string; max: string } | null) => void
  prefix?: string // e.g., "$" for currency
  placeholder?: string
}

export function RangeFilterContent({
  title,
  currentRange,
  onApply,
  prefix,
  placeholder = '0',
}: RangeFilterContentProps) {
  const { t } = useTranslation('common')
  const [min, setMin] = useState(currentRange?.min || '')
  const [max, setMax] = useState(currentRange?.max || '')

  useEffect(() => {
    setMin(currentRange?.min || '')
    setMax(currentRange?.max || '')
  }, [currentRange])

  const handleApply = () => {
    if (!min && !max) {
      onApply(null)
    } else {
      onApply({ min, max })
    }
  }

  const handleClear = () => {
    setMin('')
    setMax('')
    onApply(null)
  }

  return (
    <div className="w-[280px] p-4 space-y-4">
      <div>
        <h4 className="font-medium text-sm mb-3">{title}</h4>

        <div className="space-y-3">
          <div>
            <Label htmlFor="min" className="text-xs text-muted-foreground mb-1">
              {t('filters.min', { defaultValue: 'Mínimo' })}
            </Label>
            <div className="relative">
              {prefix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {prefix}
                </span>
              )}
              <Input
                id="min"
                type="text"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                placeholder={placeholder}
                className={prefix ? 'pl-7' : ''}
              />
            </div>
          </div>

          <div>
            <Label htmlFor="max" className="text-xs text-muted-foreground mb-1">
              {t('filters.max', { defaultValue: 'Máximo' })}
            </Label>
            <div className="relative">
              {prefix && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {prefix}
                </span>
              )}
              <Input
                id="max"
                type="text"
                value={max}
                onChange={(e) => setMax(e.target.value)}
                placeholder={placeholder}
                className={prefix ? 'pl-7' : ''}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 pt-2">
        <Button variant="outline" size="sm" onClick={handleClear} className="flex-1">
          {t('clear')}
        </Button>
        <Button size="sm" onClick={handleApply} className="flex-1">
          {t('apply')}
        </Button>
      </div>
    </div>
  )
}
