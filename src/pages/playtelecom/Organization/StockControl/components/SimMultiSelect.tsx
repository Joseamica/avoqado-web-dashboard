/**
 * SimMultiSelect — input-as-search multi-select for ADMIN_HELD ICCIDs.
 *
 * Matches the Recipe Wizard pattern (`SearchCombobox`): a plain text input
 * expands a results list below on focus, filters in-place as the user types,
 * and items are tappable — no separate popover/dropdown button.
 *
 * Key differences vs SearchCombobox:
 *   - multi-select with chips below the input
 *   - constrained to ADMIN_HELD items (assignable — plan §1.4)
 *   - dropdown stays open after selection so the operator can keep picking
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Loader2, X } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn, includesNormalized } from '@/lib/utils'
import type { OrgStockOverviewItem } from '@/services/stockDashboard.service'

interface Props {
  items: OrgStockOverviewItem[]
  /** Optional filter: only show SIMs matching this category. */
  categoryId?: string
  value: string[]
  onChange: (serialNumbers: string[]) => void
  placeholder?: string
  isLoading?: boolean
}

export function SimMultiSelect({ items, categoryId, value, onChange, placeholder, isLoading = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [search, setSearch] = useState('')
  const [isFocused, setIsFocused] = useState(false)

  // Only ADMIN_HELD SIMs are assignable (plan §1.4). Everything else is
  // either already downstream or sold.
  const assignable = useMemo(
    () =>
      items.filter(i => {
        const state = i.custodyState ?? 'ADMIN_HELD'
        if (state !== 'ADMIN_HELD') return false
        if (categoryId && i.categoryId !== categoryId) return false
        return true
      }),
    [items, categoryId],
  )

  const filtered = useMemo(() => {
    const q = search.trim()
    if (!q) return assignable
    return assignable.filter(i => includesNormalized(i.serialNumber ?? '', q))
  }, [assignable, search])

  const selectedSet = useMemo(() => new Set(value), [value])
  const toggle = (sn: string) => {
    if (selectedSet.has(sn)) onChange(value.filter(v => v !== sn))
    else onChange([...value, sn])
  }
  const clear = () => onChange([])

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsFocused(false)
      }
    }
    if (isFocused) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isFocused])

  const showDropdown = isFocused
  const effectivePlaceholder =
    placeholder ?? (assignable.length === 0 ? 'No hay SIMs disponibles en almacén' : 'Buscar por últimos dígitos del ICCID…')

  return (
    <div ref={containerRef} className="relative">
      <div
        className={cn(
          'flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm',
          'focus-within:ring-2 focus-within:ring-ring focus-within:border-transparent',
          assignable.length === 0 && 'opacity-60',
        )}
      >
        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          onFocus={() => setIsFocused(true)}
          placeholder={effectivePlaceholder}
          disabled={assignable.length === 0}
          className="flex-1 bg-transparent outline-none placeholder:text-muted-foreground font-mono disabled:cursor-not-allowed"
        />
        {isLoading && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
      </div>

      {showDropdown && assignable.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-80 overflow-y-auto rounded-md border border-border bg-popover shadow-lg">
          <div className="sticky top-0 border-b border-border bg-popover px-3 py-2 text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? 'disponible' : 'disponibles'} en almacén
          </div>
          {filtered.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Sin resultados</div>
          ) : (
            filtered.map(item => {
              const checked = selectedSet.has(item.serialNumber)
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggle(item.serialNumber)}
                  className={cn(
                    'flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors',
                    'hover:bg-accent hover:text-accent-foreground',
                    checked && 'bg-accent/60',
                  )}
                >
                  <Check className={cn('h-4 w-4 shrink-0', checked ? 'text-emerald-600' : 'opacity-0')} />
                  <div className="flex-1 min-w-0">
                    <div className="font-mono text-sm">{item.serialNumber}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {item.categoryName}
                      {item.registeredFromVenueName ? ` · ${item.registeredFromVenueName}` : ''}
                    </div>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {value.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          {value.slice(0, 8).map(sn => (
            <Badge key={sn} variant="outline" className="gap-1 font-mono text-xs bg-muted">
              ···{sn.slice(-6)}
              <button
                type="button"
                aria-label={`Quitar ${sn}`}
                onClick={() => toggle(sn)}
                className="hover:text-red-600"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
          {value.length > 8 && (
            <Badge variant="secondary" className="text-xs">
              +{value.length - 8} más
            </Badge>
          )}
          <button
            type="button"
            onClick={clear}
            className="h-6 rounded px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            Limpiar
          </button>
        </div>
      )}
    </div>
  )
}
