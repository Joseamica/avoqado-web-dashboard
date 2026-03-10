import { Button } from '@/components/ui/button'
import { Currency } from '@/utils/currency'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export interface SummaryField<TData> {
  label: string
  /** Extract the numeric value from each row */
  getValue: (row: TData) => number
  /** Format the aggregated value. Defaults to Currency() */
  format?: (value: number) => string
}

interface SelectionSummaryBarProps<TData> {
  selectedRows: TData[]
  fields: SummaryField<TData>[]
  onClear: () => void
}

export function SelectionSummaryBar<TData>({ selectedRows, fields, onClear }: SelectionSummaryBarProps<TData>) {
  const { t } = useTranslation('common')

  if (selectedRows.length === 0) return null

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-4 rounded-xl border border-border bg-background/95 backdrop-blur-sm shadow-lg px-5 py-3">
        {/* Count */}
        <span className="text-sm font-medium text-foreground whitespace-nowrap">
          {selectedRows.length} {selectedRows.length === 1
            ? t('selection.selected_one', { defaultValue: 'seleccionado' })
            : t('selection.selected_other', { defaultValue: 'seleccionados' })}
        </span>

        {/* Divider */}
        <div className="h-5 w-px bg-border" />

        {/* Summary fields */}
        {fields.map(field => {
          const total = selectedRows.reduce((sum, row) => sum + (field.getValue(row) || 0), 0)
          const formatted = field.format ? field.format(total) : Currency(total)
          return (
            <div key={field.label} className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground whitespace-nowrap">{field.label}:</span>
              <span className="text-sm font-semibold text-foreground whitespace-nowrap">{formatted}</span>
            </div>
          )
        })}

        {/* Clear button */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onClear}
          className="h-7 w-7 p-0 ml-1 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
