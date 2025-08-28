import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Shield, Eye, EyeOff } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import teamService, { TeamMember, UpdateTeamMemberRequest } from '@/services/team.service'
import { canViewSuperadminInfo, getRoleDisplayName, getRoleBadgeColor } from '@/utils/role-permissions'

const editTeamMemberSchema = z.object({
  role: z.nativeEnum(StaffRole).optional(),
  active: z.boolean().optional(),
  pin: z
    .string()
    .regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 dígitos')
    .optional()
    .or(z.literal('')),
})

type EditTeamMemberFormData = z.infer<typeof editTeamMemberSchema>

interface EditTeamMemberFormProps {
  venueId: string
  teamMember: TeamMember
  onSuccess: () => void
}

const ROLE_OPTIONS = [
  { value: StaffRole.ADMIN, label: 'Administrador', description: 'Acceso completo al venue' },
  { value: StaffRole.MANAGER, label: 'Gerente', description: 'Gestión operativa y reportes' },
  { value: StaffRole.WAITER, label: 'Mesero', description: 'Tomar órdenes y gestionar mesas' },
  { value: StaffRole.CASHIER, label: 'Cajero', description: 'Procesar pagos y cerrar turnos' },
  { value: StaffRole.KITCHEN, label: 'Cocina', description: 'Gestión de cocina y órdenes' },
  { value: StaffRole.HOST, label: 'Anfitrión', description: 'Recepción y gestión de mesas' },
  { value: StaffRole.VIEWER, label: 'Visualizador', description: 'Solo lectura de reportes' },
]


export default function EditTeamMemberForm({ venueId, teamMember, onSuccess }: EditTeamMemberFormProps) {
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const [showPin, setShowPin] = useState(false)
  const [selectedRole, setSelectedRole] = useState<StaffRole>(teamMember.role)
  const [isActive, setIsActive] = useState(teamMember.active)

  // Filter role options to hide SUPERADMIN from non-superadmin users
  const filteredRoleOptions = ROLE_OPTIONS.filter(option => 
    option.value !== StaffRole.SUPERADMIN || canViewSuperadminInfo(staffInfo?.role)
  )

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isDirty },
    reset,
  } = useForm<EditTeamMemberFormData>({
    resolver: zodResolver(editTeamMemberSchema),
    defaultValues: {
      role: teamMember.role,
      active: teamMember.active,
      pin: '',
    },
  })

  const watchedPin = watch('pin')

  useEffect(() => {
    setValue('role', selectedRole)
    setValue('active', isActive)
  }, [selectedRole, isActive, setValue])

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTeamMemberRequest) => 
      teamService.updateTeamMember(venueId, teamMember.id, data),
    onSuccess: (data) => {
      toast({
        title: 'Miembro actualizado',
        description: `Se actualizó correctamente la información de ${teamMember.firstName} ${teamMember.lastName}.`,
      })
      reset({
        role: data.data.role,
        active: data.data.active,
        pin: '',
      })
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'No se pudo actualizar el miembro del equipo.'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: EditTeamMemberFormData) => {
    const updateData: UpdateTeamMemberRequest = {}
    
    if (data.role !== teamMember.role) {
      updateData.role = data.role
    }
    
    if (data.active !== teamMember.active) {
      updateData.active = data.active
    }
    
    if (data.pin && data.pin.trim() !== '') {
      updateData.pin = data.pin
    }

    // Only submit if there are actual changes
    if (Object.keys(updateData).length === 0) {
      toast({
        title: 'Sin cambios',
        description: 'No se detectaron cambios para guardar.',
      })
      return
    }

    updateMutation.mutate(updateData)
  }

  const selectedRoleInfo = filteredRoleOptions.find(option => option.value === selectedRole)

  // Check if user can be deactivated (prevent last admin from being deactivated)
  const canDeactivate = teamMember.role !== StaffRole.OWNER

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Member Info Header */}
      <div className="flex items-center space-x-3 p-4 bg-muted rounded-lg">
        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            {teamMember.firstName} {teamMember.lastName}
          </h3>
          <p className="text-sm text-muted-foreground">{teamMember.email}</p>
        </div>
        <Badge variant="soft" className={getRoleBadgeColor(teamMember.role, staffInfo?.role)}>
          {getRoleDisplayName(teamMember.role, staffInfo?.role)}
        </Badge>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <Label>Rol</Label>
        <Select 
          onValueChange={(value) => setSelectedRole(value as StaffRole)} 
          value={selectedRole}
          disabled={teamMember.role === StaffRole.OWNER || teamMember.role === StaffRole.SUPERADMIN}
        >
          <SelectTrigger data-autofocus>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {filteredRoleOptions.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                disabled={option.value === StaffRole.SUPERADMIN}
              >
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-muted-foreground">{option.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role && (
          <p className="text-sm text-destructive">{errors.role.message}</p>
        )}
        {selectedRoleInfo && selectedRole !== teamMember.role && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Nuevo rol:</strong> {selectedRoleInfo.description}
            </p>
          </div>
        )}
        {(teamMember.role === StaffRole.OWNER || teamMember.role === StaffRole.SUPERADMIN) && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              No puedes cambiar el rol de un {teamMember.role === StaffRole.OWNER ? 'Propietario' : 'Super Administrador'}.
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Status Toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div className="space-y-1">
          <Label className="text-base font-medium">Estado del miembro</Label>
          <p className="text-sm text-muted-foreground">
            {isActive ? 'El miembro puede acceder al sistema' : 'El miembro no puede acceder al sistema'}
          </p>
        </div>
        <Switch
          checked={isActive}
          onCheckedChange={setIsActive}
          disabled={!canDeactivate}
        />
      </div>
      {!canDeactivate && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>
            No puedes desactivar al propietario del venue.
          </AlertDescription>
        </Alert>
      )}

      {/* PIN Field */}
      <div className="space-y-2">
        <Label htmlFor="pin">Cambiar PIN (opcional)</Label>
        <div className="relative">
          <Input
            id="pin"
            type={showPin ? 'text' : 'password'}
            placeholder="Nuevo PIN de 4 dígitos"
            className="pr-10"
            maxLength={4}
            {...register('pin')}
          />
          <button
            type="button"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            onClick={() => setShowPin(!showPin)}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.pin && (
          <p className="text-sm text-destructive">{errors.pin.message}</p>
        )}
        {watchedPin && (
          <p className="text-sm text-blue-600 dark:text-blue-400">
            Se establecerá un nuevo PIN para el miembro
          </p>
        )}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            ${teamMember.totalSales.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">Ventas Totales</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {teamMember.totalOrders}
          </div>
          <div className="text-sm text-muted-foreground">Órdenes</div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button
          type="submit"
          disabled={!isDirty || updateMutation.isPending}
          className="min-w-[120px]"
        >
          {updateMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              Guardando...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Guardar Cambios
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
