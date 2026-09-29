// src/components/billing/KeepStaffSelector.tsx
import { useTranslation } from 'react-i18next'
import { Check, Lock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import type { DowngradePreview } from '@/services/features.service'

/** The owners of a roster: always kept, and the seed of every selection. */
// eslint-disable-next-line react-refresh/only-export-components -- pure helper shared with the dialog
export const ownerIds = (preview: DowngradePreview) => preview.staff.filter(row => row.isOwner).map(row => row.staffVenueId)

/** "Choose who stays": owners locked in, at most `keepMax` rows. Controlled; writes nothing. */
export function KeepStaffSelector({
  preview,
  selected,
  onChange,
}: {
  preview: DowngradePreview
  selected: Set<string>
  onChange: (next: Set<string>) => void
}) {
  const { t } = useTranslation('billing')
  const atMax = selected.size >= preview.keepMax
  const toggle = (row: DowngradePreview['staff'][number]) => {
    if (row.isOwner) return
    const next = new Set(selected)
    if (next.has(row.staffVenueId)) next.delete(row.staffVenueId)
    else if (next.size < preview.keepMax) next.add(row.staffVenueId)
    onChange(next)
  }
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{t('plan.downgrade.rosterLabel')}</p>
      {preview.staff.map(row => {
        const isSelected = selected.has(row.staffVenueId)
        const isLocked = row.isOwner
        const isDisabled = !isSelected && atMax && !isLocked
        return (
          <div
            key={row.staffVenueId}
            role="button"
            tabIndex={isLocked || isDisabled ? -1 : 0}
            aria-pressed={isSelected}
            aria-disabled={isLocked || isDisabled}
            data-tour={`downgrade-staff-${row.staffVenueId}`}
            onClick={() => !isDisabled && toggle(row)}
            onKeyDown={event => {
              if ((event.key === 'Enter' || event.key === ' ') && !isDisabled) {
                event.preventDefault()
                toggle(row)
              }
            }}
            className={cn(
              'flex items-center gap-3 rounded-xl border border-input p-3 transition-colors',
              isSelected ? 'border-primary/40 bg-primary/5' : 'bg-card',
              isLocked ? 'cursor-default' : isDisabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:bg-muted/50',
            )}
          >
            <Checkbox
              checked={isSelected}
              disabled={isLocked || isDisabled}
              onCheckedChange={() => !isDisabled && toggle(row)}
              onClick={event => event.stopPropagation()}
              aria-label={row.name}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate font-medium">{row.name}</span>
                {isLocked && (
                  <Badge variant="secondary" className="h-4 gap-1 px-1.5 text-[10px]">
                    <Lock className="h-2.5 w-2.5" />
                    {t('plan.downgrade.youOwner')}
                  </Badge>
                )}
              </div>
              <p className="truncate text-xs text-muted-foreground">{row.email}</p>
            </div>
            {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
          </div>
        )
      })}
    </div>
  )
}
