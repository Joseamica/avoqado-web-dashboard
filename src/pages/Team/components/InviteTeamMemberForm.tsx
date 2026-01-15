import { useState, useRef } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Mail, Send, AlertCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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
import teamService, { InviteTeamMemberRequest } from '@/services/team.service'

type InviteTeamMemberFormData = InviteTeamMemberRequest

interface InviteTeamMemberFormProps {
  venueId: string
  onSuccess: () => void
}

// Define schema creation function outside component to avoid recreation
const createInviteSchema = (t: (key: string) => string) =>
  z.object({
    email: z
      .string()
      .email(t('invite.validation.emailFormat'))
      .min(1, t('invite.validation.emailRequired')),
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
  })

export default function InviteTeamMemberForm({ venueId, onSuccess }: InviteTeamMemberFormProps) {
  const { t } = useTranslation('team')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [selectedRole, setSelectedRole] = useState<StaffRole | undefined>()
  const [showResendDialog, setShowResendDialog] = useState(false)
  const [pendingResendEmail, setPendingResendEmail] = useState<string | null>(null)
  const pendingInvitationIdRef = useRef<string | null>(null)
  const { getDisplayName: getRoleDisplayName } = useRoleConfig()

  const ROLE_OPTIONS = [
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
    resolver: zodResolver(createInviteSchema(t)),
    mode: 'onBlur', // Changed from onChange to onBlur to prevent excessive validation
  })

  const inviteMutation = useMutation({
    mutationFn: (data: InviteTeamMemberRequest) => teamService.inviteTeamMember(venueId, data),
    onSuccess: (data) => {
      toast({
        title: t('invite.invitationSent'),
        description: t('invite.invitationSentDesc', { email: data.invitation.email }),
      })
      reset()
      setSelectedRole(undefined)
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || ''
      const invitationId = error.response?.data?.existingInvitationId

      // Check if it's a "pending invitation exists" error
      if (errorMessage.includes('pending invitation') || errorMessage.includes('invitación pendiente')) {
        // Store the invitation ID if provided, otherwise we'll need to look it up
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

  // Mutation for resending invitation
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
    inviteMutation.mutate(data)
  }

  const handleRoleChange = (role: StaffRole) => {
    setSelectedRole(role)
    setValue('role', role, { shouldValidate: true })
  }

  const handleResendConfirm = async () => {
    if (pendingInvitationIdRef.current) {
      // We have the invitation ID, resend directly
      resendInvitationMutation.mutate(pendingInvitationIdRef.current)
    } else {
      // Fetch pending invitations to find the one with this email
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
      } catch (error) {
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
      {/* Email Field */}
      <div className="space-y-2">
        <Label htmlFor="email">{t('invite.emailLabel')} *</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t('invite.emailPlaceholder')}
            className="pl-10"
            data-autofocus
            {...register('email')}
          />
        </div>
        {errors.email && (
          <p className="text-sm text-destructive">{errors.email.message}</p>
        )}
      </div>

      {/* Name Fields */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="firstName">{t('invite.firstNameLabel')} *</Label>
          <Input
            id="firstName"
            placeholder={t('invite.firstNamePlaceholder')}
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
          <SelectTrigger>
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
          <div className="w-full max-w-full p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md overflow-hidden">
            <p className="text-sm text-blue-800 dark:text-blue-200 break-words whitespace-normal overflow-wrap-anywhere">
              <strong className="font-semibold">{selectedRoleInfo.label}:</strong>{' '}
              <span className="inline">{selectedRoleInfo.description}</span>
            </p>
          </div>
        )}
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <Label htmlFor="message">{t('invite.messageLabel')}</Label>
        <Textarea
          id="message"
          placeholder={t('invite.messagePlaceholder')}
          rows={3}
          {...register('message')}
        />
        {errors.message && (
          <p className="text-sm text-destructive">{errors.message.message}</p>
        )}
      </div>

      {/* Info Alert */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {t('invite.infoAlert')}
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
              {t('invite.sending')}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {t('invite.sendButton')}
            </>
          )}
        </Button>
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
}
