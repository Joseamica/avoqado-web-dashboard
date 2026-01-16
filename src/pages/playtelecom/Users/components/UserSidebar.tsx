/**
 * UserSidebar - Searchable user list with status filters
 */

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Search,
  Users,
  UserCheck,
  UserX,
  User,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface UserListItem {
  id: string
  name: string
  email: string
  role: string
  status: 'active' | 'inactive' | 'blocked'
  avatarUrl?: string
}

interface UserSidebarProps {
  users: UserListItem[]
  selectedUserId: string | null
  onSelectUser: (userId: string) => void
  className?: string
}

type StatusFilter = 'all' | 'active' | 'inactive' | 'blocked'

const STATUS_FILTERS: { value: StatusFilter; icon: React.ElementType; labelKey: string }[] = [
  { value: 'all', icon: Users, labelKey: 'all' },
  { value: 'active', icon: UserCheck, labelKey: 'active' },
  { value: 'inactive', icon: UserX, labelKey: 'inactive' },
]

const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-red-500/10 text-red-600 dark:text-red-400',
  MANAGER: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
  CASHIER: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
  WAITER: 'bg-green-500/10 text-green-600 dark:text-green-400',
}

export const UserSidebar: React.FC<UserSidebarProps> = ({
  users,
  selectedUserId,
  onSelectUser,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')

  // Filter users based on search and status
  const filteredUsers = useMemo(() => {
    return users.filter(user => {
      // Status filter
      if (statusFilter !== 'all' && user.status !== statusFilter) {
        return false
      }
      // Search filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase()
        return (
          user.name.toLowerCase().includes(term) ||
          user.email.toLowerCase().includes(term)
        )
      }
      return true
    })
  }, [users, searchTerm, statusFilter])

  // Count by status
  const statusCounts = useMemo(() => ({
    all: users.length,
    active: users.filter(u => u.status === 'active').length,
    inactive: users.filter(u => u.status === 'inactive').length,
    blocked: users.filter(u => u.status === 'blocked').length,
  }), [users])

  return (
    <div className={cn('flex flex-col h-full bg-muted/30 border-r border-border/50', className)}>
      {/* Header */}
      <div className="p-4 border-b border-border/50">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-medium text-sm">
            {t('playtelecom:users.userList', { defaultValue: 'Lista de Usuarios' })}
          </h3>
          <Badge variant="secondary" className="ml-auto">
            {filteredUsers.length}
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={t('playtelecom:users.searchPlaceholder', { defaultValue: 'Buscar usuario...' })}
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </div>

      {/* Status Filter Pills */}
      <div className="px-4 py-3 flex gap-1 border-b border-border/50">
        {STATUS_FILTERS.map(filter => {
          const Icon = filter.icon
          const isActive = statusFilter === filter.value
          return (
            <Button
              key={filter.value}
              variant={isActive ? 'default' : 'ghost'}
              size="sm"
              className={cn(
                'h-7 px-2 text-xs gap-1',
                isActive && 'bg-primary text-primary-foreground'
              )}
              onClick={() => setStatusFilter(filter.value)}
            >
              <Icon className="w-3 h-3" />
              <span className="hidden sm:inline">
                {t(`playtelecom:users.filter.${filter.labelKey}`, { defaultValue: filter.labelKey })}
              </span>
              <span className="text-xs opacity-70">
                ({statusCounts[filter.value]})
              </span>
            </Button>
          )
        })}
      </div>

      {/* User List */}
      <ScrollArea className="flex-1">
        <div className="p-2">
          {filteredUsers.map(user => {
            const isSelected = selectedUserId === user.id
            return (
              <button
                key={user.id}
                onClick={() => onSelectUser(user.id)}
                className={cn(
                  'w-full text-left p-3 rounded-lg mb-1 transition-all',
                  'hover:bg-muted/50',
                  isSelected && 'bg-primary/10 border border-primary/20'
                )}
              >
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="relative">
                    <div className={cn(
                      'w-10 h-10 rounded-full flex items-center justify-center',
                      'bg-gradient-to-br from-primary/20 to-primary/5'
                    )}>
                      {user.avatarUrl ? (
                        <img
                          src={user.avatarUrl}
                          alt={user.name}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <User className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    {/* Status dot */}
                    <span className={cn(
                      'absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-background',
                      user.status === 'active' && 'bg-green-500',
                      user.status === 'inactive' && 'bg-gray-400',
                      user.status === 'blocked' && 'bg-red-500'
                    )} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{user.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>

                  {/* Role Badge */}
                  <Badge
                    variant="outline"
                    className={cn(
                      'text-[10px] px-1.5 py-0',
                      ROLE_COLORS[user.role] || 'bg-muted'
                    )}
                  >
                    {user.role}
                  </Badge>
                </div>
              </button>
            )
          })}

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t('playtelecom:users.noResults', { defaultValue: 'No se encontraron usuarios' })}
              </p>
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export default UserSidebar
