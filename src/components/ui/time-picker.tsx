import * as React from 'react'
import { Clock } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Popover, PopoverAnchor, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface TimePickerProps {
  id?: string
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
  /** Allow typing time in the field while keeping the dropdown list */
  allowManualInput?: boolean
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

function normalizeTimeInput(raw: string): string | null {
  const input = raw.trim().replace('.', ':')
  if (!input) return null

  let hours: number
  let minutes: number

  const colonMatch = input.match(/^(\d{1,2}):(\d{1,2})$/)
  if (colonMatch) {
    hours = Number(colonMatch[1])
    minutes = Number(colonMatch[2])
  } else if (/^\d{1,4}$/.test(input)) {
    if (input.length <= 2) {
      hours = Number(input)
      minutes = 0
    } else if (input.length === 3) {
      hours = Number(input.slice(0, 1))
      minutes = Number(input.slice(1))
    } else {
      hours = Number(input.slice(0, 2))
      minutes = Number(input.slice(2))
    }
  } else {
    return null
  }

  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`
}

export function TimePicker({
  id,
  value,
  onChange,
  placeholder = '--:--',
  className,
  disabled,
  interval = 15,
  label = 'Hora',
  error,
  allowManualInput = false,
}: TimePickerProps) {
  const [open, setOpen] = React.useState(false)
  const [inputValue, setInputValue] = React.useState(value ?? '')
  const [contentWidth, setContentWidth] = React.useState<number>()
  const listRef = React.useRef<HTMLDivElement>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const options = React.useMemo(() => generateTimeOptions(interval), [interval])

  const updateContentWidth = React.useCallback(() => {
    if (!anchorRef.current) return
    setContentWidth(anchorRef.current.getBoundingClientRect().width)
  }, [])

  React.useEffect(() => {
    setInputValue(value ?? '')
  }, [value])

  React.useEffect(() => {
    if (!allowManualInput) return
    updateContentWidth()

    const element = anchorRef.current
    if (!element || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => updateContentWidth())
    observer.observe(element)
    return () => observer.disconnect()
  }, [allowManualInput, updateContentWidth])

  React.useEffect(() => {
    if (!allowManualInput || !open) return
    updateContentWidth()
  }, [allowManualInput, open, updateContentWidth])

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
    setInputValue(time)
    setOpen(false)
  }

  const commitManualValue = React.useCallback(() => {
    const draft = inputValue.trim()
    if (!draft) {
      setInputValue('')
      onChange?.('')
      return
    }

    const normalized = normalizeTimeInput(draft)
    if (!normalized) {
      setInputValue(value ?? '')
      return
    }

    setInputValue(normalized)
    if (normalized !== value) {
      onChange?.(normalized)
    }
  }, [inputValue, onChange, value])

  const optionsList = (
    <div ref={listRef} className="max-h-[280px] overflow-y-auto py-1" onWheel={e => e.stopPropagation()}>
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
  )

  if (allowManualInput) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverAnchor asChild>
          <div ref={anchorRef} className={cn('relative', className)}>
            <Input
              id={id}
              type="text"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onBlur={commitManualValue}
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  commitManualValue()
                  setOpen(false)
                } else if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setOpen(true)
                } else if (e.key === 'Escape') {
                  setInputValue(value ?? '')
                  setOpen(false)
                }
              }}
              placeholder={placeholder}
              disabled={disabled}
              autoComplete="off"
              inputMode="numeric"
              className={cn('pr-10', error && 'border-destructive')}
            />
            <button
              type="button"
              disabled={disabled}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              onMouseDown={e => e.preventDefault()}
              onClick={() => setOpen(prev => !prev)}
            >
              <Clock className="h-4 w-4" />
            </button>
          </div>
        </PopoverAnchor>
        <PopoverContent
          className="w-auto p-0"
          align="start"
          sideOffset={4}
          style={contentWidth ? { width: `${contentWidth}px` } : undefined}
        >
          {optionsList}
        </PopoverContent>
      </Popover>
    )
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
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
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start" sideOffset={4}>
        {optionsList}
      </PopoverContent>
    </Popover>
  )
}
