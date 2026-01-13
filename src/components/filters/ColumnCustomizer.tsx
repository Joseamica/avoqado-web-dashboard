import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { Settings2 } from 'lucide-react'
import { useState } from 'react'
import { FilterPopoverHeader, FilterPopoverFooter } from './FilterPill'

interface ColumnOption {
  id: string
  label: string
  visible: boolean
  disabled?: boolean // Some columns might be always visible
}

interface ColumnCustomizerProps {
  columns: ColumnOption[]
  onApply: (visibleColumnIds: string[]) => void
  label?: string
  title?: string
}

/**
 * Column customizer popover for showing/hiding table columns.
 * Stripe-style "Edita las columnas" feature.
 */
export function ColumnCustomizer({ columns, onApply, label = 'Columnas', title = 'Editar columnas' }: ColumnCustomizerProps) {
  const [open, setOpen] = useState(false)
  const [localColumns, setLocalColumns] = useState<ColumnOption[]>(columns)

  const handleToggle = (columnId: string) => {
    setLocalColumns(prev =>
      prev.map(col => (col.id === columnId && !col.disabled ? { ...col, visible: !col.visible } : col))
    )
  }

  const handleApply = () => {
    const visibleIds = localColumns.filter(c => c.visible).map(c => c.id)
    onApply(visibleIds)
    setOpen(false)
  }

  const handleReset = () => {
    setLocalColumns(columns.map(c => ({ ...c, visible: true })))
  }

  // Sync with external columns when they change
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setLocalColumns(columns)
    }
    setOpen(isOpen)
  }

  const visibleCount = localColumns.filter(c => c.visible).length
  const totalCount = localColumns.length

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 font-normal">
          <Settings2 className="h-3.5 w-3.5" />
          <span>{label}</span>
          {visibleCount < totalCount && (
            <span className="ml-1 rounded-full bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
              {visibleCount}/{totalCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[240px] p-0" sideOffset={8}>
        <FilterPopoverHeader title={title} />

        <div className="max-h-[300px] overflow-y-auto p-2">
          <div className="space-y-1">
            {localColumns.map(column => (
              <label
                key={column.id}
                className={cn(
                  'flex cursor-pointer items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors',
                  'hover:bg-muted/50',
                  column.visible && 'bg-muted/30',
                  column.disabled && 'cursor-not-allowed opacity-50'
                )}
              >
                <Checkbox
                  checked={column.visible}
                  onCheckedChange={() => handleToggle(column.id)}
                  disabled={column.disabled}
                  className="h-4 w-4"
                />
                <span className="flex-1">{column.label}</span>
              </label>
            ))}
          </div>
        </div>

        <FilterPopoverFooter onApply={handleApply} onClear={handleReset} applyLabel="Aplicar" clearLabel="Mostrar todas" />
      </PopoverContent>
    </Popover>
  )
}
