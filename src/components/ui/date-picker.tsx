import * as React from 'react'
import { format, addWeeks } from 'date-fns'
import { es } from 'date-fns/locale'
import { CalendarIcon } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

interface DatePickerProps {
  value?: Date
  onChange?: (date: Date | undefined) => void
  /** Optional availability panel content on the right */
  availabilityContent?: React.ReactNode
  placeholder?: string
  className?: string
  disabled?: boolean
}

const shortcuts = [
  { label: 'Hoy', getValue: () => new Date() },
  { label: 'En 1 semana', getValue: () => addWeeks(new Date(), 1) },
  { label: 'En 2 semanas', getValue: () => addWeeks(new Date(), 2) },
  { label: 'En 3 semanas', getValue: () => addWeeks(new Date(), 3) },
  { label: 'En 4 semanas', getValue: () => addWeeks(new Date(), 4) },
  { label: 'En 5 semanas', getValue: () => addWeeks(new Date(), 5) },
  { label: 'En 6 semanas', getValue: () => addWeeks(new Date(), 6) },
]

export function DatePicker({
  value,
  onChange,
  availabilityContent,
  placeholder = 'Seleccionar fecha',
  className,
  disabled,
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  const handleSelect = (date: Date | undefined) => {
    onChange?.(date)
    if (date) setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            'h-12 w-full justify-start text-left font-normal',
            !value && 'text-muted-foreground',
            className,
          )}
        >
          <div className="flex flex-col items-start gap-0.5">
            <span className="text-[10px] text-muted-foreground font-medium leading-none">Fecha</span>
            <span className="text-sm">
              {value ? format(value, 'dd/MM/yyyy') : placeholder}
            </span>
          </div>
          <CalendarIcon className="ml-auto h-4 w-4 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
        <div className="flex">
          {/* Shortcuts panel */}
          <div className="border-r border-border p-3 space-y-0.5 min-w-[130px]">
            {shortcuts.map(shortcut => (
              <button
                key={shortcut.label}
                type="button"
                onClick={() => handleSelect(shortcut.getValue())}
                className="w-full text-left px-2 py-1.5 text-sm rounded-md hover:bg-accent transition-colors text-foreground"
              >
                {shortcut.label}
              </button>
            ))}
          </div>

          {/* Calendar */}
          <div>
            <Calendar
              mode="single"
              selected={value}
              onSelect={handleSelect}
              locale={es}
              initialFocus
            />
          </div>

          {/* Optional availability panel */}
          {availabilityContent && (
            <div className="border-l border-border p-3 min-w-[140px] max-w-[160px]">
              {availabilityContent}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
