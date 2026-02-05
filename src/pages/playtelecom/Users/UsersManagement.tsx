/**
 * UsersManagement - User Administration with split-panel layout
 *
 * Layout:
 * - Left sidebar (25%): Searchable user list with status filters
 * - Main panel (75%): User detail with role, scope, permissions, audit log
 *
 * Access: ADMIN+ only
 */

import { useState, useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getTeam, getZones, adminResetPassword } from '@/services/storesAnalysis.service'
import { useToast } from '@/hooks/use-toast'
import {
  UserSidebar,
  UserDetailPanel,
  type UserListItem,
  type UserDetail,
  type Zone,
  type StoreOption,
} from './components'

export function UsersManagement() {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  // State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Fetch team members via venue-level endpoint
  const { data: teamMembers = [] } = useQuery({
    queryKey: ['stores-analysis', venueId, 'team'],
    queryFn: () => getTeam(venueId!),
    enabled: !!venueId,
  })

  // Fetch zones via venue-level endpoint
  const { data: orgZones = [] } = useQuery({
    queryKey: ['stores-analysis', venueId, 'zones'],
    queryFn: () => getZones(venueId!),
    enabled: !!venueId,
  })

  // Reset password mutation
  const resetPasswordMutation = useMutation({
    mutationFn: (userId: string) => adminResetPassword(venueId!, userId),
    onSuccess: (data) => {
      toast({
        title: t('playtelecom:users.resetPasswordSuccess', { defaultValue: 'Password reseteado' }),
        description: t('playtelecom:users.temporaryPassword', {
          defaultValue: 'Password temporal: {{password}}',
          password: data.temporaryPassword,
        }),
      })
    },
    onError: () => {
      toast({
        title: t('playtelecom:users.resetPasswordError', { defaultValue: 'Error al resetear password' }),
        variant: 'destructive',
      })
    },
  })

  // Map team members to zones and stores
  const zones: Zone[] = useMemo(() =>
    orgZones.map(z => ({ id: z.id, name: z.name })),
  [orgZones])

  const stores: StoreOption[] = useMemo(() =>
    orgZones.flatMap(z =>
      z.venues.map(v => ({
        id: v.id,
        name: v.name,
        zoneId: z.id,
      }))
    ),
  [orgZones])

  // Map API team members → UserDetail format
  const mapRole = (venues: Array<{ role: string }>): 'ADMIN' | 'MANAGER' | 'PROMOTOR' => {
    const roles = venues.map(v => v.role)
    if (roles.includes('ADMIN') || roles.includes('OWNER')) return 'ADMIN'
    if (roles.includes('MANAGER')) return 'MANAGER'
    return 'PROMOTOR'
  }

  const usersFullData: UserDetail[] = useMemo(() =>
    teamMembers.map(member => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim(),
      email: member.email,
      phone: member.phone || undefined,
      role: mapRole(member.venues),
      status: 'active' as const,
      createdAt: member.createdAt,
      selectedZone: null,
      selectedStores: member.venues.map(v => v.id),
      permissions: [],
      auditLog: [],
    })),
  [teamMembers])

  // Convert full users to list items for sidebar
  const userListItems: UserListItem[] = useMemo(() =>
    usersFullData.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
    })),
  [usersFullData])

  // Get selected user details
  const selectedUser = useMemo(() =>
    usersFullData.find(u => u.id === selectedUserId) || null,
  [selectedUserId, usersFullData])

  // Handle save
  const handleSave = useCallback((updates: Partial<UserDetail>) => {
    setIsSaving(true)
    console.log('Saving user updates:', updates)
    // TODO: call API to update user
    setTimeout(() => {
      setIsSaving(false)
      queryClient.invalidateQueries({ queryKey: ['stores-analysis', venueId, 'team'] })
    }, 1000)
  }, [venueId, queryClient])

  // Handle status change
  const handleStatusChange = useCallback((status: 'active' | 'inactive' | 'blocked') => {
    console.log('Changing status to:', status)
    // TODO: call API to update status
  }, [])

  // Handle reset password
  const handleResetPassword = useCallback(() => {
    if (selectedUserId) {
      resetPasswordMutation.mutate(selectedUserId)
    }
  }, [selectedUserId, resetPasswordMutation])

  return (
    <div className="flex h-[calc(100vh-12rem)] -m-6">
      {/* Left Sidebar */}
      <div className="w-80 shrink-0">
        <UserSidebar
          users={userListItems}
          selectedUserId={selectedUserId}
          onSelectUser={setSelectedUserId}
        />
      </div>

      {/* Main Panel */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <div className="shrink-0 flex items-center justify-between px-6 py-4 border-b border-border/50 bg-background">
          <div>
            <h2 className="text-lg font-semibold">
              {t('playtelecom:users.title', { defaultValue: 'Gestión de Usuarios' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('playtelecom:users.subtitle', { defaultValue: 'Administra usuarios, roles y permisos' })}
            </p>
          </div>
          <Button className="gap-2">
            <UserPlus className="w-4 h-4" />
            {t('playtelecom:users.invite', { defaultValue: 'Invitar Usuario' })}
          </Button>
        </div>

        {/* Detail Panel */}
        <div className="flex-1 overflow-hidden bg-muted/10">
          <UserDetailPanel
            user={selectedUser}
            zones={zones}
            stores={stores}
            onSave={handleSave}
            onStatusChange={handleStatusChange}
            onResetPassword={handleResetPassword}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  )
}

export default UsersManagement
