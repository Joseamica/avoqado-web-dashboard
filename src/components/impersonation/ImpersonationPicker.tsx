/**
 * ImpersonationPicker
 *
 * The SUPERADMIN-only picker rendered inside the header button's Popover (and the
 * command palette's submenu). Lets the user choose a user OR role within the
 * current venue and start a read-only impersonation session.
 *
 * Spec: docs/superpowers/specs/2026-04-20-superadmin-impersonation-design.md §5.3
 */
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserCog, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { useImpersonation } from '@/hooks/use-impersonation'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { StaffRole } from '@/types'
import type { EligibleTarget } from '@/services/impersonation.service'

const REASON_MIN_LENGTH = 10

interface ImpersonationPickerProps {
  /** Called after impersonation starts successfully (typically to close the popover). */
  onImpersonationStarted?: () => void
}

type PickerTab = 'user' | 'role'

export function ImpersonationPicker({ onImpersonationStarted }: ImpersonationPickerProps) {
  const { t } = useTranslation(['impersonation', 'common'])
  const { venue } = useCurrentVenue()
  const { toast } = useToast()
  const { startImpersonation, isStarting, useEligibleTargets } = useImpersonation()
  const { data, isLoading, error } = useEligibleTargets()

  const [tab, setTab] = useState<PickerTab>('user')
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [selectedRole, setSelectedRole] = useState<StaffRole | null>(null)
  const [reason, setReason] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)

  const debouncedSearch = useDebounce(search, 200)

  const filteredUsers = useMemo<EligibleTarget[]>(() => {
    const users = data?.users ?? []
    const q = debouncedSearch.trim().toLowerCase()
    if (!q) return users
    return users.filter(u => {
      const haystack = `${u.firstName} ${u.lastName} ${u.email} ${u.role}`.toLowerCase()
      return haystack.includes(q)
    })
  }, [data?.users, debouncedSearch])

  const roleOptions = useMemo(() => {
    const roles = data?.roles ?? []
    return roles.map(r => ({
      value: r,
      name: t(`impersonation:roles.${r}.name`, { defaultValue: r }),
      description: t(`impersonation:roles.${r}.description`, { defaultValue: '' }),
    }))
  }, [data?.roles, t])

  const canSubmit =
    !isStarting &&
    reason.trim().length >= REASON_MIN_LENGTH &&
    ((tab === 'user' && !!selectedUserId) || (tab === 'role' && !!selectedRole))

  const handleStart = async () => {
    setSubmitError(null)
    try {
      if (tab === 'user' && selectedUserId) {
        await startImpersonation({ mode: 'user', targetUserId: selectedUserId, reason: reason.trim() })
      } else if (tab === 'role' && selectedRole) {
        await startImpersonation({ mode: 'role', targetRole: selectedRole, reason: reason.trim() })
      }
      toast({ title: t('impersonation:toast.started') })
      onImpersonationStarted?.()
    } catch (err: any) {
      const serverMsg = err?.response?.data?.message
      setSubmitError(serverMsg ?? t('impersonation:toast.startFailed'))
    }
  }

  return (
    <div className="w-[420px] max-w-[95vw]">
      {/* Gradient header — matches the SUPERADMIN visual language */}
      <div className="rounded-t-md px-4 py-3 bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground flex items-center gap-2">
        <UserCog className="h-4 w-4" />
        <span className="text-sm font-medium">
          {t('impersonation:picker.title')}: <strong className="font-semibold">{venue?.name ?? '...'}</strong>
        </span>
      </div>

      <div className="p-4 space-y-4">
        <Tabs value={tab} onValueChange={v => setTab(v as PickerTab)}>
          <TabsList className="inline-flex h-9 w-full items-center justify-center rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
            <TabsTrigger
              value="user"
              className="flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
            >
              {t('impersonation:picker.tabs.user')}
            </TabsTrigger>
            <TabsTrigger
              value="role"
              className="flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
            >
              {t('impersonation:picker.tabs.role')}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="user" className="mt-3 space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={t('impersonation:picker.searchPlaceholder') ?? ''}
                className="pl-9"
              />
            </div>

            <div className="max-h-56 overflow-y-auto rounded-md border border-input">
              {isLoading ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                </div>
              ) : error ? (
                <div className="py-4 px-3 text-sm text-destructive">{String((error as Error).message ?? error)}</div>
              ) : filteredUsers.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  {data?.users.length === 0
                    ? t('impersonation:picker.emptyUsers')
                    : t('impersonation:picker.emptySearch')}
                </div>
              ) : (
                <ul className="divide-y divide-input">
                  {filteredUsers.map(u => {
                    const isSelected = selectedUserId === u.id
                    return (
                      <li key={u.id}>
                        <button
                          type="button"
                          onClick={() => setSelectedUserId(u.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors cursor-pointer ${
                            isSelected ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/50'
                          }`}
                        >
                          <Avatar className="h-8 w-8 shrink-0">
                            {u.photoUrl ? <AvatarImage src={u.photoUrl} alt={`${u.firstName} ${u.lastName}`} /> : null}
                            <AvatarFallback className="text-xs">
                              {(u.firstName[0] ?? '').toUpperCase()}
                              {(u.lastName[0] ?? '').toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="truncate text-sm font-medium">
                                {u.firstName} {u.lastName}
                              </span>
                              <Badge variant="outline" className="h-5 shrink-0 text-[10px] font-normal">
                                {u.role}
                              </Badge>
                            </div>
                            <div className="truncate text-xs text-muted-foreground">{u.email}</div>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </TabsContent>

          <TabsContent value="role" className="mt-3 space-y-3">
            <div className="max-h-56 overflow-y-auto rounded-md border border-input">
              <ul className="divide-y divide-input">
                {roleOptions.map(r => {
                  const isSelected = selectedRole === r.value
                  return (
                    <li key={r.value}>
                      <button
                        type="button"
                        onClick={() => setSelectedRole(r.value)}
                        className={`w-full px-3 py-2 text-left transition-colors cursor-pointer ${
                          isSelected ? 'bg-amber-50 dark:bg-amber-950/30' : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="text-sm font-medium">{r.name}</div>
                        {r.description ? (
                          <div className="mt-0.5 text-xs text-muted-foreground">{r.description}</div>
                        ) : null}
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-1">
          <label className="text-xs font-medium text-muted-foreground" htmlFor="impersonation-reason">
            {t('impersonation:picker.reasonLabel')}
          </label>
          <Textarea
            id="impersonation-reason"
            value={reason}
            onChange={e => setReason(e.target.value)}
            placeholder={t('impersonation:picker.reasonPlaceholder') ?? ''}
            rows={2}
            className="resize-none"
          />
          {reason.length > 0 && reason.trim().length < REASON_MIN_LENGTH ? (
            <p className="text-xs text-destructive">
              {t('impersonation:picker.reasonTooShort', { min: REASON_MIN_LENGTH })}
            </p>
          ) : null}
        </div>

        {submitError ? <p className="text-xs text-destructive">{submitError}</p> : null}

        <Button
          onClick={handleStart}
          disabled={!canSubmit}
          className="w-full bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground cursor-pointer"
        >
          {isStarting ? (
            <span className="inline-flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('impersonation:picker.starting')}
            </span>
          ) : (
            t('impersonation:picker.start')
          )}
        </Button>
      </div>
    </div>
  )
}
