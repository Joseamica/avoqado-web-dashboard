import { useState, useRef, useEffect, useImperativeHandle, forwardRef, useCallback } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, AlertCircle, Smartphone, CheckCircle2, UserPlus, Info, Building2, AlertTriangle, Loader2, Copy, Shield } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole } from '@/types'
import teamService, { InviteTeamMemberRequest, InviteType, PinConflict } from '@/services/team.service'
import { adminResetPassword, getTeam } from '@/services/storesAnalysis.service'
import { cn } from '@/lib/utils'
import { useWhiteLabelConfig } from '@/hooks/useWhiteLabelConfig'
import { RoleAccessPreview } from './RoleAccessPreview'

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

type TestCredentials = {
  username: string
  password: string
}

type PendingInviteMeta = {
  usedFakeEmail: boolean
  originalEmail: string
  normalizedEmail: string
} | null

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const isValidEmailAddress = (value: string): boolean => EMAIL_PATTERN.test(value.trim())

const buildSuperadminTestEmail = (value: string): string => {
  const base = value
    .trim()
    .toLowerCase()
    .split('@')[0]
    .replace(/[^a-z0-9._-]+/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^[._-]+|[._-]+$/g, '')

  const safeLocalPart = base || 'test.user'
  const uniqueSuffix = Date.now().toString(36)
  return `${safeLocalPart}.${uniqueSuffix}@example.com`
}

const extractTestCredentialsFromResponse = (
  payload: Record<string, any>,
  fallbackUsername: string,
): TestCredentials | null => {
  const nestedCredentials =
    payload.testCredentials ||
    payload.credentials ||
    payload.loginCredentials ||
    payload.generatedCredentials ||
    payload.userCredentials

  const usernameCandidate =
    nestedCredentials?.username ||
    nestedCredentials?.email ||
    payload.username ||
    payload.email ||
    payload.user?.email ||
    payload.staff?.email ||
    payload.invitation?.email ||
    fallbackUsername

  const passwordCandidate =
    nestedCredentials?.password ||
    nestedCredentials?.temporaryPassword ||
    payload.temporaryPassword ||
    payload.tempPassword ||
    payload.generatedPassword ||
    payload.password

  if (!passwordCandidate) {
    return null
  }

  return {
    username: String(usernameCandidate || fallbackUsername),
    password: String(passwordCandidate),
  }
}

// Define schema creation function outside component to avoid recreation
const createInviteSchema = (
  t: (key: string) => string,
  inviteType: InviteType,
  allowFakeEmailForSuperadmin: boolean,
) =>
  z.object({
    email: inviteType === 'email'
      ? allowFakeEmailForSuperadmin
        ? z.string().min(1, t('invite.validation.emailRequired'))
        : z.string().email(t('invite.validation.emailFormat')).min(1, t('invite.validation.emailRequired'))
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
  const { user, staffInfo, allVenues } = useAuth()
  const [selectedRole, setSelectedRole] = useState<StaffRole | undefined>()
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [pendingResendEmail, setPendingResendEmail] = useState<string | null>(null)
  const pendingInvitationIdRef = useRef<string | null>(null)
  const pendingInviteMetaRef = useRef<PendingInviteMeta>(null)
  const [pinConflicts, setPinConflicts] = useState<(PinConflict & { newPin: string; resolved: boolean; saving: boolean })[]>([])
  const [showPinConflictsDialog, setShowPinConflictsDialog] = useState(false)
  const [conflictSummary, setConflictSummary] = useState<{ total: number; assigned: number } | null>(null)
  const [showTestCredentialsDialog, setShowTestCredentialsDialog] = useState(false)
  const [testCredentials, setTestCredentials] = useState<TestCredentials | null>(null)
  const [copiedField, setCopiedField] = useState<'username' | 'password' | null>(null)
  const { getDisplayName: getRoleDisplayName, isRoleActive } = useRoleConfig()
  const [inviteType, setInviteType] = useState<InviteType>('email')
  const [inviteToAllVenues, setInviteToAllVenues] = useState(false)
  const { isWhiteLabelEnabled, enabledFeatures } = useWhiteLabelConfig()
  const isSuperadmin = (staffInfo?.role || user?.role) === StaffRole.SUPERADMIN
  const allowFakeEmailForSuperadmin = inviteType === 'email' && isSuperadmin

  // Only OWNER and SUPERADMIN can invite as OWNER
  const canInviteAsOwner = user?.role === StaffRole.OWNER || user?.role === StaffRole.SUPERADMIN

  const ALL_ROLE_OPTIONS = [
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

  // Filter out roles that are marked as inactive in the venue's role config
  const ROLE_OPTIONS = ALL_ROLE_OPTIONS.filter(option => isRoleActive(option.value))

  const {
    register,
    handleSubmit,
    setValue,
    getValues,
    formState: { errors, isValid },
    reset,
  } = useForm<InviteTeamMemberFormData>({
    resolver: zodResolver(createInviteSchema(t, inviteType, allowFakeEmailForSuperadmin)),
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

  const finalizeInviteSuccess = useCallback(() => {
    reset({ type: inviteType })
    setSelectedRole(undefined)
    setInviteToAllVenues(false)
    pendingInviteMetaRef.current = null
    onSuccess()
  }, [inviteType, onSuccess, reset])

  const resolveSuperadminTestCredentials = useCallback(
    async (payload: Record<string, any>, fallbackEmail: string): Promise<TestCredentials | null> => {
      const ensureTestUserIsActive = async (email: string): Promise<{ userId: string; username: string } | null> => {
        const teamMembers = await getTeam(venueId)
        const createdMember = teamMembers.find(member => (member.email || '').toLowerCase() === email.toLowerCase())

        if (!createdMember?.id) {
          return null
        }

        const currentVenueMembership = createdMember.venues.find(venue => venue.id === venueId) || createdMember.venues[0]

        if (currentVenueMembership && !currentVenueMembership.active) {
          await teamService.updateTeamMember(venueId, currentVenueMembership.staffVenueId, { active: true })
        }

        return {
          userId: createdMember.id,
          username: createdMember.email || email,
        }
      }

      let discoveredUser: { userId: string; username: string } | null = null
      try {
        discoveredUser = await ensureTestUserIsActive(fallbackEmail)
      } catch {
        discoveredUser = null
      }

      const extracted = extractTestCredentialsFromResponse(payload, discoveredUser?.username || fallbackEmail)
      if (extracted) {
        return extracted
      }

      const candidateUserId =
        payload.userId ||
        payload.staffId ||
        payload.staff?.id ||
        payload.user?.id ||
        payload.member?.id ||
        discoveredUser?.userId

      if (candidateUserId) {
        try {
          const resetResult = await adminResetPassword(venueId, String(candidateUserId))
          return {
            username: discoveredUser?.username || fallbackEmail,
            password: resetResult.temporaryPassword,
          }
        } catch {
          // Fallback below
        }
      }

      if (!discoveredUser) {
        return null
      }

      try {
        const resetResult = await adminResetPassword(venueId, discoveredUser.userId)
        return {
          username: discoveredUser.username,
          password: resetResult.temporaryPassword,
        }
      } catch {
        return null
      }
    },
    [venueId],
  )

  const copyCredentialField = useCallback(
    async (field: 'username' | 'password') => {
      if (!testCredentials) return

      await navigator.clipboard.writeText(testCredentials[field])
      setCopiedField(field)
      setTimeout(() => setCopiedField(current => (current === field ? null : current)), 1500)
    },
    [testCredentials],
  )

  // Notify parent of validity changes
  useEffect(() => {
    onValidChange?.(isValid)
  }, [isValid, onValidChange])

  const inviteMutation = useMutation({
    mutationFn: (data: InviteTeamMemberRequest) => teamService.inviteTeamMember(venueId, data),
    onSuccess: async (data) => {
      const pendingMeta = pendingInviteMetaRef.current

      if (data.isTPVOnly) {
        toast({
          title: t('invite.tpvOnlyCreated', { defaultValue: 'Miembro TPV creado' }),
          description: data.venuesAssigned && data.venuesAssigned > 1
            ? t('invite.tpvOnlyCreatedAllVenues', {
                defaultValue: '{{name}} fue asignado a {{count}} venues.',
                name: `${getValues('firstName')} ${getValues('lastName')}`,
                count: data.venuesAssigned,
              })
            : t('invite.tpvOnlyCreatedDesc', {
                defaultValue: '{{name}} ahora puede acceder a la TPV con su PIN.',
                name: `${getValues('firstName')} ${getValues('lastName')}`,
              }),
        })
        queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })

        // Handle PIN conflicts
        if (data.pinConflicts && data.pinConflicts.length > 0) {
          setPinConflicts(data.pinConflicts.map(c => ({ ...c, newPin: '', resolved: false, saving: false })))
          setConflictSummary({
            total: data.venuesAssigned || 0,
            assigned: (data.venuesAssigned || 0) - data.pinConflicts.length,
          })
          setShowPinConflictsDialog(true)
          // Don't close the parent modal yet — let user resolve conflicts first
          return
        }
      } else {
        toast({
          title: t('invite.invitationSent'),
          description: t('invite.invitationSentDesc', { email: data.invitation.email }),
        })
      }

      if (isSuperadmin && pendingMeta?.usedFakeEmail) {
        const credentials = await resolveSuperadminTestCredentials(
          data as unknown as Record<string, any>,
          pendingMeta.normalizedEmail,
        )

        if (credentials) {
          setTestCredentials(credentials)
          setCopiedField(null)
          setShowTestCredentialsDialog(true)
          return
        }

        toast({
          title: t('invite.testCredentialsUnavailableTitle', { defaultValue: 'Invitación de prueba creada' }),
          description: t('invite.testCredentialsUnavailableDesc', {
            defaultValue: 'No se recibieron credenciales temporales. La invitación se creó con {{email}}.',
            email: pendingMeta.normalizedEmail,
          }),
        })
      }

      finalizeInviteSuccess()
    },
    onError: (error: any) => {
      const pendingMeta = pendingInviteMetaRef.current
      const errorMessage = error.response?.data?.message || ''
      const invitationId = error.response?.data?.existingInvitationId

      if (errorMessage.includes('pending invitation') || errorMessage.includes('invitación pendiente')) {
        pendingInvitationIdRef.current = invitationId || null
        setPendingResendEmail(error.response?.data?.email || pendingMeta?.normalizedEmail || null)
        pendingInviteMetaRef.current = null
        setShowResendDialog(true)
        return
      }

      pendingInviteMetaRef.current = null
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
    const rawEmail = (data.email || '').trim()
    const shouldNormalizeFakeEmail =
      inviteType === 'email' &&
      isSuperadmin &&
      rawEmail.length > 0 &&
      !isValidEmailAddress(rawEmail)

    const normalizedEmail = shouldNormalizeFakeEmail
      ? buildSuperadminTestEmail(rawEmail)
      : rawEmail.toLowerCase()

    pendingInviteMetaRef.current =
      inviteType === 'email'
        ? {
            usedFakeEmail: shouldNormalizeFakeEmail,
            originalEmail: rawEmail,
            normalizedEmail,
          }
        : null

    inviteMutation.mutate({
      ...data,
      email: inviteType === 'email' ? normalizedEmail : undefined,
      type: inviteType,
      inviteToAllVenues: selectedRole && [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.MANAGER].includes(selectedRole) ? inviteToAllVenues : undefined,
      allowFakeEmail: shouldNormalizeFakeEmail || undefined,
      generateTestCredentials: shouldNormalizeFakeEmail || undefined,
      testInvite: shouldNormalizeFakeEmail || undefined,
    })
  }

  // Expose submit function to parent via ref
  useImperativeHandle(ref, () => ({
    submit: () => handleSubmit(onSubmit)(),
  }))

  const handleRoleChange = (role: StaffRole) => {
    setSelectedRole(role)
    setValue('role', role, { shouldValidate: true })
    // Reset "invite to all venues" when changing to a role below ADMIN
    if (![StaffRole.OWNER, StaffRole.ADMIN, StaffRole.MANAGER].includes(role)) {
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
            {inviteType === 'email' && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
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
            {inviteType === 'tpv-only' && <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />}
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
                type={allowFakeEmailForSuperadmin ? 'text' : 'email'}
                placeholder={t('invite.emailPlaceholder')}
                className="h-12 text-base"
                data-autofocus
                {...register('email')}
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email.message}</p>
              )}
              {allowFakeEmailForSuperadmin && (
                <div className="rounded-lg border border-border/60 bg-muted/40 px-3 py-2">
                  <p className="text-xs font-medium bg-linear-to-r from-amber-400 to-pink-500 bg-clip-text text-transparent flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-amber-400" />
                    {t('invite.superadminFakeEmailHint', {
                      defaultValue: 'SUPERADMIN: puedes usar correo de prueba. Si no es válido, se convertirá automáticamente a un correo interno.',
                    })}
                  </p>
                </div>
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

            {/* Invite to all venues option - for MANAGER+ roles with multiple venues */}
            {selectedRole && [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.MANAGER].includes(selectedRole) && allVenues.length > 1 && (
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
                        defaultValue: 'El miembro tendrá acceso como {{role}} a los {{count}} establecimientos de la organización.',
                        role: getRoleDisplayName(selectedRole),
                        count: allVenues.length,
                      })}
                    </p>
                    {selectedRole !== StaffRole.OWNER && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" />
                        {t('invite.inviteToAllVenuesNote', {
                          defaultValue: 'Si la persona ya tiene un rol más alto en algún establecimiento, se mantendrá el rol más alto.',
                        })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* White-Label Feature Access Preview */}
            {selectedRole && isWhiteLabelEnabled && enabledFeatures.length > 0 && (
              <RoleAccessPreview
                role={selectedRole}
                enabledFeatures={enabledFeatures}
              />
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
          <AlertCircle className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
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

    {/* PIN Conflicts Resolution Dialog */}
    <AlertDialog open={showPinConflictsDialog} onOpenChange={(open) => {
      if (!open) {
        setShowPinConflictsDialog(false)
        finalizeInviteSuccess()
      }
    }}>
      <AlertDialogContent className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            {t('invite.pinConflicts.title', { defaultValue: 'PIN en conflicto' })}
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div className="space-y-3">
              {conflictSummary && (
                <p>
                  {t('invite.pinConflicts.summary', {
                    defaultValue: 'PIN asignado en {{assigned}} de {{total}} venues. En {{conflicts}} venues el PIN ya está en uso por otro miembro.',
                    assigned: conflictSummary.assigned,
                    total: conflictSummary.total,
                    conflicts: pinConflicts.length,
                  })}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                {t('invite.pinConflicts.hint', { defaultValue: 'Tip: Usa PINs de 6+ dígitos para evitar conflictos.' })}
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          {pinConflicts.map((conflict, idx) => (
            <div key={conflict.venueId} className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{conflict.venueName}</span>
                {conflict.resolved && <CheckCircle2 className="h-4 w-4 text-green-500" />}
              </div>
              <p className="text-xs text-muted-foreground">
                {t('invite.pinConflicts.inUseBy', {
                  defaultValue: 'PIN en uso por {{name}}',
                  name: conflict.conflictWith,
                })}
              </p>
              {!conflict.resolved && (
                <div className="flex items-center gap-2">
                  <Input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={10}
                    placeholder={t('invite.pinConflicts.newPinPlaceholder', { defaultValue: 'Nuevo PIN' })}
                    className="h-9 text-sm flex-1"
                    value={conflict.newPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '')
                      setPinConflicts(prev => prev.map((c, i) => i === idx ? { ...c, newPin: val } : c))
                    }}
                  />
                  <Button
                    size="sm"
                    className="rounded-full cursor-pointer"
                    disabled={!/^\d{4,10}$/.test(conflict.newPin) || conflict.saving}
                    onClick={async () => {
                      setPinConflicts(prev => prev.map((c, i) => i === idx ? { ...c, saving: true } : c))
                      try {
                        await teamService.updateTeamMember(conflict.venueId, conflict.staffVenueId, { pin: conflict.newPin })
                        setPinConflicts(prev => prev.map((c, i) => i === idx ? { ...c, resolved: true, saving: false } : c))
                        toast({ title: t('invite.pinConflicts.assigned', { defaultValue: 'PIN asignado en {{venue}}', venue: conflict.venueName }) })
                      } catch (err: any) {
                        setPinConflicts(prev => prev.map((c, i) => i === idx ? { ...c, saving: false } : c))
                        toast({
                          title: tCommon('error'),
                          description: err.response?.data?.message || err.response?.data?.error || t('invite.pinConflicts.assignError', { defaultValue: 'Error al asignar PIN' }),
                          variant: 'destructive',
                        })
                      }
                    }}
                  >
                    {conflict.saving ? <Loader2 className="h-3 w-3 animate-spin" /> : t('invite.pinConflicts.assign', { defaultValue: 'Asignar' })}
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>

        <AlertDialogFooter>
          <AlertDialogAction
            className="rounded-full cursor-pointer"
            onClick={() => {
              setShowPinConflictsDialog(false)
              finalizeInviteSuccess()
            }}
          >
            {pinConflicts.every(c => c.resolved)
              ? t('invite.pinConflicts.done', { defaultValue: 'Listo' })
              : t('invite.pinConflicts.resolveLater', { defaultValue: 'Resolver después' })
            }
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>

    <Dialog
      open={showTestCredentialsDialog}
      onOpenChange={(open) => {
        if (!open) {
          setShowTestCredentialsDialog(false)
          setTestCredentials(null)
          setCopiedField(null)
          finalizeInviteSuccess()
        }
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('invite.testCredentialsTitle', { defaultValue: 'Credenciales de prueba' })}</DialogTitle>
          <DialogDescription>
            {t('invite.testCredentialsDesc', {
              defaultValue: 'Guarda estas credenciales. Se muestran una sola vez para pruebas de acceso.',
            })}
          </DialogDescription>
        </DialogHeader>

        {testCredentials && (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>{t('invite.testCredentialsUser', { defaultValue: 'Usuario' })}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono select-all">
                  {testCredentials.username}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="cursor-pointer"
                  onClick={() => copyCredentialField('username')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label>{t('invite.testCredentialsPassword', { defaultValue: 'Contraseña temporal' })}</Label>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono select-all">
                  {testCredentials.password}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="cursor-pointer"
                  onClick={() => copyCredentialField('password')}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {copiedField && (
              <p className="text-xs text-muted-foreground">
                {t('invite.testCredentialsCopied', { defaultValue: 'Copiado al portapapeles.' })}
              </p>
            )}
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={() => {
              setShowTestCredentialsDialog(false)
              setTestCredentials(null)
              setCopiedField(null)
              finalizeInviteSuccess()
            }}
          >
            {tCommon('close', { defaultValue: 'Cerrar' })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

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
