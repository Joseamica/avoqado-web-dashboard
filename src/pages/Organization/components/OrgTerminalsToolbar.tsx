import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckboxFilterContent, FilterPill } from '@/components/filters'
import { RefreshCw, Search, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface OrgTerminalsToolbarProps {
  searchTerm: string
  onSearchChange: (value: string) => void

  statusOptions: { value: string; label: string }[]
  statusFilter: string[]
  onStatusChange: (values: string[]) => void

  typeOptions: { value: string; label: string }[]
  typeFilter: string[]
  onTypeChange: (values: string[]) => void

  venueOptions: { value: string; label: string }[]
  venueFilter: string[]
  onVenueChange: (values: string[]) => void

  onClearAll: () => void

  onRefresh: () => void
  isRefreshing?: boolean
}

function getFilterDisplayLabel(values: string[], options: { value: string; label: string }[], t: (k: string) => string) {
  if (values.length === 0) return null
  if (values.length === 1) {
    return options.find(o => o.value === values[0])?.label ?? values[0]
  }
  return t('terminals.filters.activeFilters') + `: ${values.length}`
}

export function OrgTerminalsToolbar({
  searchTerm,
  onSearchChange,
  statusOptions,
  statusFilter,
  onStatusChange,
  typeOptions,
  typeFilter,
  onTypeChange,
  venueOptions,
  venueFilter,
  onVenueChange,
  onClearAll,
  onRefresh,
  isRefreshing = false,
}: OrgTerminalsToolbarProps) {
  const { t } = useTranslation('organization')
  const [isSearchOpen, setIsSearchOpen] = useState(searchTerm.length > 0)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  // Global "/" keybinding to focus search (skipped when typing in any input/textarea/contenteditable)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== '/') return
      const target = e.target as HTMLElement | null
      const tag = target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || (target?.isContentEditable ?? false)) return
      e.preventDefault()
      setIsSearchOpen(true)
      // focus on next tick after the input mounts
      setTimeout(() => searchInputRef.current?.focus(), 0)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const hasActiveFilters = statusFilter.length > 0 || typeFilter.length > 0 || venueFilter.length > 0 || searchTerm.length > 0

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {/* Expandable search */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  ref={searchInputRef}
                  data-tour="org-terminals-search"
                  placeholder={t('terminals.searchPlaceholder')}
                  value={searchTerm}
                  onChange={e => onSearchChange(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape' && !searchTerm) setIsSearchOpen(false)
                  }}
                  className="h-8 w-[260px] pl-8 pr-8 text-sm rounded-full"
                  autoFocus
                />
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => onSearchChange('')}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    aria-label={t('terminals.searchToggle')}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full cursor-pointer"
                onClick={() => {
                  onSearchChange('')
                  setIsSearchOpen(false)
                }}
                aria-label={t('terminals.searchToggle')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <Button
              variant={searchTerm ? 'secondary' : 'ghost'}
              size="icon"
              className="h-8 w-8 rounded-full cursor-pointer"
              onClick={() => setIsSearchOpen(true)}
              aria-label={t('terminals.searchToggle')}
            >
              <Search className="h-4 w-4" />
            </Button>
          )}
          {searchTerm && !isSearchOpen && (
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" aria-hidden="true" />
          )}
        </div>

        {/* Estado */}
        <FilterPill
          label={t('terminals.filters.status')}
          activeValue={getFilterDisplayLabel(statusFilter, statusOptions, t)}
          isActive={statusFilter.length > 0}
          onClear={() => onStatusChange([])}
        >
          <CheckboxFilterContent
            title={t('terminals.filters.status')}
            options={statusOptions}
            selectedValues={statusFilter}
            onApply={onStatusChange}
          />
        </FilterPill>

        {/* Tipo */}
        <FilterPill
          label={t('terminals.filters.type')}
          activeValue={getFilterDisplayLabel(typeFilter, typeOptions, t)}
          isActive={typeFilter.length > 0}
          onClear={() => onTypeChange([])}
        >
          <CheckboxFilterContent
            title={t('terminals.filters.type')}
            options={typeOptions}
            selectedValues={typeFilter}
            onApply={onTypeChange}
          />
        </FilterPill>

        {/* Sucursal */}
        <FilterPill
          label={t('terminals.filters.venue')}
          activeValue={getFilterDisplayLabel(venueFilter, venueOptions, t)}
          isActive={venueFilter.length > 0}
          onClear={() => onVenueChange([])}
        >
          <CheckboxFilterContent
            title={t('terminals.filters.venue')}
            options={venueOptions}
            selectedValues={venueFilter}
            onApply={onVenueChange}
            searchable
          />
        </FilterPill>

        {/* Spacer */}
        <div className="flex-1" />

        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          disabled={isRefreshing}
          className="h-8 gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span className="text-sm">{t('terminals.refresh')}</span>
        </Button>
      </div>

      {/* Active filter chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {searchTerm && (
            <ActiveChip onRemove={() => onSearchChange('')}>«{searchTerm}»</ActiveChip>
          )}
          {statusFilter.map(v => (
            <ActiveChip key={`s-${v}`} onRemove={() => onStatusChange(statusFilter.filter(x => x !== v))}>
              {statusOptions.find(o => o.value === v)?.label ?? v}
            </ActiveChip>
          ))}
          {typeFilter.map(v => (
            <ActiveChip key={`t-${v}`} onRemove={() => onTypeChange(typeFilter.filter(x => x !== v))}>
              {typeOptions.find(o => o.value === v)?.label ?? v}
            </ActiveChip>
          ))}
          {venueFilter.map(v => (
            <ActiveChip key={`v-${v}`} onRemove={() => onVenueChange(venueFilter.filter(x => x !== v))}>
              {venueOptions.find(o => o.value === v)?.label ?? v}
            </ActiveChip>
          ))}
          <Button variant="ghost" size="sm" className="h-6 px-2 text-xs text-muted-foreground cursor-pointer" onClick={onClearAll}>
            {t('terminals.filters.clearAll')}
          </Button>
        </div>
      )}
    </div>
  )
}

function ActiveChip({ children, onRemove }: { children: React.ReactNode; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-input bg-muted/50 px-2 py-0.5 text-xs text-foreground">
      {children}
      <button
        type="button"
        onClick={onRemove}
        className="text-muted-foreground hover:text-foreground cursor-pointer"
        aria-label="Quitar filtro"
      >
        <X className="h-3 w-3" />
      </button>
    </span>
  )
}
