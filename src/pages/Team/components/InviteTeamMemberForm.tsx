import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
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
import { useToast } from '@/hooks/use-toast'
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
      .email(t('team.invite.validation.emailFormat'))
      .min(1, t('team.invite.validation.emailRequired')),
    firstName: z
      .string()
      .min(1, t('team.invite.validation.firstNameRequired'))
      .max(50, t('team.invite.validation.firstNameMax')),
    lastName: z
      .string()
      .min(1, t('team.invite.validation.lastNameRequired'))
      .max(50, t('team.invite.validation.lastNameMax')),
    role: z.nativeEnum(StaffRole, { required_error: t('team.invite.validation.roleRequired') }),
    message: z.string().max(500, t('team.invite.validation.messageMax')).optional(),
  })

export default function InviteTeamMemberForm({ venueId, onSuccess }: InviteTeamMemberFormProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const [selectedRole, setSelectedRole] = useState<StaffRole | undefined>()

  const ROLE_OPTIONS = [
    { value: StaffRole.ADMIN, label: t('team.edit.roles.admin'), description: t('team.edit.roles.adminDesc') },
    { value: StaffRole.MANAGER, label: t('team.edit.roles.manager'), description: t('team.edit.roles.managerDesc') },
    { value: StaffRole.WAITER, label: t('team.edit.roles.waiter'), description: t('team.edit.roles.waiterDesc') },
    { value: StaffRole.CASHIER, label: t('team.edit.roles.cashier'), description: t('team.edit.roles.cashierDesc') },
    { value: StaffRole.KITCHEN, label: t('team.edit.roles.kitchen'), description: t('team.edit.roles.kitchenDesc') },
    { value: StaffRole.HOST, label: t('team.edit.roles.host'), description: t('team.edit.roles.hostDesc') },
    { value: StaffRole.VIEWER, label: t('team.edit.roles.viewer'), description: t('team.edit.roles.viewerDesc') },
  ]

  const {
    register,
    handleSubmit,
    setValue,
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
        title: t('team.invite.invitationSent'),
        description: t('team.invite.invitationSentDesc', { email: data.invitation.email }),
      })
      reset()
      setSelectedRole(undefined)
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || t('team.invite.invitationError')
      toast({
        title: t('common.error'),
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
        <Label htmlFor="email">{t('team.invite.emailLabel')} *</Label>
        <div className="relative">
          <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="email"
            type="email"
            placeholder={t('team.invite.emailPlaceholder')}
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
          <Label htmlFor="firstName">{t('team.invite.firstNameLabel')} *</Label>
          <Input
            id="firstName"
            placeholder={t('team.invite.firstNamePlaceholder')}
            {...register('firstName')}
          />
          {errors.firstName && (
            <p className="text-sm text-destructive">{errors.firstName.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="lastName">{t('team.invite.lastNameLabel')} *</Label>
          <Input
            id="lastName"
            placeholder={t('team.invite.lastNamePlaceholder')}
            {...register('lastName')}
          />
          {errors.lastName && (
            <p className="text-sm text-destructive">{errors.lastName.message}</p>
          )}
        </div>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <Label>{t('team.invite.roleLabel')} *</Label>
        <Select onValueChange={handleRoleChange} value={selectedRole}>
          <SelectTrigger>
            <SelectValue placeholder={t('team.invite.roleSelectPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            {ROLE_OPTIONS.map((option) => (
              <SelectItem key={option.value} value={option.value}>
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
        {selectedRoleInfo && (
          <div className="p-3 bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 rounded-md">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>{selectedRoleInfo.label}:</strong> {selectedRoleInfo.description}
            </p>
          </div>
        )}
      </div>

      {/* Message Field */}
      <div className="space-y-2">
        <Label htmlFor="message">{t('team.invite.messageLabel')}</Label>
        <Textarea
          id="message"
          placeholder={t('team.invite.messagePlaceholder')}
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
          {t('team.invite.infoAlert')}
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
              {t('team.invite.sending')}
            </>
          ) : (
            <>
              <Send className="h-4 w-4 mr-2" />
              {t('team.invite.sendButton')}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}