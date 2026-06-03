import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus, Trash2, UserCheck, Users } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { SearchCombobox, type SearchComboboxItem } from '@/components/search-combobox'
import { useToast } from '@/hooks/use-toast'
import { includesNormalized } from '@/lib/utils'
import {
  useOrgVenueAccessCandidates,
  useGrantOrgVenueAccess,
} from '@/hooks/use-org-venue-access'
import type {
  OrgAssignableStaffRole,
  OrgStaffRole,
  OrgVenueAccessCandidate,
} from '@/services/organizationDashboard.service'

/**
 * "Staff carry-over" step. The OWNER picks people from the org and grants each
 * one a role + PIN at the destination venue. Used both as a step in the
 * migration wizard (with `sourceVenueId` = the terminal's current venue, so
 * the people who used the terminal there are pre-flagged) and standalone.
 *
 * The grant happens HERE (not after the terminal moves) so the destination's
 * `NO_STAFF_PIN` migration blocker passes before the move executes.
 */

// Roles the OWNER may assign. SUPERADMIN/OWNER are intentionally excluded.
const ASSIGNABLE_ROLES: OrgAssignableStaffRole[] = ['ADMIN', 'MANAGER', 'CASHIER', 'WAITER', 'KITCHEN', 'HOST', 'VIEWER']

interface AccessRow {
  staffId: string
  name: string
  email: string
  alreadyAtDestination: boolean
  role: OrgAssignableStaffRole
  pin: string | undefined // clearable → undefined when empty
}

interface OrgStaffAccessStepProps {
  orgId: string
  destVenueId: string
  sourceVenueId?: string
  destVenueName?: string | null
  onDone: () => void
  onSkip: () => void
}

export default function OrgStaffAccessStep({
  orgId,
  destVenueId,
  sourceVenueId,
  destVenueName,
  onDone,
  onSkip,
}: OrgStaffAccessStepProps) {
  const { t } = useTranslation('organization')
  const { toast } = useToast()

  const { data: candidates = [], isLoading } = useOrgVenueAccessCandidates(orgId, destVenueId, sourceVenueId)
  const grantMutation = useGrantOrgVenueAccess()

  // Rows the OWNER is granting access to. Seeded from candidates who were using
  // the terminal at the source venue (pre-selected for the common migration case).
  const [rows, setRows] = useState<AccessRow[]>([])
  const [seeded, setSeeded] = useState(false)
  const [search, setSearch] = useState('')

  const defaultRole = (c: OrgVenueAccessCandidate): OrgAssignableStaffRole => {
    const preferred = c.currentRoleAtSource ?? c.currentRoleAtDestination
    return preferred && ASSIGNABLE_ROLES.includes(preferred as OrgAssignableStaffRole)
      ? (preferred as OrgAssignableStaffRole)
      : 'WAITER'
  }

  const toRow = (c: OrgVenueAccessCandidate): AccessRow => ({
    staffId: c.staffId,
    name: c.name,
    email: c.email,
    alreadyAtDestination: c.alreadyAtDestination,
    role: defaultRole(c),
    pin: c.suggestedPin ?? undefined,
  })

  // Seed once: pre-add the people who were on the terminal's source venue.
  if (!seeded && !isLoading && candidates.length > 0) {
    const fromSource = candidates.filter(c => c.inSourceVenue).map(toRow)
    if (fromSource.length > 0) setRows(fromSource)
    setSeeded(true)
  }

  const addedIds = useMemo(() => new Set(rows.map(r => r.staffId)), [rows])

  // People not yet added → pickable in the search combobox.
  const pickerItems = useMemo<SearchComboboxItem[]>(
    () =>
      candidates
        .filter(c => !addedIds.has(c.staffId))
        .filter(c => !search || includesNormalized(`${c.name} ${c.email}`, search))
        .map(c => ({ id: c.staffId, label: c.name, description: c.email })),
    [candidates, addedIds, search],
  )

  const candidateById = useMemo(() => {
    const map = new Map<string, OrgVenueAccessCandidate>()
    for (const c of candidates) map.set(c.staffId, c)
    return map
  }, [candidates])

  const addPerson = (staffId: string) => {
    const c = candidateById.get(staffId)
    if (!c) return
    setRows(prev => (prev.some(r => r.staffId === staffId) ? prev : [...prev, toRow(c)]))
    setSearch('')
  }

  const removePerson = (staffId: string) => setRows(prev => prev.filter(r => r.staffId !== staffId))

  const setRole = (staffId: string, role: OrgAssignableStaffRole) =>
    setRows(prev => prev.map(r => (r.staffId === staffId ? { ...r, role } : r)))

  const setPin = (staffId: string, pin: string | undefined) =>
    setRows(prev => prev.map(r => (r.staffId === staffId ? { ...r, pin } : r)))

  const roleLabel = (role: OrgStaffRole): string => t(`terminals.staffAccess.roles.${role}` as const, { defaultValue: role })

  const handleGrant = () => {
    if (rows.length === 0) {
      onDone()
      return
    }
    grantMutation.mutate(
      {
        orgId,
        venueId: destVenueId,
        grants: rows.map(r => ({ staffId: r.staffId, role: r.role, ...(r.pin ? { pin: r.pin } : {}) })),
      },
      {
        onSuccess: () => {
          toast({ title: t('terminals.staffAccess.grantedToast', { count: rows.length }) })
          onDone()
        },
        onError: (err: any) => {
          // Backend returns Spanish messages (e.g. duplicate PIN) — surface verbatim.
          toast({
            variant: 'destructive',
            title: t('terminals.staffAccess.grantError'),
            description: err?.response?.data?.message ?? err?.message,
          })
        },
      },
    )
  }

  const isSubmitting = grantMutation.isPending

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium flex items-center gap-1.5">
          <Users className="h-4 w-4" />
          {t('terminals.staffAccess.title')}
        </p>
        <p className="text-sm text-muted-foreground">
          {destVenueName
            ? t('terminals.staffAccess.subtitle', { venue: destVenueName })
            : t('terminals.staffAccess.subtitleNoVenue')}
        </p>
      </div>

      {/* Picker */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">{t('terminals.staffAccess.addPersonLabel')}</p>
        <SearchCombobox
          placeholder={t('terminals.staffAccess.searchPlaceholder')}
          items={pickerItems}
          isLoading={isLoading}
          value={search}
          onChange={setSearch}
          onSelect={item => addPerson(item.id)}
        />
      </div>

      {/* Rows */}
      {rows.length === 0 ? (
        <div className="rounded-lg border border-input bg-muted/30 px-4 py-6 text-center">
          <UserCheck className="mx-auto mb-2 h-6 w-6 text-muted-foreground/60" />
          <p className="text-sm text-muted-foreground">{t('terminals.staffAccess.emptyState')}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map(row => (
            <div key={row.staffId} className="rounded-lg border border-input bg-card p-3 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{row.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{row.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {row.alreadyAtDestination && (
                    <Badge variant="outline" className="h-5 px-1.5 text-[10px] text-muted-foreground">
                      {t('terminals.staffAccess.alreadyHasAccess')}
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 cursor-pointer text-muted-foreground hover:text-destructive"
                    onClick={() => removePerson(row.staffId)}
                    aria-label={t('terminals.staffAccess.remove')}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('terminals.staffAccess.roleLabel')}</label>
                  <Select value={row.role} onValueChange={v => setRole(row.staffId, v as OrgAssignableStaffRole)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {roleOptionsFor(row.staffId, candidateById).map(role => (
                        <SelectItem key={role} value={role}>
                          {roleLabel(role)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">{t('terminals.staffAccess.pinLabel')}</label>
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder={t('terminals.staffAccess.pinPlaceholder')}
                    className="h-9"
                    value={row.pin ?? ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/[^0-9]/g, '').slice(0, 6)
                      setPin(row.staffId, raw === '' ? undefined : raw)
                    }}
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                {t('terminals.staffAccess.rowSummary', {
                  name: row.name,
                  role: roleLabel(row.role),
                  pin: row.pin ?? '—',
                })}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <Button variant="outline" className="cursor-pointer" disabled={isSubmitting} onClick={onSkip}>
          {t('terminals.staffAccess.skip')}
        </Button>
        <Button className="cursor-pointer gap-1.5" disabled={isSubmitting} onClick={handleGrant}>
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
          {t('terminals.staffAccess.grantAndContinue')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Options for a row's role select = the assignable roles, plus any extra role
 * the person already holds (so a current MANAGER/etc. stays visible even though
 * it's outside the default assignable list ordering). SUPERADMIN/OWNER are
 * never offered.
 */
function roleOptionsFor(
  staffId: string,
  candidateById: Map<string, OrgVenueAccessCandidate>,
): OrgAssignableStaffRole[] {
  const held = (candidateById.get(staffId)?.rolesHeld ?? []).filter(
    (r): r is OrgAssignableStaffRole => (ASSIGNABLE_ROLES as string[]).includes(r),
  )
  return Array.from(new Set<OrgAssignableStaffRole>([...ASSIGNABLE_ROLES, ...held]))
}
