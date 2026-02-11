import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import {
  staffAPI,
  type StaffListItem,
  type CreateStaffData,
  type UpdateStaffData,
  type ListStaffParams,
} from '@/services/superadmin-staff.service'
import { organizationAPI } from '@/services/superadmin-organizations.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Building2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Shield,
  Store,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react'
import React, { useCallback, useMemo, useState } from 'react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDebounce } from '@/hooks/useDebounce'
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
import { FilterPill, CheckboxFilterContent } from '@/components/filters'

// ===========================================
// CONSTANTS
// ===========================================

const ORG_ROLES = [
  { value: 'OWNER', label: 'Propietario' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MEMBER', label: 'Miembro' },
  { value: 'VIEWER', label: 'Observador' },
]

const VENUE_ROLES = [
  { value: 'OWNER', label: 'Propietario' },
  { value: 'ADMIN', label: 'Administrador' },
  { value: 'MANAGER', label: 'Gerente' },
  { value: 'CASHIER', label: 'Cajero' },
  { value: 'WAITER', label: 'Mesero' },
  { value: 'KITCHEN', label: 'Cocina' },
  { value: 'HOST', label: 'Host' },
  { value: 'VIEWER', label: 'Observador' },
]

const ROLE_COLORS: Record<string, string> = {
  SUPERADMIN: 'bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/20',
  OWNER: 'bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/20',
  ADMIN: 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/20',
  MANAGER: 'bg-teal-500/10 text-teal-700 dark:text-teal-400 border-teal-500/20',
  CASHIER: 'bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20',
  WAITER: 'bg-cyan-500/10 text-cyan-700 dark:text-cyan-400 border-cyan-500/20',
  KITCHEN: 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/20',
  HOST: 'bg-pink-500/10 text-pink-700 dark:text-pink-400 border-pink-500/20',
  MEMBER: 'bg-slate-500/10 text-slate-700 dark:text-slate-400 border-slate-500/20',
  VIEWER: 'bg-muted text-muted-foreground border-border',
}

const STATUS_OPTIONS = [
  { value: 'true', label: 'Activo' },
  { value: 'false', label: 'Inactivo' },
]

const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className,
    )}
  >
    {children}
  </div>
)

// ===========================================
// CREATE STAFF DIALOG
// ===========================================

interface CreateStaffDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (data: CreateStaffData) => void
  isLoading: boolean
}

const CreateStaffDialog: React.FC<CreateStaffDialogProps> = ({
  open,
  onOpenChange,
  onSave,
  isLoading,
}) => {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [orgId, setOrgId] = useState('')
  const [orgRole, setOrgRole] = useState('MEMBER')
  const [venueId, setVenueId] = useState('')
  const [venueRole, setVenueRole] = useState('WAITER')
  const [pin, setPin] = useState('')

  const { data: orgs = [] } = useQuery({
    queryKey: ['superadmin-organizations-list'],
    queryFn: organizationAPI.getOrganizationsList,
    enabled: open,
  })

  const { data: orgDetail } = useQuery({
    queryKey: ['superadmin-organization', orgId],
    queryFn: () => organizationAPI.getOrganizationById(orgId),
    enabled: open && !!orgId,
  })

  const venues = orgDetail?.venues || []

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const actualVenueId = venueId && venueId !== 'none' ? venueId : undefined
    onSave({
      email,
      firstName,
      lastName,
      phone: phone || undefined,
      password: password || undefined,
      organizationId: orgId,
      orgRole,
      venueId: actualVenueId,
      venueRole: actualVenueId ? venueRole : undefined,
      pin: actualVenueId && pin ? pin : undefined,
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setEmail('')
      setFirstName('')
      setLastName('')
      setPhone('')
      setPassword('')
      setOrgId('')
      setOrgRole('MEMBER')
      setVenueId('')
      setVenueRole('WAITER')
      setPin('')
    }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Crear nuevo usuario</DialogTitle>
          <DialogDescription>
            Crea un usuario y asígnalo directamente a una organización y
            sucursal.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre *</Label>
              <Input
                value={firstName}
                onChange={e => setFirstName(e.target.value)}
                required
              />
            </div>
            <div>
              <Label>Apellido *</Label>
              <Input
                value={lastName}
                onChange={e => setLastName(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <Label>Email *</Label>
            <Input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div>
            <Label>Contraseña</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Dejar vacío para usuario PIN-only"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Mínimo 8 caracteres. Sin contraseña = usuario PIN-only (TPV).
            </p>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-3">Organización *</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Organización</Label>
                <Select
                  value={orgId}
                  onValueChange={v => {
                    setOrgId(v)
                    setVenueId('')
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar..." />
                  </SelectTrigger>
                  <SelectContent>
                    {orgs.map(org => (
                      <SelectItem key={org.id} value={org.id}>
                        {org.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rol en org</Label>
                <Select value={orgRole} onValueChange={setOrgRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORG_ROLES.map(r => (
                      <SelectItem key={r.value} value={r.value}>
                        {r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {orgId && (
            <div className="border-t pt-4">
              <p className="text-sm font-medium mb-3">Sucursal (opcional)</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Sucursal</Label>
                  <Select value={venueId} onValueChange={setVenueId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sin sucursal" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sin sucursal</SelectItem>
                      {venues.map(v => (
                        <SelectItem key={v.id} value={v.id}>
                          {v.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {venueId && venueId !== 'none' && (
                  <div>
                    <Label>Rol en sucursal</Label>
                    <Select value={venueRole} onValueChange={setVenueRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VENUE_ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              {venueId && venueId !== 'none' && (
                <div className="mt-3">
                  <Label>PIN (opcional)</Label>
                  <Input
                    value={pin}
                    onChange={e =>
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                    }
                    placeholder="4-6 dígitos"
                    maxLength={6}
                  />
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              className="cursor-pointer"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading || !email || !firstName || !lastName || !orgId}
              className="cursor-pointer"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear Usuario
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// EDIT STAFF DIALOG
// ===========================================

const EditStaffDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: StaffListItem | null
  onSave: (staffId: string, data: UpdateStaffData) => void
  isLoading: boolean
}> = ({ open, onOpenChange, staff, onSave, isLoading }) => {
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [phone, setPhone] = useState('')
  const [active, setActive] = useState(true)
  const [emailVerified, setEmailVerified] = useState(false)

  React.useEffect(() => {
    if (staff) {
      setFirstName(staff.firstName)
      setLastName(staff.lastName)
      setPhone(staff.phone || '')
      setActive(staff.active)
      setEmailVerified(staff.emailVerified)
    }
  }, [staff])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff) return
    onSave(staff.id, { firstName, lastName, phone: phone || null, active, emailVerified })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Editar usuario</DialogTitle>
          <DialogDescription>{staff?.email}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </div>
            <div>
              <Label>Apellido</Label>
              <Input value={lastName} onChange={e => setLastName(e.target.value)} required />
            </div>
          </div>
          <div>
            <Label>Teléfono</Label>
            <Input value={phone} onChange={e => setPhone(e.target.value)} />
          </div>
          <div className="flex items-center justify-between border-t pt-4">
            <div>
              <Label>Activo</Label>
              <p className="text-xs text-muted-foreground">Acceso al sistema</p>
            </div>
            <Switch checked={active} onCheckedChange={setActive} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <Label>Email verificado</Label>
              <p className="text-xs text-muted-foreground">Verificación manual</p>
            </div>
            <Switch checked={emailVerified} onCheckedChange={setEmailVerified} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button type="submit" disabled={isLoading} className="cursor-pointer">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Guardar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// ASSIGN ACCESS DIALOG (unified org + venue)
// ===========================================

type AccessType = 'org-owner' | 'venue-role'

interface AssignAccessParams {
  staffId: string
  organizationId: string
  accessType: AccessType
  venueIds?: string[]
  venueRole?: string
}

const AssignAccessDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: StaffListItem | null
  onSave: (params: AssignAccessParams) => void
  isLoading: boolean
}> = ({ open, onOpenChange, staff, onSave, isLoading }) => {
  const [orgId, setOrgId] = useState('')
  const [accessType, setAccessType] = useState<AccessType>('venue-role')
  const [selectedVenues, setSelectedVenues] = useState<Array<{ label: string; value: string }>>([])
  const [venueRole, setVenueRole] = useState('WAITER')

  const { data: orgs = [] } = useQuery({
    queryKey: ['superadmin-organizations-list'],
    queryFn: organizationAPI.getOrganizationsList,
    enabled: open,
  })

  // Filter out orgs staff already belongs to
  const existingOrgIds = useMemo(
    () => new Set(staff?.organizations.map(o => o.organizationId) || []),
    [staff],
  )

  const orgOptions = useMemo<SearchableSelectOption[]>(
    () => orgs
      .filter(org => !existingOrgIds.has(org.id))
      .map(org => ({ value: org.id, label: org.name })),
    [orgs, existingOrgIds],
  )

  // Fetch venues for selected org
  const { data: orgDetail } = useQuery({
    queryKey: ['superadmin-organization', orgId],
    queryFn: () => organizationAPI.getOrganizationById(orgId),
    enabled: open && !!orgId && accessType === 'venue-role',
  })

  // Filter out already-assigned venues
  const existingVenueIds = useMemo(
    () => new Set(staff?.venues.map(v => v.venueId) || []),
    [staff],
  )

  const venueOptions = useMemo(
    () => (orgDetail?.venues || [])
      .filter(v => !existingVenueIds.has(v.id))
      .map(v => ({ value: v.id, label: v.name })),
    [orgDetail, existingVenueIds],
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff || !orgId) return
    onSave({
      staffId: staff.id,
      organizationId: orgId,
      accessType,
      venueIds: accessType === 'venue-role' ? selectedVenues.map(v => v.value) : undefined,
      venueRole: accessType === 'venue-role' ? venueRole : undefined,
    })
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setOrgId(''); setAccessType('venue-role'); setSelectedVenues([])
      setVenueRole('WAITER')
    }
    onOpenChange(isOpen)
  }

  const isSubmitDisabled = isLoading || !orgId || (accessType === 'venue-role' && selectedVenues.length === 0)

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Asignar acceso</DialogTitle>
          <DialogDescription>
            {staff?.firstName} {staff?.lastName}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {orgOptions.length === 0 && orgs.length > 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              El usuario ya pertenece a todas las organizaciones.
            </p>
          ) : (
            <>
              {/* 1. Org selector */}
              <div>
                <Label>Organización</Label>
                <SearchableSelect
                  options={orgOptions}
                  value={orgId}
                  onValueChange={v => { setOrgId(v); setSelectedVenues([]) }}
                  placeholder="Buscar organización..."
                  searchPlaceholder="Buscar..."
                  emptyMessage="Sin resultados"
                  searchThreshold={3}
                />
              </div>

              {/* 2. Access type — radio cards */}
              {orgId && (
                <div>
                  <Label className="mb-2 block">Tipo de acceso</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => { setAccessType('org-owner'); setSelectedVenues([]) }}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer',
                        accessType === 'org-owner'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <span className="text-sm font-medium">Propietario de org</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        Acceso total a todas las sucursales
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccessType('venue-role')}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-lg border p-3 text-left transition-colors cursor-pointer',
                        accessType === 'venue-role'
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'border-border hover:bg-muted/50',
                      )}
                    >
                      <span className="text-sm font-medium">Rol en sucursal</span>
                      <span className="text-[11px] text-muted-foreground leading-tight">
                        Selecciona una o varias sucursales
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {/* 3. Venue fields — only for venue-role */}
              {orgId && accessType === 'venue-role' && (
                <>
                  <div>
                    <Label>Sucursales</Label>
                    {venueOptions.length === 0 && orgDetail ? (
                      <p className="text-sm text-muted-foreground py-2">
                        No hay sucursales disponibles en esta organización.
                      </p>
                    ) : (
                      <MultiSelectCombobox
                        options={venueOptions}
                        selected={selectedVenues}
                        onChange={setSelectedVenues}
                        placeholder="Buscar sucursales..."
                        emptyText="Sin resultados"
                        isLoading={!orgDetail && !!orgId}
                      />
                    )}
                  </div>
                  <div>
                    <Label>Rol</Label>
                    <Select value={venueRole} onValueChange={setVenueRole}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {VENUE_ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Se aplicará el mismo rol a todas las sucursales seleccionadas.
                    </p>
                  </div>
                </>
              )}
            </>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="cursor-pointer">
              Cancelar
            </Button>
            {orgOptions.length > 0 && (
              <Button type="submit" disabled={isSubmitDisabled} className="cursor-pointer">
                {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                {accessType === 'venue-role' && selectedVenues.length > 1
                  ? `Asignar ${selectedVenues.length} sucursales`
                  : 'Asignar'}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// RESET PASSWORD DIALOG
// ===========================================

const ResetPasswordDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  staff: StaffListItem | null
  onSave: (staffId: string, newPassword: string) => void
  isLoading: boolean
}> = ({ open, onOpenChange, staff, onSave, isLoading }) => {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!staff || password !== confirm) return
    onSave(staff.id, password)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) { setPassword(''); setConfirm('') }
    onOpenChange(isOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            {staff?.firstName} {staff?.lastName} ({staff?.email})
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nueva contraseña</Label>
            <div className="relative">
              <Input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => setPassword(e.target.value)}
                minLength={8}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
          <div>
            <Label>Confirmar contraseña</Label>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={confirm}
              onChange={e => setConfirm(e.target.value)}
              required
            />
            {confirm && password !== confirm && (
              <p className="text-xs text-destructive mt-1">Las contraseñas no coinciden</p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)} className="cursor-pointer">Cancelar</Button>
            <Button type="submit" disabled={isLoading || !password || password.length < 8 || password !== confirm} className="cursor-pointer">
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Cambiar
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// STAFF DETAIL DIALOG
// ===========================================

const StaffDetailDialog: React.FC<{
  open: boolean
  onOpenChange: (open: boolean) => void
  staffId: string | null
  onRemoveOrg: (staffId: string, organizationId: string) => void
  onRemoveVenue: (staffId: string, venueId: string) => void
}> = ({ open, onOpenChange, staffId, onRemoveOrg, onRemoveVenue }) => {
  const { data: detail, isLoading } = useQuery({
    queryKey: ['superadmin-staff-detail', staffId],
    queryFn: () => staffAPI.getStaffById(staffId!),
    enabled: open && !!staffId,
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalle de usuario</DialogTitle>
          <DialogDescription>
            {detail ? `${detail.firstName} ${detail.lastName} — ${detail.email}` : ''}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-muted-foreground">Estado</p>
                <Badge variant="outline" className={cn('rounded-full mt-1', detail.active ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400' : 'bg-red-500/10 text-red-700 dark:text-red-400')}>
                  {detail.active ? 'Activo' : 'Inactivo'}
                </Badge>
              </div>
              <div>
                <p className="text-muted-foreground">Email verificado</p>
                <Badge variant="outline" className={cn('rounded-full mt-1', detail.emailVerified ? 'bg-blue-500/10 text-blue-700' : 'bg-muted text-muted-foreground')}>
                  {detail.emailVerified ? 'Sí' : 'No'}
                </Badge>
              </div>
              {detail.phone && (
                <div>
                  <p className="text-muted-foreground">Teléfono</p>
                  <p className="font-medium">{detail.phone}</p>
                </div>
              )}
              <div>
                <p className="text-muted-foreground">Creado</p>
                <p className="font-medium">{new Date(detail.createdAt).toLocaleDateString('es-MX')}</p>
              </div>
            </div>

            {/* Organizations */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
                <Building2 className="w-4 h-4" /> Organizaciones ({detail.organizations.length})
              </h4>
              {detail.organizations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin organizaciones</p>
              ) : (
                <div className="space-y-1">
                  {detail.organizations.map(org => (
                    <div key={org.id} className={cn('flex items-center justify-between py-1.5 px-2 rounded text-sm', org.isActive ? 'bg-muted/50' : 'bg-muted/20 opacity-50')}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{org.organization.name}</span>
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0', ROLE_COLORS[org.role])}>{org.role}</Badge>
                        {org.isPrimary && <Badge variant="outline" className="text-[10px] px-1.5 py-0">1a</Badge>}
                      </div>
                      {org.isActive && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive cursor-pointer" onClick={() => onRemoveOrg(detail.id, org.organizationId)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Venues */}
            <div className="border-t pt-4">
              <h4 className="font-medium mb-2 flex items-center gap-2 text-sm">
                <Store className="w-4 h-4" /> Sucursales ({detail.venues.length})
              </h4>
              {detail.venues.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sin sucursales</p>
              ) : (
                <div className="space-y-1">
                  {detail.venues.map(v => (
                    <div key={v.id} className={cn('flex items-center justify-between py-1.5 px-2 rounded text-sm', v.active ? 'bg-muted/50' : 'bg-muted/20 opacity-50')}>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-medium truncate">{v.venue.name}</span>
                        <span className="text-[10px] text-muted-foreground shrink-0">({v.venue.organization.name})</span>
                        <Badge variant="outline" className={cn('text-[10px] px-1.5 py-0 shrink-0', ROLE_COLORS[v.role])}>{v.role}</Badge>
                        {v.pin && <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-mono shrink-0">PIN:{v.pin}</Badge>}
                      </div>
                      {v.active && (
                        <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive cursor-pointer shrink-0" onClick={() => onRemoveVenue(detail.id, v.venueId)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

// ===========================================
// MAIN COMPONENT — TABLE LAYOUT
// ===========================================

const StaffManagement: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [page, setPage] = useState(1)
  const [searchInput, setSearchInput] = useState('')
  const debouncedSearch = useDebounce(searchInput, 300)
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [orgFilter, setOrgFilter] = useState<string[]>([])
  const [venueRoleFilter, setVenueRoleFilter] = useState<string[]>([])

  const [selectedStaff, setSelectedStaff] = useState<StaffListItem | null>(null)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const [isAssignAccessOpen, setIsAssignAccessOpen] = useState(false)
  const [isResetPasswordOpen, setIsResetPasswordOpen] = useState(false)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [detailStaffId, setDetailStaffId] = useState<string | null>(null)
  const [isDetailOpen, setIsDetailOpen] = useState(false)

  const { data: orgs = [] } = useQuery({
    queryKey: ['superadmin-organizations-list'],
    queryFn: organizationAPI.getOrganizationsList,
  })

  const orgOptions = useMemo(
    () => orgs.map(o => ({ value: o.id, label: o.name })),
    [orgs],
  )

  // Map checkbox status filter to API param
  const activeParam = useMemo(() => {
    if (statusFilter.length === 0) return 'all' as const
    if (statusFilter.length === 1) return statusFilter[0] as 'true' | 'false'
    return 'all' as const // both selected = all
  }, [statusFilter])

  const queryParams: ListStaffParams = useMemo(
    () => ({
      page,
      pageSize: 30,
      search: debouncedSearch || undefined,
      active: activeParam,
      organizationId: orgFilter.length === 1 ? orgFilter[0] : undefined,
    }),
    [page, debouncedSearch, activeParam, orgFilter],
  )

  const { data, isLoading } = useQuery({
    queryKey: ['superadmin-staff', queryParams],
    queryFn: () => staffAPI.listStaff(queryParams),
  })

  const rawStaffList = data?.staff || []
  const pagination = data?.pagination

  // Client-side filter for venue role (not in API) and multi-org
  const staffList = useMemo(() => {
    let list = rawStaffList
    // Multi-org filter (API only supports single org, client filters for multi)
    if (orgFilter.length > 1) {
      list = list.filter(s => s.organizations.some(o => orgFilter.includes(o.organizationId)))
    }
    // Venue role filter (client-side)
    if (venueRoleFilter.length > 0) {
      list = list.filter(s => s.venues.some(v => venueRoleFilter.includes(v.role)))
    }
    return list
  }, [rawStaffList, orgFilter, venueRoleFilter])

  const handleSearchChange = useCallback((value: string) => {
    setSearchInput(value)
    setPage(1)
  }, [])

  // Helper to display filter labels
  const getFilterDisplayLabel = useCallback(
    (values: string[], options: { value: string; label: string }[]) => {
      if (values.length === 0) return null
      if (values.length === 1) return options.find(o => o.value === values[0])?.label || values[0]
      return `${values.length} seleccionados`
    },
    [],
  )

  const activeFiltersCount = (statusFilter.length > 0 ? 1 : 0) + (orgFilter.length > 0 ? 1 : 0) + (venueRoleFilter.length > 0 ? 1 : 0)

  const resetFilters = useCallback(() => {
    setStatusFilter([])
    setOrgFilter([])
    setVenueRoleFilter([])
    setPage(1)
  }, [])

  const invalidateStaff = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['superadmin-staff'] })
    queryClient.invalidateQueries({ queryKey: ['superadmin-staff-detail'] })
  }, [queryClient])

  // --- Mutations ---
  const createMutation = useMutation({
    mutationFn: (d: CreateStaffData) => staffAPI.createStaff(d),
    onSuccess: () => { toast({ title: 'Usuario creado' }); invalidateStaff(); setIsCreateOpen(false) },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })
  const updateMutation = useMutation({
    mutationFn: ({ id, data: d }: { id: string; data: UpdateStaffData }) => staffAPI.updateStaff(id, d),
    onSuccess: () => { toast({ title: 'Usuario actualizado' }); invalidateStaff(); setIsEditOpen(false); setSelectedStaff(null) },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })
  const assignAccessMutation = useMutation({
    mutationFn: async (params: AssignAccessParams) => {
      if (params.accessType === 'org-owner') {
        return staffAPI.assignToOrganization(params.staffId, params.organizationId, 'OWNER')
      }
      // Venue role — first ensure org membership (MEMBER), then assign all selected venues
      await staffAPI.assignToOrganization(params.staffId, params.organizationId, 'MEMBER')
      const venueIds = params.venueIds || []
      await Promise.all(
        venueIds.map(vid => staffAPI.assignToVenue(params.staffId, vid, params.venueRole!)),
      )
    },
    onSuccess: (_data, params) => {
      const count = params.venueIds?.length || 0
      const msg = params.accessType === 'org-owner'
        ? 'Asignado como propietario de org'
        : count > 1 ? `Asignado a ${count} sucursales` : 'Asignado a sucursal'
      toast({ title: msg })
      invalidateStaff()
      setIsAssignAccessOpen(false)
    },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })
  const resetPasswordMutation = useMutation({
    mutationFn: ({ staffId, newPassword }: { staffId: string; newPassword: string }) =>
      staffAPI.resetPassword(staffId, newPassword),
    onSuccess: () => { toast({ title: 'Contraseña actualizada' }); setIsResetPasswordOpen(false) },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })
  const removeOrgMutation = useMutation({
    mutationFn: ({ staffId, organizationId }: { staffId: string; organizationId: string }) =>
      staffAPI.removeFromOrganization(staffId, organizationId),
    onSuccess: () => { toast({ title: 'Removido de organización' }); invalidateStaff() },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })
  const removeVenueMutation = useMutation({
    mutationFn: ({ staffId, venueId }: { staffId: string; venueId: string }) =>
      staffAPI.removeFromVenue(staffId, venueId),
    onSuccess: () => { toast({ title: 'Removido de sucursal' }); invalidateStaff() },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })
  const deleteMutation = useMutation({
    mutationFn: (staffId: string) => staffAPI.deleteStaff(staffId),
    onSuccess: () => { toast({ title: 'Usuario eliminado' }); invalidateStaff(); setIsDeleteOpen(false); setSelectedStaff(null) },
    onError: (e: any) => { toast({ title: 'Error', description: e?.response?.data?.error || e.message, variant: 'destructive' }) },
  })

  // Compute stats from current data
  const stats = useMemo(() => {
    if (!pagination) return { total: 0, active: 0, withOrg: 0, withVenue: 0 }
    return {
      total: pagination.total,
      active: staffList.filter(s => s.active).length,
      withOrg: staffList.filter(s => s.organizations.length > 0).length,
      withVenue: staffList.filter(s => s.venues.length > 0).length,
    }
  }, [staffList, pagination])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Gestión de Usuarios</h1>
          <p className="text-muted-foreground">Administra usuarios, asignaciones a organizaciones y sucursales</p>
        </div>
        <Button
          onClick={() => setIsCreateOpen(true)}
          className="bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 rounded-full cursor-pointer"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nuevo Usuario
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.total}</p>
              <p className="text-xs text-muted-foreground">Total Usuarios</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5">
              <UserCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.active}</p>
              <p className="text-xs text-muted-foreground">Activos</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
              <Building2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withOrg}</p>
              <p className="text-xs text-muted-foreground">Con Organización</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
              <Store className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats.withVenue}</p>
              <p className="text-xs text-muted-foreground">Con Sucursal</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Stripe-style Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Buscar..."
            value={searchInput}
            onChange={e => handleSearchChange(e.target.value)}
            className="h-8 w-[200px] pl-9 rounded-full text-sm"
          />
        </div>

        <FilterPill
          label="Estado"
          activeLabel={getFilterDisplayLabel(statusFilter, STATUS_OPTIONS)}
          onClear={() => { setStatusFilter([]); setPage(1) }}
        >
          <CheckboxFilterContent
            title="Estado"
            options={STATUS_OPTIONS}
            selectedValues={statusFilter}
            onApply={v => { setStatusFilter(v); setPage(1) }}
          />
        </FilterPill>

        <FilterPill
          label="Organización"
          activeLabel={getFilterDisplayLabel(orgFilter, orgOptions)}
          onClear={() => { setOrgFilter([]); setPage(1) }}
        >
          <CheckboxFilterContent
            title="Organización"
            options={orgOptions}
            selectedValues={orgFilter}
            onApply={v => { setOrgFilter(v); setPage(1) }}
            searchable
            searchPlaceholder="Buscar organización..."
          />
        </FilterPill>

        <FilterPill
          label="Rol"
          activeLabel={getFilterDisplayLabel(venueRoleFilter, VENUE_ROLES)}
          onClear={() => { setVenueRoleFilter([]); setPage(1) }}
        >
          <CheckboxFilterContent
            title="Rol en sucursal"
            options={VENUE_ROLES}
            selectedValues={venueRoleFilter}
            onApply={v => { setVenueRoleFilter(v); setPage(1) }}
          />
        </FilterPill>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1 rounded-full text-muted-foreground hover:text-foreground"
            onClick={resetFilters}
          >
            <X className="h-3.5 w-3.5" />
            Borrar filtros
          </Button>
        )}
      </div>

      {/* Table */}
      <GlassCard className="overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/30 hover:bg-muted/30">
              <TableHead className="w-[220px] font-semibold">Usuario</TableHead>
              <TableHead className="w-[200px] font-semibold">Email</TableHead>
              <TableHead className="w-[80px] text-center font-semibold">Estado</TableHead>
              <TableHead className="font-semibold">Organizaciones</TableHead>
              <TableHead className="font-semibold">Sucursales</TableHead>
              <TableHead className="w-[48px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <TableRow key={i}>
                  <TableCell className="py-3">
                    <div className="space-y-1.5">
                      <div className="h-4 bg-muted animate-pulse rounded-full w-32" />
                      <div className="h-3 bg-muted/60 animate-pulse rounded-full w-20" />
                    </div>
                  </TableCell>
                  <TableCell className="py-3"><div className="h-4 bg-muted animate-pulse rounded-full w-40" /></TableCell>
                  <TableCell className="py-3"><div className="h-4 bg-muted animate-pulse rounded-full w-4 mx-auto" /></TableCell>
                  <TableCell className="py-3"><div className="h-5 bg-muted animate-pulse rounded-full w-24" /></TableCell>
                  <TableCell className="py-3"><div className="h-5 bg-muted animate-pulse rounded-full w-24" /></TableCell>
                  <TableCell className="py-3" />
                </TableRow>
              ))
            ) : staffList.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-16">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="w-8 h-8 text-muted-foreground/40" />
                    <p className="text-muted-foreground">
                      {searchInput || activeFiltersCount > 0
                        ? 'Sin resultados para estos filtros'
                        : 'No hay usuarios registrados'}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              staffList.map(s => (
                <TableRow
                  key={s.id}
                  className="cursor-pointer hover:bg-muted/30 transition-colors"
                  onClick={() => { setDetailStaffId(s.id); setIsDetailOpen(true) }}
                >
                  <TableCell className="py-2.5">
                    <div className="font-medium text-sm leading-tight">
                      {s.firstName} {s.lastName}
                    </div>
                    {s.phone && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{s.phone}</div>
                    )}
                  </TableCell>
                  <TableCell className="py-2.5">
                    <span className="text-sm text-muted-foreground">{s.email}</span>
                  </TableCell>
                  <TableCell className="py-2.5 text-center">
                    <span className={cn(
                      'inline-block w-2.5 h-2.5 rounded-full ring-2',
                      s.active
                        ? 'bg-emerald-500 ring-emerald-500/20'
                        : 'bg-red-400 ring-red-400/20',
                    )} title={s.active ? 'Activo' : 'Inactivo'} />
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {s.organizations.map(o => (
                        <Badge
                          key={o.organizationId}
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0 rounded-full', ROLE_COLORS[o.role])}
                        >
                          {o.organization.name}
                          {o.role === 'OWNER' && <Shield className="w-2.5 h-2.5 ml-0.5 inline" />}
                        </Badge>
                      ))}
                      {s.organizations.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">Sin org</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5">
                    <div className="flex flex-wrap gap-1">
                      {s.venues.slice(0, 3).map(v => (
                        <Badge
                          key={v.venueId}
                          variant="outline"
                          className={cn('text-[10px] px-1.5 py-0 rounded-full', ROLE_COLORS[v.role])}
                        >
                          {v.venue.name}
                        </Badge>
                      ))}
                      {s.venues.length > 3 && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 rounded-full bg-muted/50">
                          +{s.venues.length - 3}
                        </Badge>
                      )}
                      {s.venues.length === 0 && (
                        <span className="text-[11px] text-muted-foreground italic">Sin sucursal</span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="py-2.5" onClick={e => e.stopPropagation()}>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer rounded-full hover:bg-muted">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedStaff(s); setIsEditOpen(true) }}>
                          <UserCheck className="w-4 h-4 mr-2" /> Editar perfil
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedStaff(s); setIsAssignAccessOpen(true) }}>
                          <Plus className="w-4 h-4 mr-2" /> Asignar acceso
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer" onClick={() => { setSelectedStaff(s); setIsResetPasswordOpen(true) }}>
                          <KeyRound className="w-4 h-4 mr-2" /> Cambiar contraseña
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="cursor-pointer text-destructive focus:text-destructive" onClick={() => { setSelectedStaff(s); setIsDeleteOpen(true) }}>
                          <Trash2 className="w-4 h-4 mr-2" /> Eliminar usuario
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </GlassCard>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Página {pagination.page} de {pagination.totalPages} ({pagination.total} usuarios)
          </span>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 cursor-pointer rounded-full" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8 cursor-pointer rounded-full" disabled={page >= pagination.totalPages} onClick={() => setPage(p => p + 1)}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Dialogs */}
      <CreateStaffDialog open={isCreateOpen} onOpenChange={setIsCreateOpen} onSave={d => createMutation.mutate(d)} isLoading={createMutation.isPending} />
      <EditStaffDialog open={isEditOpen} onOpenChange={setIsEditOpen} staff={selectedStaff} onSave={(id, d) => updateMutation.mutate({ id, data: d })} isLoading={updateMutation.isPending} />
      <AssignAccessDialog open={isAssignAccessOpen} onOpenChange={setIsAssignAccessOpen} staff={selectedStaff} onSave={p => assignAccessMutation.mutate(p)} isLoading={assignAccessMutation.isPending} />
      <ResetPasswordDialog open={isResetPasswordOpen} onOpenChange={setIsResetPasswordOpen} staff={selectedStaff} onSave={(sid, pw) => resetPasswordMutation.mutate({ staffId: sid, newPassword: pw })} isLoading={resetPasswordMutation.isPending} />
      <StaffDetailDialog open={isDetailOpen} onOpenChange={setIsDetailOpen} staffId={detailStaffId} onRemoveOrg={(sid, oid) => removeOrgMutation.mutate({ staffId: sid, organizationId: oid })} onRemoveVenue={(sid, vid) => removeVenueMutation.mutate({ staffId: sid, venueId: vid })} />

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar usuario?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Se eliminará el usuario{' '}
              <strong>{selectedStaff?.firstName} {selectedStaff?.lastName}</strong>{' '}
              ({selectedStaff?.email}) y todos sus accesos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 cursor-pointer"
              disabled={deleteMutation.isPending}
              onClick={() => selectedStaff && deleteMutation.mutate(selectedStaff.id)}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default StaffManagement
