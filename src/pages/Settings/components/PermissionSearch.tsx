import { Search, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

interface PermissionSearchProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
}

/**
 * PermissionSearch - Search input with clear button for filtering permissions
 *
 * Note: The debouncing should be handled by the parent component using
 * the useDebounce hook from @/hooks/useDebounce to follow CLAUDE.md guidelines.
 *
 * Usage:
 * ```tsx
 * const [searchTerm, setSearchTerm] = useState('')
 * const debouncedSearchTerm = useDebounce(searchTerm, 300)
 *
 * // Use debouncedSearchTerm for filtering
 * const filteredCategories = useMemo(() =>
 *   filterPermissionsBySearch(categories, debouncedSearchTerm),
 *   [categories, debouncedSearchTerm]
 * )
 * ```
 */
export function PermissionSearch({ value, onChange, placeholder, className }: PermissionSearchProps) {
  const { t } = useTranslation('settings')
  const { t: tCommon } = useTranslation('common')

  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder || t('rolePermissions.searchPlaceholder', 'Search permissions...')}
        className="pl-9 pr-9 h-9 bg-muted/30 border-border/50 focus-visible:ring-1 focus-visible:ring-primary/50"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          aria-label={tCommon('clear', 'Clear')}
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}

export default PermissionSearch
