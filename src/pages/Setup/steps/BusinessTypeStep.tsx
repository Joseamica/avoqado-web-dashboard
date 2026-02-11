import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Check } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { ALL_BUSINESS_TYPES } from '@/config/business-types'
import type { StepProps } from '../types'
import { cn } from '@/lib/utils'

export function BusinessTypeStep({ data, onNext }: StepProps) {
  const { t } = useTranslation('setup')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(data.businessType || '')

  const businessName = data.businessName || ''
  const title = businessName
    ? t('step3.title', { businessName })
    : t('step3.titleFallback')

  const filteredTypes = useMemo(() => {
    if (!search.trim()) return ALL_BUSINESS_TYPES
    const lower = search.toLowerCase()
    return ALL_BUSINESS_TYPES.filter(
      (type) =>
        t(type.labelKey).toLowerCase().includes(lower) ||
        t(type.categoryLabelKey).toLowerCase().includes(lower),
    )
  }, [search, t])

  const handleSelect = (value: string, category: string) => {
    setSelected(value)
    onNext({
      businessType: value,
      businessCategory: category,
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
          {title}
        </h1>
        <p className="text-sm text-muted-foreground">{t('step3.subtitle')}</p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('step3.searchPlaceholder')}
          className="rounded-lg h-12 text-base pl-9"
          autoFocus
        />
      </div>

      {/* List */}
      <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto rounded-2xl border border-border">
        {filteredTypes.length === 0 ? (
          <p className="p-4 text-center text-sm text-muted-foreground">
            {t('step3.noResults')}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {filteredTypes.map((type) => (
              <button
                key={type.value}
                onClick={() => handleSelect(type.value, type.category)}
                className={cn(
                  'flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-muted/50',
                  selected === type.value && 'bg-muted',
                )}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{t(type.labelKey)}</p>
                  <p className="text-xs text-muted-foreground">{t(type.categoryLabelKey)}</p>
                </div>
                {selected === type.value && (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
