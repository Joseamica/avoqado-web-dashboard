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
import { StaffRole } from '@/types'
import teamService, { TeamMember, UpdateTeamMemberRequest } from '@/services/team.service'

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

const getRoleBadgeColor = (role: StaffRole) => {
  const colors = {
    SUPERADMIN: 'bg-purple-100 text-purple-800 dark:bg-purple-500/20 dark:text-purple-200',
    OWNER: 'bg-red-100 text-red-800 dark:bg-red-500/20 dark:text-red-200',
    ADMIN: 'bg-blue-100 text-blue-800 dark:bg-blue-500/20 dark:text-blue-200',
    MANAGER: 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200',
    WAITER: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-500/20 dark:text-yellow-200',
    CASHIER: 'bg-orange-100 text-orange-800 dark:bg-orange-500/20 dark:text-orange-200',
    KITCHEN: 'bg-pink-100 text-pink-800 dark:bg-pink-500/20 dark:text-pink-200',
    HOST: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-500/20 dark:text-indigo-200',
    VIEWER: 'bg-zinc-100 text-zinc-800 dark:bg-zinc-700 dark:text-zinc-100',
  }
  return colors[role] || colors.VIEWER
}

const getRoleDisplayName = (role: StaffRole) => {
  const names = {
    SUPERADMIN: 'Super Admin',
    OWNER: 'Propietario',
    ADMIN: 'Administrador',
    MANAGER: 'Gerente',
    WAITER: 'Mesero',
    CASHIER: 'Cajero',
    KITCHEN: 'Cocina',
    HOST: 'Anfitrión',
    VIEWER: 'Visualizador',
  }
  return names[role] || role
}

export default function EditTeamMemberForm({ venueId, teamMember, onSuccess }: EditTeamMemberFormProps) {
  const { toast } = useToast()
  const [showPin, setShowPin] = useState(false)
  const [selectedRole, setSelectedRole] = useState<StaffRole>(teamMember.role)
  const [isActive, setIsActive] = useState(teamMember.active)

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

  const selectedRoleInfo = ROLE_OPTIONS.find(option => option.value === selectedRole)

  // Check if user can be deactivated (prevent last admin from being deactivated)
  const canDeactivate = teamMember.role !== StaffRole.OWNER

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Member Info Header */}
      <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900">
            {teamMember.firstName} {teamMember.lastName}
          </h3>
          <p className="text-sm text-gray-600">{teamMember.email}</p>
        </div>
        <Badge className={getRoleBadgeColor(teamMember.role)}>
          {getRoleDisplayName(teamMember.role)}
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
            {ROLE_OPTIONS.map((option) => (
              <SelectItem 
                key={option.value} 
                value={option.value}
                disabled={option.value === StaffRole.SUPERADMIN}
              >
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.description}</div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role && (
          <p className="text-sm text-red-600">{errors.role.message}</p>
        )}
        {selectedRoleInfo && selectedRole !== teamMember.role && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
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
      <div className="flex items-center justify-between p-4 border rounded-lg">
        <div className="space-y-1">
          <Label className="text-base font-medium">Estado del miembro</Label>
          <p className="text-sm text-gray-600">
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
            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPin(!showPin)}
          >
            {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.pin && (
          <p className="text-sm text-red-600">{errors.pin.message}</p>
        )}
        {watchedPin && (
          <p className="text-sm text-blue-600">
            Se establecerá un nuevo PIN para el miembro
          </p>
        )}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            ${teamMember.totalSales.toLocaleString()}
          </div>
          <div className="text-sm text-gray-600">Ventas Totales</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-gray-900">
            {teamMember.totalOrders}
          </div>
          <div className="text-sm text-gray-600">Órdenes</div>
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