/**
 * UsersManagement - User Administration
 *
 * Displays:
 * - User list with roles
 * - Role assignment
 * - Permission management
 * - Activity log
 *
 * Access: ADMIN+ only
 */

import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Users, UserPlus, Shield, Mail, Phone, Calendar } from 'lucide-react'

// Placeholder data - will be replaced with real API calls
const MOCK_USERS = [
  {
    id: '1',
    name: 'Roberto Sánchez',
    email: 'roberto@playtelecom.mx',
    phone: '+52 555 123 4567',
    role: 'MANAGER',
    stores: ['Plaza Centro', 'Sucursal Este'],
    createdAt: '2023-06-15',
    status: 'active',
  },
  {
    id: '2',
    name: 'Ana Martínez',
    email: 'ana@playtelecom.mx',
    phone: '+52 555 234 5678',
    role: 'MANAGER',
    stores: ['Sucursal Norte'],
    createdAt: '2023-08-20',
    status: 'active',
  },
  {
    id: '3',
    name: 'Juan Pérez',
    email: 'juan@playtelecom.mx',
    phone: '+52 555 345 6789',
    role: 'CASHIER',
    stores: ['Plaza Centro'],
    createdAt: '2023-10-10',
    status: 'active',
  },
  {
    id: '4',
    name: 'María García',
    email: 'maria@playtelecom.mx',
    phone: '+52 555 456 7890',
    role: 'WAITER',
    stores: ['Sucursal Norte'],
    createdAt: '2023-11-05',
    status: 'inactive',
  },
]

const ROLE_CONFIG = {
  ADMIN: { label: 'Admin', variant: 'destructive' as const },
  MANAGER: { label: 'Gerente', variant: 'default' as const },
  CASHIER: { label: 'Cajero', variant: 'secondary' as const },
  WAITER: { label: 'Promotor', variant: 'outline' as const },
}

export function UsersManagement() {
  const { t } = useTranslation(['playtelecom', 'common'])

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
            <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">
              {t('playtelecom:users.title', { defaultValue: 'Gestión de Usuarios' })}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t('playtelecom:users.subtitle', { defaultValue: 'Administra usuarios y permisos' })}
            </p>
          </div>
        </div>
        <Button className="gap-2">
          <UserPlus className="w-4 h-4" />
          {t('playtelecom:users.invite', { defaultValue: 'Invitar Usuario' })}
        </Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-xl font-semibold">{MOCK_USERS.length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Shield className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gerentes</p>
              <p className="text-xl font-semibold">{MOCK_USERS.filter(u => u.role === 'MANAGER').length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Users className="w-4 h-4 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Promotores</p>
              <p className="text-xl font-semibold">{MOCK_USERS.filter(u => u.role === 'WAITER').length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5">
              <Users className="w-4 h-4 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Inactivos</p>
              <p className="text-xl font-semibold">{MOCK_USERS.filter(u => u.status === 'inactive').length}</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Users Table */}
      <GlassCard className="p-6">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:users.user', { defaultValue: 'Usuario' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:users.contact', { defaultValue: 'Contacto' })}
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:users.role', { defaultValue: 'Rol' })}
                </th>
                <th className="text-left py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:users.stores', { defaultValue: 'Tiendas' })}
                </th>
                <th className="text-center py-3 px-2 text-sm font-medium text-muted-foreground">
                  {t('playtelecom:users.status', { defaultValue: 'Estado' })}
                </th>
              </tr>
            </thead>
            <tbody>
              {MOCK_USERS.map(user => {
                const roleConfig = ROLE_CONFIG[user.role as keyof typeof ROLE_CONFIG]
                return (
                  <tr key={user.id} className="border-b border-border/30 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-sm font-medium text-primary">
                            {user.name.split(' ').map(n => n[0]).join('')}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium">{user.name}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="w-3 h-3" />
                            {user.createdAt}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2">
                      <div className="space-y-1">
                        <div className="flex items-center gap-1 text-sm">
                          <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                          {user.email}
                        </div>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Phone className="w-3.5 h-3.5" />
                          {user.phone}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={roleConfig.variant}>{roleConfig.label}</Badge>
                    </td>
                    <td className="py-3 px-2">
                      <div className="flex flex-wrap gap-1">
                        {user.stores.map(store => (
                          <Badge key={store} variant="outline" className="text-xs">
                            {store}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                        {user.status === 'active' ? 'Activo' : 'Inactivo'}
                      </Badge>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}

export default UsersManagement
