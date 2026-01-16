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
import { Button } from '@/components/ui/button'
import { UserPlus } from 'lucide-react'
import {
  UserSidebar,
  UserDetailPanel,
  type UserListItem,
  type UserDetail,
  type Zone,
  type StoreOption,
} from './components'

// Mock zones
const MOCK_ZONES: Zone[] = [
  { id: 'cdmx', name: 'CDMX' },
  { id: 'norte', name: 'Zona Norte' },
  { id: 'sur', name: 'Zona Sur' },
  { id: 'occidente', name: 'Zona Occidente' },
]

// Mock stores
const MOCK_STORES: StoreOption[] = [
  { id: 'store-1', name: 'Plaza Centro', zoneId: 'cdmx', address: 'Av. Reforma 123' },
  { id: 'store-2', name: 'Sucursal Este', zoneId: 'cdmx', address: 'Col. Roma Norte' },
  { id: 'store-3', name: 'Tienda Polanco', zoneId: 'cdmx', address: 'Polanco IV' },
  { id: 'store-4', name: 'Sucursal Monterrey', zoneId: 'norte', address: 'San Pedro Garza' },
  { id: 'store-5', name: 'Plaza Guadalajara', zoneId: 'occidente', address: 'Zapopan' },
  { id: 'store-6', name: 'Tienda Cancún', zoneId: 'sur', address: 'Zona Hotelera' },
]

// Mock users with full details
const MOCK_USERS_FULL: UserDetail[] = [
  {
    id: '1',
    name: 'Roberto Sánchez',
    email: 'roberto@playtelecom.mx',
    phone: '+52 555 123 4567',
    role: 'MANAGER',
    status: 'active',
    createdAt: '2023-06-15',
    selectedZone: 'cdmx',
    selectedStores: ['store-1', 'store-2'],
    permissions: [
      'sales:view', 'sales:create', 'sales:cancel',
      'inventory:view', 'inventory:edit',
      'team:view', 'team:manage',
      'reports:view', 'reports:export',
      'payments:view',
    ],
    auditLog: [
      { id: '1', timestamp: '2024-01-15T10:30:00Z', action: 'login', message: 'Inicio de sesión exitoso', ip: '192.168.1.100' },
      { id: '2', timestamp: '2024-01-14T16:45:00Z', action: 'permission_change', message: 'Permiso añadido', details: 'reports:export' },
      { id: '3', timestamp: '2024-01-12T09:00:00Z', action: 'store_assignment', message: 'Tienda asignada', details: 'Sucursal Este' },
      { id: '4', timestamp: '2024-01-10T14:20:00Z', action: 'role_change', message: 'Rol actualizado', details: 'CASHIER → MANAGER' },
      { id: '5', timestamp: '2024-01-05T11:00:00Z', action: 'login', message: 'Inicio de sesión exitoso', ip: '192.168.1.105' },
    ],
  },
  {
    id: '2',
    name: 'Ana Martínez',
    email: 'ana@playtelecom.mx',
    phone: '+52 555 234 5678',
    role: 'MANAGER',
    status: 'active',
    createdAt: '2023-08-20',
    selectedZone: 'norte',
    selectedStores: ['store-4'],
    permissions: [
      'sales:view', 'sales:create',
      'inventory:view',
      'team:view', 'team:manage',
      'reports:view',
    ],
    auditLog: [
      { id: '1', timestamp: '2024-01-15T08:15:00Z', action: 'login', message: 'Inicio de sesión exitoso', ip: '192.168.2.50' },
      { id: '2', timestamp: '2024-01-10T12:00:00Z', action: 'logout', message: 'Cierre de sesión' },
    ],
  },
  {
    id: '3',
    name: 'Juan Pérez',
    email: 'juan@playtelecom.mx',
    phone: '+52 555 345 6789',
    role: 'PROMOTOR',
    status: 'active',
    createdAt: '2023-10-10',
    selectedZone: 'cdmx',
    selectedStores: ['store-1'],
    permissions: [
      'sales:view', 'sales:create',
      'inventory:view',
    ],
    auditLog: [
      { id: '1', timestamp: '2024-01-15T07:00:00Z', action: 'login', message: 'Inicio de sesión exitoso', ip: '10.0.0.15' },
      { id: '2', timestamp: '2024-01-14T19:30:00Z', action: 'logout', message: 'Cierre de sesión' },
      { id: '3', timestamp: '2024-01-14T07:05:00Z', action: 'login', message: 'Inicio de sesión exitoso', ip: '10.0.0.15' },
    ],
  },
  {
    id: '4',
    name: 'María García',
    email: 'maria@playtelecom.mx',
    phone: '+52 555 456 7890',
    role: 'PROMOTOR',
    status: 'inactive',
    createdAt: '2023-11-05',
    selectedZone: null,
    selectedStores: [],
    permissions: [
      'sales:view',
    ],
    auditLog: [
      { id: '1', timestamp: '2024-01-10T09:00:00Z', action: 'warning', message: 'Cuenta desactivada', details: 'Inactividad por 30 días' },
      { id: '2', timestamp: '2023-12-10T18:00:00Z', action: 'logout', message: 'Cierre de sesión' },
    ],
  },
  {
    id: '5',
    name: 'Carlos López',
    email: 'carlos@playtelecom.mx',
    phone: '+52 555 567 8901',
    role: 'ADMIN',
    status: 'active',
    createdAt: '2023-05-01',
    selectedZone: null,
    selectedStores: ['store-1', 'store-2', 'store-3', 'store-4', 'store-5', 'store-6'],
    permissions: [
      'sales:view', 'sales:create', 'sales:cancel',
      'inventory:view', 'inventory:edit', 'inventory:transfer',
      'team:view', 'team:manage', 'team:approve',
      'reports:view', 'reports:export',
      'payments:view', 'payments:approve', 'payments:refund',
      'settings:view', 'settings:edit',
    ],
    auditLog: [
      { id: '1', timestamp: '2024-01-15T06:00:00Z', action: 'login', message: 'Inicio de sesión exitoso', ip: '172.16.0.1' },
      { id: '2', timestamp: '2024-01-14T23:00:00Z', action: 'permission_change', message: 'Permisos actualizados', details: 'Usuario: Juan Pérez' },
      { id: '3', timestamp: '2024-01-14T22:30:00Z', action: 'role_change', message: 'Rol modificado', details: 'Usuario: Ana Martínez' },
    ],
  },
]

export function UsersManagement() {
  const { t } = useTranslation(['playtelecom', 'common'])

  // State
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  // Convert full users to list items for sidebar
  const userListItems: UserListItem[] = useMemo(() =>
    MOCK_USERS_FULL.map(user => ({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      avatarUrl: user.avatarUrl,
    })),
  [])

  // Get selected user details
  const selectedUser = useMemo(() =>
    MOCK_USERS_FULL.find(u => u.id === selectedUserId) || null,
  [selectedUserId])

  // Handle save
  const handleSave = useCallback((updates: Partial<UserDetail>) => {
    setIsSaving(true)
    console.log('Saving user updates:', updates)

    // Simulate API call
    setTimeout(() => {
      setIsSaving(false)
      // In real implementation, update the user data
    }, 1000)
  }, [])

  // Handle status change
  const handleStatusChange = useCallback((status: 'active' | 'inactive' | 'blocked') => {
    console.log('Changing status to:', status)
    // In real implementation, update the user status
  }, [])

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
            zones={MOCK_ZONES}
            stores={MOCK_STORES}
            onSave={handleSave}
            onStatusChange={handleStatusChange}
            isSaving={isSaving}
          />
        </div>
      </div>
    </div>
  )
}

export default UsersManagement
