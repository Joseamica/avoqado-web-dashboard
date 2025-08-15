import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Send, AlertCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { StaffRole } from '@/types'
import teamService, { InviteTeamMemberRequest } from '@/services/team.service'

const inviteTeamMemberSchema = z.object({
  email: z
    .string()
    .email('El email debe tener un formato válido')
    .min(1, 'El email es requerido'),
  firstName: z
    .string()
    .min(1, 'El nombre es requerido')
    .max(50, 'El nombre debe tener máximo 50 caracteres'),
  lastName: z
    .string()
    .min(1, 'El apellido es requerido')
    .max(50, 'El apellido debe tener máximo 50 caracteres'),
  role: z.nativeEnum(StaffRole, { required_error: 'El rol es requerido' }),
  message: z
    .string()
    .max(500, 'El mensaje debe tener máximo 500 caracteres')
    .optional(),
})

type InviteTeamMemberFormData = InviteTeamMemberRequest

interface InviteTeamMemberFormProps {
  venueId: string
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

export default function InviteTeamMemberForm({ venueId, onSuccess }: InviteTeamMemberFormProps) {
  const { toast } = useToast()
  const [selectedRole, setSelectedRole] = useState<StaffRole | undefined>()

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<InviteTeamMemberFormData>({
    resolver: zodResolver(inviteTeamMemberSchema),
    mode: 'onChange',
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteTeamMemberRequest) => teamService.inviteTeamMember(venueId, data),
    onSuccess: (data) => {
      toast({
        title: 'Invitación enviada',
        description: `Se envió una invitación a ${data.invitation.email}. La invitación expira en 7 días.`,
      })
      reset()
      setSelectedRole(undefined)
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'No se pudo enviar la invitación.'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: InviteTeamMemberFormData) => {
    inviteMutation.mutate(data)
  }

  const handleRoleChange = (role: StaffRole) => {
    setSelectedRole(role)
    setValue('role', role, { shouldValidate: true })
  }

  const selectedRoleInfo = ROLE_OPTIONS.find(option => option.value === selectedRole)

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">Email del invitado *</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            id="email"
            type="email"
            placeholder="ejemplo@empresa.com"
            className="pl-10"
            data-autofocus
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-red-600">{errors.email.message}</p>
        )}
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">Nombre *</Label>
          <Input
            id="firstName"
            placeholder="Nombre"
            {...register('firstName')}
          />
          {errors.firstName && (
            <p className="text-sm text-red-600">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">Apellido *</Label>
          <Input
            id="lastName"
            placeholder="Apellido"
            {...register('lastName')}
          />
          {errors.lastName && (
            <p className="text-sm text-red-600">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <Label>Rol *</Label>
        <Select onValueChange={handleRoleChange} value={selectedRole}>
          <SelectTrigger>
            <SelectValue placeholder="Selecciona un rol" />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
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
        {selectedRoleInfo && (
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-md">
            <p className="text-sm text-blue-800">
              <strong>{selectedRoleInfo.label}:</strong> {selectedRoleInfo.description}
            </p>
          </div>
        )}
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <Label htmlFor="message">Mensaje personalizado (opcional)</Label>
        <Textarea
          id="message"
          placeholder="Escribe un mensaje de bienvenida para el nuevo miembro del equipo..."
          rows={3}
          {...register('message')}
        />
        {errors.message && (
          <p className="text-sm text-red-600">{errors.message.message}</p>
        )}
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          El invitado recibirá un email con un enlace para crear su cuenta y unirse al equipo.
          Puede iniciar sesión con su cuenta de Google o crear una contraseña.
          La invitación expira automáticamente en 7 días.
        </AlertDescription>
      </Alert>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button
          type="submit"
          disabled={!isValid || inviteMutation.isPending}
          className="min-w-[120px]"
        >
          {inviteMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              Enviando...
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              Enviar Invitación
            </>
          )}
        </Button>
      </div>
    </form>
  )
}