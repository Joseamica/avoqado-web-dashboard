import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'

const acceptInvitationSchema = z
  .object({
    firstName: z.string().min(1, 'El nombre es requerido').max(50, 'Máximo 50 caracteres'),
    lastName: z.string().min(1, 'El apellido es requerido').max(50, 'Máximo 50 caracteres'),
    password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
    confirmPassword: z.string(),
    pin: z
      .string()
      .regex(/^\d{4}$/, 'El PIN debe tener exactamente 4 dígitos')
      .optional()
      .or(z.literal('')),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  })

type AcceptInvitationFormData = z.infer<typeof acceptInvitationSchema>

interface InvitationDetails {
  id: string
  email: string
  role: string
  organizationName: string
  venueName: string
  inviterName: string
  expiresAt: string
  status: string
}

export default function InviteAccept() {
  const { token } = useParams<{ token: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [invitationDetails, setInvitationDetails] = useState<InvitationDetails | null>(null)
  const [isLoadingInvitation, setIsLoadingInvitation] = useState(true)
  const [invitationError, setInvitationError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isValid },
  } = useForm<AcceptInvitationFormData>({
    resolver: zodResolver(acceptInvitationSchema),
    mode: 'onChange',
  })

  // Fetch invitation details
  useEffect(() => {
    if (!token) {
      setInvitationError('Token de invitación inválido')
      setIsLoadingInvitation(false)
      return
    }

    const fetchInvitationDetails = async () => {
      try {
        const response = await api.get(`/api/v1/invitations/${token}`)
        setInvitationDetails(response.data)
      } catch (error: any) {
        if (error.response?.status === 404) {
          setInvitationError('Invitación no encontrada o expirada')
        } else if (error.response?.status === 410) {
          setInvitationError('Esta invitación ya ha sido utilizada')
        } else {
          setInvitationError('Error al cargar la invitación')
        }
      } finally {
        setIsLoadingInvitation(false)
      }
    }

    fetchInvitationDetails()
  }, [token])

  // Accept invitation mutation
  const acceptInvitationMutation = useMutation({
    mutationFn: async (data: AcceptInvitationFormData) => {
      const response = await api.post(`/api/v1/invitations/${token}/accept`, {
        firstName: data.firstName,
        lastName: data.lastName,
        password: data.password,
        pin: data.pin || null,
      })
      return response.data
    },
    onSuccess: () => {
      toast({
        title: '¡Bienvenido al equipo!',
        description: 'Tu cuenta ha sido creada exitosamente. Puedes iniciar sesión ahora.',
      })
      // Redirect to login with the email pre-filled
      navigate('/login', {
        state: {
          email: invitationDetails?.email,
          message: 'Cuenta creada exitosamente. Inicia sesión para continuar.',
        },
      })
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'No se pudo aceptar la invitación.'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: AcceptInvitationFormData) => {
    acceptInvitationMutation.mutate(data)
  }

  if (isLoadingInvitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Cargando invitación...</span>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (invitationError || !invitationDetails) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle>Invitación no válida</CardTitle>
            <CardDescription>{invitationError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')} className="w-full">
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Check if invitation is expired
  const isExpired = new Date(invitationDetails.expiresAt) < new Date()

  if (isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
              <AlertCircle className="h-6 w-6 text-amber-600" />
            </div>
            <CardTitle>Invitación expirada</CardTitle>
            <CardDescription>
              Esta invitación expiró el {new Date(invitationDetails.expiresAt).toLocaleDateString('es-ES')}. Contacta al administrador para
              recibir una nueva invitación.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/login')} className="w-full">
              Ir al inicio de sesión
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <CardTitle>Únete al equipo</CardTitle>
          <CardDescription>
            Has sido invitado a unirte a <strong>{invitationDetails.organizationName}</strong>
            {invitationDetails.venueName && (
              <>
                {' '}
                en <strong>{invitationDetails.venueName}</strong>
              </>
            )}{' '}
            como <strong>{invitationDetails.role}</strong>
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Email: <strong>{invitationDetails.email}</strong>
              </AlertDescription>
            </Alert>

            {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">Nombre *</Label>
                <Input id="firstName" placeholder="Tu nombre" {...register('firstName')} />
                {errors.firstName && <p className="text-sm text-red-600">{errors.firstName.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="lastName">Apellido *</Label>
                <Input id="lastName" placeholder="Tu apellido" {...register('lastName')} />
                {errors.lastName && <p className="text-sm text-red-600">{errors.lastName.message}</p>}
              </div>
            </div>

            {/* Password Fields */}
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Mínimo 8 caracteres"
                  className="pr-10"
                  {...register('password')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="text-sm text-red-600">{errors.password.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  placeholder="Confirma tu contraseña"
                  className="pr-10"
                  {...register('confirmPassword')}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.confirmPassword && <p className="text-sm text-red-600">{errors.confirmPassword.message}</p>}
            </div>

            {/* PIN Field */}
            <div className="space-y-2">
              <Label htmlFor="pin">PIN (opcional)</Label>
              <Input id="pin" type="text" placeholder="4 dígitos para acceso rápido" maxLength={4} {...register('pin')} />
              {errors.pin && <p className="text-sm text-red-600">{errors.pin.message}</p>}
              <p className="text-xs text-muted-foreground">El PIN te permitirá acceder rápidamente desde terminales TPV</p>
            </div>

            <Button type="submit" disabled={!isValid || acceptInvitationMutation.isPending} className="w-full">
              {acceptInvitationMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Creando cuenta...
                </>
              ) : (
                'Aceptar invitación y crear cuenta'
              )}
            </Button>
          </form>

          <div className="mt-4 text-center text-sm text-muted-foreground">
            <p>Al aceptar esta invitación, aceptas los términos de uso.</p>
            <p className="mt-2">
              ¿Ya tienes una cuenta?{' '}
              <button onClick={() => navigate('/login')} className="text-blue-600 hover:text-blue-800 underline">
                Inicia sesión aquí
              </button>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
