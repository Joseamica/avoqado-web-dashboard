/**
 * UserSidebar - Searchable user list with status filters
 */

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Search, Users, UserCheck, UserX, UserPlus, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useRoleConfig } from '@/hooks/use-role-config'
import { getRoleBadgeColor } from '@/utils/role-permissions'
import { type StaffRole } from '@/types'

export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive'
  avatarUrl?: string
}

interface UserSidebarProps {
  users: UserListItem[]
  selectedUserId: string | null
  onSelectUser: (userId: string) => void
  onInvite?: () => void
  className?: string
}

type StatusFilter = 'all' | 'active' | 'inactive'

const STATUS_FILTERS: { value: StatusFilter; icon: React.ElementType; labelKey: string }[] = [
  { value: 'all', icon: Users, labelKey: 'all' },
  { value: 'active', icon: UserCheck, labelKey: 'active' },
  { value: 'inactive', icon: UserX, labelKey: 'inactive' },
]

/** Inline role badge with custom color support */
const RoleBadge: React.FC<{
  role: string
  getDisplayName: (role: StaffRole | string) => string
  getColor: (role: StaffRole | string) => string | null
}> = ({ role, getDisplayName, getColor }) => {
  const customColor = getColor(role)
  const fallbackClasses = getRoleBadgeColor(role as StaffRole)

  return (
    <span
      className={cn(
        'max-w-full shrink-0 inline-flex items-center h-5 px-2 text-[10px] font-medium rounded-full leading-none',
        customColor ? 'border border-current/20' : fallbackClasses,
      )}
      title={getDisplayName(role)}
      style={
        customColor
          ? { backgroundColor: `${customColor}20`, color: customColor, borderColor: `${customColor}40` }
          : undefined
      }
    >
      <span className="truncate">{getDisplayName(role)}</span>
    </span>
  )
}

export const UserSidebar: React.FC<UserSidebarProps> = ({ users, selectedUserId, onSelectUser, onInvite, className }) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { getDisplayName, getColor } = useRoleConfig()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      if (statusFilter !== 'all' && user.status !== statusFilter) return false
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return user.name.toLowerCase().includes(term) || user.email.toLowerCase().includes(term)
      }
      return true
    })
  }, [users, searchTerm, statusFilter])

  const statusCounts = useMemo(
    () => ({
      all: users.length,
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length,
    }),
    [users],
  )

  return (
    <div
      className={cn(
        'flex flex-col h-full rounded-2xl border border-border/60 bg-gradient-to-b from-card via-card/95 to-card/90 backdrop-blur-sm shadow-sm overflow-hidden',
        className,
      )}
    >
      {/* Header */}
      <div className="shrink-0 p-4 space-y-4">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-xl leading-6">
              {t('playtelecom:users.userList', { defaultValue: 'Usuarios' })}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {statusCounts.active} {t('playtelecom:users.filter.active', { defaultValue: 'active' })} · {statusCounts.inactive}{' '}
              {t('playtelecom:users.filter.inactive', { defaultValue: 'inactive' })}
            </p>
          </div>
          <Button size="sm" className="h-10 gap-1.5 text-sm rounded-xl cursor-pointer px-3" onClick={onInvite}>
            <UserPlus className="w-4 h-4" />
            {t('playtelecom:users.invite', { defaultValue: 'Invitar Usuario' })}
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('playtelecom:users.searchPlaceholder', { defaultValue: 'Buscar...' })}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 pr-9 h-10 text-base rounded-xl border-border/70"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => setSearchTerm('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-6 h-6 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/70 cursor-pointer"
              aria-label={t('common:clear', { defaultValue: 'Limpiar' })}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Status Filter Pills */}
        <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted/40 p-1">
          {STATUS_FILTERS.map(filter => {
            const Icon = filter.icon
            const isActive = statusFilter === filter.value
            return (
              <button
                key={filter.value}
                className={cn(
                  'flex items-center justify-center gap-1 h-8 px-2 text-xs rounded-lg transition-colors cursor-pointer',
                  isActive
                    ? 'bg-background text-foreground font-medium border border-border/80 shadow-sm'
                    : 'text-muted-foreground hover:bg-background/60 hover:text-foreground',
                )}
                onClick={() => setStatusFilter(filter.value)}
              >
                <Icon className="w-3.5 h-3.5" />
                {t(`playtelecom:users.filter.${filter.labelKey}`, { defaultValue: filter.labelKey })}
                <Badge
                  variant="secondary"
                  className={cn(
                    'h-4 min-w-4 px-1 text-[10px] rounded-full',
                    isActive ? 'bg-muted text-foreground' : 'bg-muted/70 text-muted-foreground',
                  )}
                >
                  {statusCounts[filter.value]}
                </Badge>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-[11px] text-muted-foreground">
            {t('playtelecom:users.filtering', { defaultValue: 'Mostrando' })}
          </span>
          <Badge variant="secondary" className="text-[11px] h-5 px-2 rounded-full">
            {filteredUsers.length}
          </Badge>
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-border/50 mx-3" />

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {filteredUsers.map(user => {
            const isSelected = selectedUserId === user.id
            return (
              <button
                key={user.id}
                onClick={() => onSelectUser(user.id)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-xl transition-all cursor-pointer group',
                  'hover:bg-muted/50 hover:-translate-y-[1px]',
                  isSelected ? 'bg-primary/10 ring-1 ring-primary/25 shadow-sm' : 'bg-transparent',
                )}
              >
                <div className="flex items-start gap-2.5">
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div
                      className={cn(
                        'w-9 h-9 rounded-full flex items-center justify-center text-sm font-medium',
                        isSelected
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted/80 text-muted-foreground group-hover:bg-muted',
                      )}
                    >
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt={user.name} className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span>{user.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <span
                      className={cn(
                        'absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-[1.5px] border-card',
                        user.status === 'active' ? 'bg-green-500' : 'bg-muted-foreground/40',
                      )}
                    />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0 space-y-1">
                    <p className="font-semibold text-[15px] truncate leading-tight">{user.name}</p>
                    <div className="min-w-0 max-w-full">
                      <RoleBadge role={user.role} getDisplayName={getDisplayName} getColor={getColor} />
                    </div>
                    <p className="text-xs text-muted-foreground whitespace-normal break-all leading-[1.2]">
                      {user.email}
                    </p>
                  </div>
                </div>
              </button>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="text-center py-10 text-muted-foreground">
              <Users className="w-7 h-7 mx-auto mb-2 opacity-20" />
              <p className="text-xs">{t('playtelecom:users.noResults', { defaultValue: 'Sin resultados' })}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default UserSidebar
