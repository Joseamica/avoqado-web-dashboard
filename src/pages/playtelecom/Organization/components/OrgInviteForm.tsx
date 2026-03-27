import { useState, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Smartphone, Eye, EyeOff, KeyRound, Store, UserPlus, Shield, Loader2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole } from '@/types'
import teamService, { type InviteTeamMemberRequest } from '@/services/team.service'
import { syncOrgTeamMemberVenues, updateOrgTeamMemberPin } from '@/services/organizationConfig.service'
import { cn } from '@/lib/utils'

// ---------- Types ----------

type InviteType = 'email' | 'tpv-only'

export interface OrgInviteFormRef {
  submit: () => void
}

interface OrgInviteFormProps {
  orgId: string
  venues: Array<{ id: string; name: string }>
  onSuccess: () => void
  onSubmitting: (submitting: boolean) => void
  onValidChange: (valid: boolean) => void
}

// ---------- Schema ----------

const createOrgInviteSchema = (inviteType: InviteType) =>
  z.object({
    email: inviteType === 'email' ? z.string().email('Correo invalido').min(1, 'Correo requerido') : z.string().optional(),
    firstName: z.string().min(1, 'Nombre requerido').max(50, 'Maximo 50 caracteres'),
    lastName: z.string().min(1, 'Apellido requerido').max(50, 'Maximo 50 caracteres'),
    role: z.nativeEnum(StaffRole, { required_error: 'Rol requerido' }),
    pin: z
      .string()
      .optional()
      .refine(val => !val || /^\d{4,6}$/.test(val), { message: 'El PIN debe tener 4-6 digitos' }),
  })

type OrgInviteFormData = z.infer<ReturnType<typeof createOrgInviteSchema>>

// ---------- Constants ----------

const INVITE_ROLES: StaffRole[] = [StaffRole.WAITER, StaffRole.CASHIER, StaffRole.MANAGER, StaffRole.ADMIN]

// ---------- Component ----------

const OrgInviteForm = forwardRef<OrgInviteFormRef, OrgInviteFormProps>(({ orgId, venues, onSuccess, onSubmitting, onValidChange }, ref) => {
  const { t } = useTranslation(['team', 'playtelecom', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { getDisplayName } = useRoleConfig()

  // State
  const [inviteType, setInviteType] = useState<InviteType>('email')
  const [selectedVenueIds, setSelectedVenueIds] = useState<string[]>([])
  const [pin, setPin] = useState('')
  const [showPin, setShowPin] = useState(false)

  // Form
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isValid },
    reset,
  } = useForm<OrgInviteFormData>({
    resolver: zodResolver(createOrgInviteSchema(inviteType)),
    mode: 'onChange',
  })

  // Reset form when invite type changes
  useEffect(() => {
    reset()
    setSelectedVenueIds([])
    setPin('')
    setShowPin(false)
  }, [inviteType, reset])

  // Notify parent of validity (form valid + at least 1 venue selected)
  const formIsComplete = isValid && selectedVenueIds.length > 0
  useEffect(() => {
    onValidChange(formIsComplete)
  }, [formIsComplete, onValidChange])

  // ---------- Venue toggle ----------

  const handleVenueToggle = useCallback((venueId: string) => {
    setSelectedVenueIds(prev => (prev.includes(venueId) ? prev.filter(id => id !== venueId) : [...prev, venueId]))
  }, [])

  const handleSelectAllVenues = useCallback(() => {
    setSelectedVenueIds(prev => (prev.length === venues.length ? [] : venues.map(v => v.id)))
  }, [venues])

  // ---------- Mutation ----------

  const inviteMutation = useMutation({
    mutationFn: async (data: OrgInviteFormData) => {
      const firstVenueId = selectedVenueIds[0]

      // Build email for TPV-only
      const email =
        inviteType === 'tpv-only' ? `tpv-${orgId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@internal.avoqado.io` : data.email!

      // Step 1: Invite to the first venue (creates the user)
      const invitePayload: InviteTeamMemberRequest = {
        email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        type: inviteType,
        pin: pin || undefined,
      }

      const inviteResponse = await teamService.inviteTeamMember(firstVenueId, invitePayload)

      // Step 2: If more than 1 venue selected, sync remaining via org endpoint
      if (selectedVenueIds.length > 1 && inviteResponse.staffId) {
        await syncOrgTeamMemberVenues(orgId, inviteResponse.staffId, selectedVenueIds)
      }

      // Step 3: If PIN provided and staffId available, set PIN via org endpoint
      if (pin && inviteResponse.staffId) {
        await updateOrgTeamMemberPin(orgId, inviteResponse.staffId, pin)
      }

      return inviteResponse
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['org-config', orgId, 'team'] })
      reset()
      setSelectedVenueIds([])
      setPin('')
      setShowPin(false)
      onSuccess()
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || t('team:invite.error', { defaultValue: 'Error al enviar la invitacion' })
      toast({ title: msg, variant: 'destructive' })
    },
  })

  // Notify parent of loading state
  useEffect(() => {
    onSubmitting(inviteMutation.isPending)
  }, [inviteMutation.isPending, onSubmitting])

  // ---------- Submit ----------

  const onSubmit = useCallback(
    (data: OrgInviteFormData) => {
      if (selectedVenueIds.length === 0) {
        toast({
          title: t('playtelecom:users.selectAtLeastOneVenue', {
            defaultValue: 'Selecciona al menos una tienda',
          }),
          variant: 'destructive',
        })
        return
      }
      inviteMutation.mutate(data)
    },
    [selectedVenueIds, inviteMutation, toast, t],
  )

  // Expose submit to parent
  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(onSubmit)(),
  }))

  // ---------- Render ----------

  return (
    <div className="max-w-2xl mx-auto px-6 py-8 space-y-6">
      {/* Section 1: Invite type */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <UserPlus className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{t('team:invite.typeTitle', { defaultValue: 'Tipo de invitacion' })}</h4>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setInviteType('email')}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all cursor-pointer',
              inviteType === 'email'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border/50 bg-card hover:border-border',
            )}
          >
            <Mail className={cn('w-5 h-5 mb-2', inviteType === 'email' ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-sm font-medium">{t('team:invite.withEmail', { defaultValue: 'Con correo' })}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('team:invite.withEmailDesc', {
                defaultValue: 'El usuario recibira un correo de invitacion',
              })}
            </p>
          </button>
          <button
            type="button"
            onClick={() => setInviteType('tpv-only')}
            className={cn(
              'rounded-2xl border p-4 text-left transition-all cursor-pointer',
              inviteType === 'tpv-only'
                ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                : 'border-border/50 bg-card hover:border-border',
            )}
          >
            <Smartphone className={cn('w-5 h-5 mb-2', inviteType === 'tpv-only' ? 'text-primary' : 'text-muted-foreground')} />
            <p className="text-sm font-medium">{t('team:invite.tpvOnly', { defaultValue: 'Solo TPV' })}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t('team:invite.tpvOnlyDesc', {
                defaultValue: 'Acceso solo desde la terminal punto de venta',
              })}
            </p>
          </button>
        </div>
      </div>

      {/* Section 2: Basic info */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <UserPlus className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{t('team:invite.basicInfo', { defaultValue: 'Informacion basica' })}</h4>
        </div>

        {inviteType === 'email' && (
          <div className="space-y-1.5">
            <Label htmlFor="org-invite-email" className="text-sm">
              {t('team:invite.email', { defaultValue: 'Correo electronico' })}
            </Label>
            <Input id="org-invite-email" type="email" placeholder="correo@ejemplo.com" className="h-12 text-base" {...register('email')} />
            {errors.email && <p className="text-xs text-destructive">{errors.email.message}</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="org-invite-firstName" className="text-sm">
              {t('team:invite.firstName', { defaultValue: 'Nombre' })}
            </Label>
            <Input
              id="org-invite-firstName"
              placeholder={t('team:invite.firstNamePlaceholder', { defaultValue: 'Nombre' })}
              className="h-12 text-base"
              {...register('firstName')}
            />
            {errors.firstName && <p className="text-xs text-destructive">{errors.firstName.message}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="org-invite-lastName" className="text-sm">
              {t('team:invite.lastName', { defaultValue: 'Apellido' })}
            </Label>
            <Input
              id="org-invite-lastName"
              placeholder={t('team:invite.lastNamePlaceholder', { defaultValue: 'Apellido' })}
              className="h-12 text-base"
              {...register('lastName')}
            />
            {errors.lastName && <p className="text-xs text-destructive">{errors.lastName.message}</p>}
          </div>
        </div>
      </div>

      {/* Section 3: Role */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">{t('team:invite.roleTitle', { defaultValue: 'Rol' })}</h4>
        </div>
        <Select onValueChange={value => setValue('role', value as StaffRole, { shouldValidate: true })}>
          <SelectTrigger className="h-12 text-base cursor-pointer">
            <SelectValue placeholder={t('team:invite.selectRole', { defaultValue: 'Seleccionar rol' })} />
          </SelectTrigger>
          <SelectContent>
            {INVITE_ROLES.map(role => (
              <SelectItem key={role} value={role} className="cursor-pointer">
                {getDisplayName(role)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role && <p className="text-xs text-destructive">{errors.role.message}</p>}
      </div>

      {/* Section 4: Venue assignment */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Store className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-medium">{t('playtelecom:users.venueAssignment', { defaultValue: 'Tiendas Asignadas' })}</h4>
          </div>
          <button type="button" onClick={handleSelectAllVenues} className="text-xs text-primary hover:underline cursor-pointer">
            {selectedVenueIds.length === venues.length
              ? t('common:deselectAll', { defaultValue: 'Deseleccionar todo' })
              : t('common:selectAll', { defaultValue: 'Seleccionar todo' })}
          </button>
        </div>

        {selectedVenueIds.length === 0 && (
          <p className="text-xs text-destructive">
            {t('playtelecom:users.selectAtLeastOneVenue', {
              defaultValue: 'Selecciona al menos una tienda',
            })}
          </p>
        )}

        <div className="max-h-48 overflow-y-auto space-y-1">
          {venues.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              <Store className="w-6 h-6 mx-auto mb-2 opacity-50" />
              <p className="text-sm">
                {t('playtelecom:users.noVenuesAvailable', {
                  defaultValue: 'No hay tiendas disponibles',
                })}
              </p>
            </div>
          ) : (
            venues.map(venue => {
              const isSelected = selectedVenueIds.includes(venue.id)
              return (
                <div
                  key={venue.id}
                  onClick={() => handleVenueToggle(venue.id)}
                  className={cn(
                    'flex items-center gap-3 p-2 rounded-md transition-colors cursor-pointer',
                    isSelected ? 'bg-primary/10' : 'hover:bg-muted/50',
                  )}
                >
                  <Checkbox checked={isSelected} onClick={e => e.stopPropagation()} className="cursor-pointer" />
                  <p className="text-sm font-medium truncate">{venue.name}</p>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* Section 5: PIN (optional) */}
      <div className="rounded-2xl border border-border/50 bg-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <KeyRound className="w-4 h-4 text-muted-foreground" />
          <h4 className="text-sm font-medium">
            PIN <span className="text-muted-foreground font-normal">({t('common:optional', { defaultValue: 'opcional' })})</span>
          </h4>
        </div>
        <div className="flex items-center gap-3">
          <div className="relative max-w-[200px]">
            <Input
              type={showPin ? 'text' : 'password'}
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder={t('playtelecom:users.pinPlaceholder', {
                defaultValue: 'Ingresa PIN (4-6 digitos)',
              })}
              value={pin}
              onChange={e => {
                const val = e.target.value.replace(/\D/g, '').slice(0, 6)
                setPin(val)
              }}
              className="h-12 text-base font-mono pr-10"
            />
            {pin && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md hover:bg-muted cursor-pointer"
                onClick={() => setShowPin(!showPin)}
              >
                {showPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('playtelecom:users.pinDescription', {
              defaultValue: 'PIN para inicio de sesion rapido en el TPV',
            })}
          </p>
        </div>
        {pin && !/^\d{4,6}$/.test(pin) && pin.length > 0 && (
          <p className="text-xs text-destructive">
            {t('team:invite.pinFormatError', {
              defaultValue: 'El PIN debe tener entre 4 y 6 digitos',
            })}
          </p>
        )}
      </div>

      {/* Submitting overlay */}
      {inviteMutation.isPending && (
        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">{t('team:invite.sending', { defaultValue: 'Enviando...' })}</span>
        </div>
      )}
    </div>
  )
})

OrgInviteForm.displayName = 'OrgInviteForm'

export default OrgInviteForm
