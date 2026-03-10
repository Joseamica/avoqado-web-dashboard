import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

interface TimePickerProps {
  value?: string // "HH:mm"
  onChange?: (time: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  /** Interval in minutes between options */
  interval?: number
  /** Label shown above the time value. Set to empty string or undefined to hide. */
  label?: string
  /** Error state — adds destructive border */
  error?: boolean
}

function generateTimeOptions(interval: number): string[] {
  const options: string[] = []
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += interval) {
      options.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`)
    }
  }
  return options
}

export function TimePicker({
  value,
  onChange,
  placeholder = '--:--',
  className,
  disabled,
  interval = 15,
  label = 'Hora',
  error,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const listRef = React.useRef<HTMLDivElement>(null)
  const options = React.useMemo(() => generateTimeOptions(interval), [interval])

  // Scroll to selected/closest time when opened — double rAF to wait for Popover mount
  React.useEffect(() => {
    if (!open || !value) return
    // Double requestAnimationFrame ensures the Popover content is fully rendered
    const raf1 = requestAnimationFrame(() => {
      const raf2 = requestAnimationFrame(() => {
        if (!listRef.current) return
        const idx = options.findIndex(o => o >= value)
        if (idx >= 0) {
          const el = listRef.current.children[idx] as HTMLElement
          if (el) {
            // Use instant scroll to avoid janky animation
            el.scrollIntoView({ block: 'center', behavior: 'instant' })
          }
        }
      })
      return () => cancelAnimationFrame(raf2)
    })
    return () => cancelAnimationFrame(raf1)
  }, [open, value, options])

  const handleSelect = (time: string) => {
    onChange?.(time)
    setOpen(false)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            'justify-start text-left font-normal',
            label ? 'h-12 w-full' : 'h-8',
            !value && 'text-muted-foreground',
            error && 'border-destructive',
            className,
          )}
        >
          {label ? (
            <div className="flex flex-col items-start gap-0.5">
              <span className="text-[10px] text-muted-foreground font-medium leading-none">{label}</span>
              <span className="text-sm">{value || placeholder}</span>
            </div>
          ) : (
            <span className="text-sm">{value || placeholder}</span>
          )}
          <Clock className="ml-auto h-4 w-4 text-muted-foreground shrink-0" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[180px] p-0" align="start" sideOffset={4}>
        <div
          ref={listRef}
          className="max-h-[280px] overflow-y-auto py-1"
          onWheel={e => e.stopPropagation()}
        >
          {options.map(time => (
            <button
              key={time}
              type="button"
              onClick={() => handleSelect(time)}
              className={cn(
                'w-full text-left px-4 py-2.5 text-sm transition-colors',
                time === value
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'hover:bg-accent/50 text-foreground',
              )}
            >
              {time}
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}
