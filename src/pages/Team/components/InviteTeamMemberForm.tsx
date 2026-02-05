import { useState, useRef, useEffect, useImperativeHandle, forwardRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, AlertCircle, Smartphone, CheckCircle2, UserPlus, Info, Building2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Input } from '@/components/ui/input'
import { Checkbox } from '@/components/ui/checkbox'
import { useAuth } from '@/context/AuthContext'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole } from '@/types'
import teamService, { InviteTeamMemberRequest, InviteType } from '@/services/team.service'
import { cn } from '@/lib/utils'

type InviteTeamMemberFormData = InviteTeamMemberRequest

export interface InviteTeamMemberFormRef {
  submit: () => void
}

interface InviteTeamMemberFormProps {
  venueId: string
  onSuccess: () => void
  onLoadingChange?: (isLoading: boolean) => void
  onValidChange?: (isValid: boolean) => void
}

// Define schema creation function outside component to avoid recreation
const createInviteSchema = (t: (key: string) => string, inviteType: InviteType) =>
  z.object({
    email: inviteType === 'email'
      ? z.string().email(t('invite.validation.emailFormat')).min(1, t('invite.validation.emailRequired'))
      : z.string().optional(),
    firstName: z
      .string()
      .min(1, t('invite.validation.firstNameRequired'))
      .max(50, t('invite.validation.firstNameMax')),
    lastName: z
      .string()
      .min(1, t('invite.validation.lastNameRequired'))
      .max(50, t('invite.validation.lastNameMax')),
    role: z.nativeEnum(StaffRole, { required_error: t('invite.validation.roleRequired') }),
    message: z.string().max(500, t('invite.validation.messageMax')).optional(),
    pin: inviteType === 'tpv-only'
      ? z.string().regex(/^\d{4,10}$/, t('invite.validation.pinFormat'))
      : z.string().optional(),
    type: z.enum(['email', 'tpv-only']).optional(),
    inviteToAllVenues: z.boolean().optional(),
  })

const InviteTeamMemberForm = forwardRef<InviteTeamMemberFormRef, InviteTeamMemberFormProps>(
  ({ venueId, onSuccess, onLoadingChange, onValidChange }, ref) => {
  const { t } = useTranslation('team')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { user, allVenues } = useAuth()
  const [selectedRole, setSelectedRole] = useState<StaffRole | undefined>()
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [pendingResendEmail, setPendingResendEmail] = useState<string | null>(null)
  const pendingInvitationIdRef = useRef<string | null>(null)
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()
  const [inviteType, setInviteType] = useState<InviteType>('email')
  const [inviteToAllVenues, setInviteToAllVenues] = useState(false)

  // Only OWNER and SUPERADMIN can invite as OWNER
  const canInviteAsOwner = user?.role === StaffRole.OWNER || user?.role === StaffRole.SUPERADMIN

  const ROLE_OPTIONS = [
    // OWNER option only visible for OWNER/SUPERADMIN users
    ...(canInviteAsOwner ? [{
      value: StaffRole.OWNER,
      label: getRoleDisplayName(StaffRole.OWNER),
      description: t('edit.roles.ownerDesc', { defaultValue: 'Control total de la organización y todos los establecimientos' }),
    }] : []),
    { value: StaffRole.ADMIN, label: getRoleDisplayName(StaffRole.ADMIN), description: t('edit.roles.adminDesc') },
    { value: StaffRole.MANAGER, label: getRoleDisplayName(StaffRole.MANAGER), description: t('edit.roles.managerDesc') },
    { value: StaffRole.WAITER, label: getRoleDisplayName(StaffRole.WAITER), description: t('edit.roles.waiterDesc') },
    { value: StaffRole.CASHIER, label: getRoleDisplayName(StaffRole.CASHIER), description: t('edit.roles.cashierDesc') },
    { value: StaffRole.KITCHEN, label: getRoleDisplayName(StaffRole.KITCHEN), description: t('edit.roles.kitchenDesc') },
    { value: StaffRole.HOST, label: getRoleDisplayName(StaffRole.HOST), description: t('edit.roles.hostDesc') },
    { value: StaffRole.VIEWER, label: getRoleDisplayName(StaffRole.VIEWER), description: t('edit.roles.viewerDesc') },
  ]

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isValid },
    reset,
  } = useForm<InviteTeamMemberFormData>({
    resolver: zodResolver(createInviteSchema(t, inviteType)),
    mode: 'onBlur',
    defaultValues: {
      type: 'email',
    },
  })

  // Reset form when invite type changes
  useEffect(() => {
    reset({ type: inviteType })
    setSelectedRole(undefined)
  }, [inviteType, reset])

  // Notify parent of validity changes
  useEffect(() => {
    onValidChange?.(isValid)
  }, [isValid, onValidChange])

  const inviteMutation = useMutation({
    mutationFn: (data: InviteTeamMemberRequest) => teamService.inviteTeamMember(venueId, data),
    onSuccess: (data) => {
      if (data.isTPVOnly) {
        toast({
          title: t('invite.tpvOnlyCreated', { defaultValue: 'Miembro TPV creado' }),
          description: t('invite.tpvOnlyCreatedDesc', {
            defaultValue: '{{name}} ahora puede acceder a la TPV con su PIN.',
            name: `${getValues('firstName')} ${getValues('lastName')}`,
          }),
        })
        queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
      } else {
        toast({
          title: t('invite.invitationSent'),
          description: t('invite.invitationSentDesc', { email: data.invitation.email }),
        })
      }
      reset({ type: inviteType })
      setSelectedRole(undefined)
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || ''
      const invitationId = error.response?.data?.existingInvitationId

      if (errorMessage.includes('pending invitation') || errorMessage.includes('invitación pendiente')) {
        pendingInvitationIdRef.current = invitationId || null
        setPendingResendEmail(error.response?.data?.email || null)
        setShowResendDialog(true)
        return
      }

      toast({
        title: tCommon('error'),
        description: errorMessage || t('invite.invitationError'),
        variant: 'destructive',
      })
    },
  })

  // Notify parent of loading changes
  useEffect(() => {
    onLoadingChange?.(inviteMutation.isPending)
  }, [inviteMutation.isPending, onLoadingChange])

  const resendInvitationMutation = useMutation({
    mutationFn: (invitationId: string) => teamService.resendInvitation(venueId, invitationId),
    onSuccess: () => {
      toast({
        title: t('toasts.invitationResent'),
        description: t('toasts.invitationResentDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['team-invitations', venueId] })
      reset()
      setSelectedRole(undefined)
      setShowResendDialog(false)
      setPendingResendEmail(null)
      pendingInvitationIdRef.current = null
      onSuccess()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('toasts.invitationResendError'),
        variant: 'destructive',
      })
      setShowResendDialog(false)
    },
  })

  const onSubmit = (data: InviteTeamMemberFormData) => {
    inviteMutation.mutate({
      ...data,
      type: inviteType,
      inviteToAllVenues: selectedRole === StaffRole.OWNER ? inviteToAllVenues : undefined,
    })
  }

  // Expose submit function to parent via ref
  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(onSubmit)(),
  }))

  const handleRoleChange = (role: StaffRole) => {
    setSelectedRole(role)
    setValue('role', role, { shouldValidate: true })
    // Reset "invite to all venues" when changing role (only applies to OWNER)
    if (role !== StaffRole.OWNER) {
      setInviteToAllVenues(false)
    }
  }

  const handleResendConfirm = async () => {
    if (pendingInvitationIdRef.current) {
      resendInvitationMutation.mutate(pendingInvitationIdRef.current)
    } else {
      try {
        const response = await teamService.getPendingInvitations(venueId)
        const email = pendingResendEmail || getValues('email')
        const existingInvitation = response.data.find(inv => inv.email === email)

        if (existingInvitation) {
          resendInvitationMutation.mutate(existingInvitation.id)
        } else {
          toast({
            title: tCommon('error'),
            description: t('invite.invitationNotFound'),
            variant: 'destructive',
          })
          setShowResendDialog(false)
        }
      } catch (_error) {
        toast({
          title: tCommon('error'),
          description: t('invite.invitationError'),
          variant: 'destructive',
        })
        setShowResendDialog(false)
      }
    }
  }

  const selectedRoleInfo = ROLE_OPTIONS.find(option => option.value === selectedRole)

  return (
    <>
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Invite Type Toggle Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 rounded-xl bg-primary/10">
            <UserPlus className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold">{t('invite.typeLabel', { defaultValue: 'Tipo de invitación' })}</h3>
            <p className="text-sm text-muted-foreground">{t('invite.typeSubtitle', { defaultValue: 'Selecciona cómo quieres agregar al miembro' })}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setInviteType('email')}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
              inviteType === 'email'
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-muted hover:bg-muted/80'
            )}
          >
            <div className={cn(
              'p-2.5 rounded-xl',
              inviteType === 'email' ? 'bg-primary/10' : 'bg-background'
            )}>
              <Mail className={cn('h-5 w-5', inviteType === 'email' ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium', inviteType === 'email' ? 'text-foreground' : 'text-muted-foreground')}>
                {t('invite.typeEmail', { defaultValue: 'Con correo' })}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {t('invite.typeEmailDesc', { defaultValue: 'Enviar invitación por email' })}
              </p>
            </div>
            {inviteType === 'email' && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
          </button>

          <button
            type="button"
            onClick={() => setInviteType('tpv-only')}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border transition-all text-left',
              inviteType === 'tpv-only'
                ? 'border-primary bg-primary/5'
                : 'border-transparent bg-muted hover:bg-muted/80'
            )}
          >
            <div className={cn(
              'p-2.5 rounded-xl',
              inviteType === 'tpv-only' ? 'bg-primary/10' : 'bg-background'
            )}>
              <Smartphone className={cn('h-5 w-5', inviteType === 'tpv-only' ? 'text-primary' : 'text-muted-foreground')} />
            </div>
            <div className="flex-1 min-w-0">
              <p className={cn('font-medium', inviteType === 'tpv-only' ? 'text-foreground' : 'text-muted-foreground')}>
                {t('invite.typeTpvOnly', { defaultValue: 'Solo TPV' })}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {t('invite.typeTpvOnlyDesc', { defaultValue: 'Acceso con PIN, sin correo' })}
              </p>
            </div>
            {inviteType === 'tpv-only' && <CheckCircle2 className="h-5 w-5 text-primary flex-shrink-0" />}
          </button>
        </div>
      </div>

      {/* Basic Information Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Info className="h-5 w-5 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold">{t('invite.basicInfoTitle', { defaultValue: 'Información básica' })}</h3>
            <p className="text-sm text-muted-foreground">{t('invite.basicInfoSubtitle', { defaultValue: 'Datos del nuevo miembro del equipo' })}</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Email Field - Only for email type */}
          {inviteType === 'email' && (
            <div className="space-y-2">
              <Label htmlFor="email">{t('invite.emailLabel')} *</Label>
              <Input
                id="email"
                type="email"
                placeholder={t('invite.emailPlaceholder')}
                className="h-12 text-base"
                data-autofocus
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
            </div>
          )}

          {/* Name Fields */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">{t('invite.firstNameLabel')} *</Label>
              <Input
                id="firstName"
                placeholder={t('invite.firstNamePlaceholder')}
                className="h-12 text-base"
                {...register('firstName')}
              />
              {errors.firstName && (
                <p className="text-sm text-destructive">{errors.firstName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="lastName">{t('invite.lastNameLabel')} *</Label>
              <Input
                id="lastName"
                placeholder={t('invite.lastNamePlaceholder')}
                className="h-12 text-base"
                {...register('lastName')}
              />
              {errors.lastName && (
                <p className="text-sm text-destructive">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          {/* Role Selection */}
          <div className="space-y-2">
            <Label>{t('invite.roleLabel')} *</Label>
            <Select onValueChange={handleRoleChange} value={selectedRole}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder={t('invite.roleSelectPlaceholder')} />
              </SelectTrigger>
              <SelectContent className="max-w-[90vw] sm:max-w-md">
                {ROLE_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.role && (
              <p className="text-sm text-destructive">{errors.role.message}</p>
            )}
            {selectedRoleInfo && (
              <div className="w-full p-3 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong className="font-medium text-foreground">{selectedRoleInfo.label}:</strong>{' '}
                  {selectedRoleInfo.description}
                </p>
              </div>
            )}

            {/* Invite to all venues option - only for OWNER role with multiple venues */}
            {selectedRole === StaffRole.OWNER && allVenues.length > 1 && (
              <div className="mt-4 p-4 rounded-xl border border-primary/20 bg-primary/5">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="inviteToAllVenues"
                    checked={inviteToAllVenues}
                    onCheckedChange={(checked) => setInviteToAllVenues(checked === true)}
                    className="mt-0.5"
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="inviteToAllVenues"
                      className="text-sm font-medium cursor-pointer flex items-center gap-2"
                    >
                      <Building2 className="h-4 w-4 text-primary" />
                      {t('invite.inviteToAllVenues', { defaultValue: 'Dar acceso a todos los establecimientos' })}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {t('invite.inviteToAllVenuesDesc', {
                        defaultValue: 'El socio tendrá acceso como {{role}} a los {{count}} establecimientos de la organización.',
                        role: getRoleDisplayName(StaffRole.OWNER),
                        count: allVenues.length,
                      })}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PIN Field - Only for TPV-only type */}
          {inviteType === 'tpv-only' && (
            <div className="space-y-2">
              <Label htmlFor="pin">{t('invite.pinLabel', { defaultValue: 'PIN de acceso' })} *</Label>
              <Input
                id="pin"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={10}
                placeholder={t('invite.pinPlaceholder', { defaultValue: '4-10 dígitos' })}
                className="h-12 text-base"
                {...register('pin')}
              />
              {errors.pin && (
                <p className="text-sm text-destructive">{errors.pin.message}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('invite.pinHelp', { defaultValue: 'Este PIN se usará para iniciar sesión en la TPV.' })}
              </p>
            </div>
          )}

          {/* Message Field */}
          <div className="space-y-2">
            <Label htmlFor="message">{t('invite.messageLabel')}</Label>
            <Textarea
              id="message"
              placeholder={t('invite.messagePlaceholder')}
              rows={3}
              className="text-base resize-none"
              {...register('message')}
            />
            {errors.message && (
              <p className="text-sm text-destructive">{errors.message.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Info Alert Card */}
      <div className="rounded-2xl border border-border/50 bg-card p-6">
        <div className="flex gap-3">
          <AlertCircle className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-0.5" />
          <p className="text-sm text-muted-foreground">
            {inviteType === 'tpv-only'
              ? t('invite.infoAlertTpvOnly', {
                  defaultValue: 'Este miembro podrá acceder solo a la TPV usando su PIN. No tendrá acceso al dashboard web.',
                })
              : t('invite.infoAlert')
            }
          </p>
        </div>
      </div>
    </form>

    {/* Resend Invitation Confirmation Dialog */}
    <AlertDialog open={showResendDialog} onOpenChange={setShowResendDialog}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('invite.resendDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('invite.resendDialog.description', { email: pendingResendEmail || getValues('email') })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{tCommon('cancel')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleResendConfirm}
            disabled={resendInvitationMutation.isPending}
          >
            {resendInvitationMutation.isPending ? t('invite.resendDialog.resending') : t('invite.resendDialog.resend')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  )
})

InviteTeamMemberForm.displayName = 'InviteTeamMemberForm'

export default InviteTeamMemberForm
