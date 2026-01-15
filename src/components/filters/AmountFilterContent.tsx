import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useState } from 'react'
import { FilterPopoverFooter, FilterPopoverHeader } from './FilterPill'

type AmountOperator = 'gt' | 'lt' | 'eq' | 'between'

export interface AmountFilter {
  operator: AmountOperator
  value: number | null
  value2?: number | null // For "between" operator
}

interface AmountFilterContentProps {
  title: string
  currentFilter: AmountFilter | null
  onApply: (filter: AmountFilter | null) => void
  onClose?: () => void
  currency?: string
  labels?: {
    greaterThan?: string
    lessThan?: string
    equalTo?: string
    between?: string
    and?: string
    apply?: string
    clear?: string
  }
}

const defaultLabels = {
  greaterThan: 'es mayor que',
  lessThan: 'es menor que',
  equalTo: 'es igual a',
  between: 'está entre',
  and: 'y',
  apply: 'Aplicar',
  clear: 'Limpiar',
}

/**
 * Amount/currency filter content for numeric range filters.
 * Stripe-style "es mayor que", "es menor que", "está entre".
 */
export function AmountFilterContent({
  title,
  currentFilter,
  onApply,
  onClose,
  currency = '$',
  labels: customLabels,
}: AmountFilterContentProps) {
  const labels = { ...defaultLabels, ...customLabels }

  const [operator, setOperator] = useState<AmountOperator>(currentFilter?.operator || 'gt')
  const [value, setValue] = useState<string>(currentFilter?.value?.toString() || '')
  const [value2, setValue2] = useState<string>(currentFilter?.value2?.toString() || '')

  const handleApply = () => {
    const numValue = value ? parseFloat(value) : null
    const numValue2 = value2 ? parseFloat(value2) : null

    if (numValue === null) {
      onApply(null)
    } else {
      onApply({
        operator,
        value: numValue,
        value2: operator === 'between' ? numValue2 : undefined,
      })
    }
    onClose?.()
  }

  const handleClear = () => {
    setOperator('gt')
    setValue('')
    setValue2('')
  }

  return (
    <div className="flex flex-col">
      <FilterPopoverHeader title={title} />

      <div className="p-3 space-y-3">
        {/* Operator selector */}
        <Select value={operator} onValueChange={(v: AmountOperator) => setOperator(v)}>
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="gt">{labels.greaterThan}</SelectItem>
            <SelectItem value="lt">{labels.lessThan}</SelectItem>
            <SelectItem value="eq">{labels.equalTo}</SelectItem>
            <SelectItem value="between">{labels.between}</SelectItem>
          </SelectContent>
        </Select>

        {/* Value input(s) */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currency}</span>
            <Input
              type="number"
              placeholder="0.00"
              value={value}
              onChange={e => setValue(e.target.value)}
              className="pl-7 h-9"
              min={0}
              step="0.01"
            />
          </div>

          {operator === 'between' && (
            <>
              <span className="text-sm text-muted-foreground">{labels.and}</span>
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">{currency}</span>
                <Input
                  type="number"
                  placeholder="0.00"
                  value={value2}
                  onChange={e => setValue2(e.target.value)}
                  className="pl-7 h-9"
                  min={0}
                  step="0.01"
                />
              </div>
            </>
          )}
        </div>
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
