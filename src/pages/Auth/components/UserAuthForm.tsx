import React, { useEffect } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import { useLocation, useNavigate } from 'react-router-dom'

import { Icons } from '@/components/icons'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { LoginDto } from '@/services/auth.service'

// Usando la interfaz LoginDto del servicio de autenticación
type Inputs = LoginDto

export function UserAuthForm({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const navigate = useNavigate()
  const location = useLocation()
  const { toast } = useToast()
  const { login, isAuthenticated, isLoading, error } = useAuth()

  const from = (location.state as any)?.from?.pathname || '/'

  useEffect(() => {
    if (isAuthenticated) {
      navigate(from, { replace: true })
    }
  }, [isAuthenticated, navigate, from])

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<Inputs>()

  const onSubmit: SubmitHandler<Inputs> = async formData => {
    try {
      // Para el nuevo backend, se puede especificar un venueId específico si es necesario
      // Si el usuario tiene múltiples venues, idealmente se le daría a escoger
      // Por ahora enviamos sin venueId y dejamos que el backend/AuthContext decida
      login(formData)
    } catch (error) {
      console.log('error', error)
      toast({ title: 'Inicio de sesión fallido', description: 'Credenciales inválidas.' })
    }
  }
  // async function onSubmit(event: React.SyntheticEvent) {
  //   event.preventDefault()
  //   setIsLoading(true)

  //   setTimeout(() => {
  //     setIsLoading(false)
  //   }, 3000)
  // }

  return (
    <div className={cn('grid gap-6', className)} {...props}>
      <form onSubmit={handleSubmit(onSubmit)}>
        <div className="grid gap-2">
          <div className="grid gap-1">
            <Label className="sr-only" htmlFor="email">
              Email
            </Label>
            <Input
              {...register('email', { required: 'El correo electrónico es requerido' })}
              id="email"
              placeholder="name@example.com"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              className={cn('w-full', errors.email && 'border-red-500')}
            />
            {errors.email && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.email.message}</span>}

            <Label className="sr-only" htmlFor="password">
              Password
            </Label>
            <Input
              {...register('password', { required: 'La contraseña es requerida' })}
              id="password"
              placeholder="Password"
              type="password"
              autoComplete="current-password"
              disabled={isLoading}
              className={cn('w-full', errors.password && 'border-red-500')}
            />
            {errors.password && <span style={{ color: 'red', fontSize: '12px', paddingLeft: 5 }}>{errors.password.message}</span>}
          </div>
          <Button disabled={isLoading}>
            {isLoading && <Icons.spinner className="mr-2 w-4 h-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </div>
      </form>
      <div className="relative">
        <div className="flex absolute inset-0 items-center">
          <span className="w-full border-t" />
        </div>
        <div className="flex relative justify-center text-xs uppercase">
          <span className="px-2 bg-background text-muted-foreground">O continua con</span>
        </div>
      </div>
      <Button variant="outline" type="button" disabled={isLoading}>
        {isLoading ? <Icons.spinner className="mr-2 w-4 h-4 animate-spin" /> : <Icons.gitHub className="mr-2 w-4 h-4" />} GitHub
      </Button>
      {error && <div style={{ color: 'red' }}>Inicio de sesión fallida. Por favor intente de nuevo.</div>}
    </div>
  )
}
