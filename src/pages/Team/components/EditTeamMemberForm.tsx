import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Shield, Eye, EyeOff } from 'lucide-react'
import { useTranslation } from 'react-i18next'

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

type EditTeamMemberFormData = {
  role?: StaffRole
  active?: boolean
  pin?: string
}

interface EditTeamMemberFormProps {
  venueId: string
  teamMember: TeamMember
  onSuccess: () => void
}

export default function EditTeamMemberForm({ venueId, teamMember, onSuccess }: EditTeamMemberFormProps) {
  const { t } = useTranslation()
  const { toast } = useToast()
  const { staffInfo } = useAuth()

  const editTeamMemberSchema = z.object({
    role: z.nativeEnum(StaffRole).optional(),
    active: z.boolean().optional(),
    pin: z
      .string()
      .regex(/^\d{4}$/, t('team.edit.validation.pinFormat'))
      .optional()
      .or(z.literal('')),
  })

  const ROLE_OPTIONS = [
    { value: StaffRole.ADMIN, label: t('team.edit.roles.admin'), description: t('team.edit.roles.adminDesc') },
    { value: StaffRole.MANAGER, label: t('team.edit.roles.manager'), description: t('team.edit.roles.managerDesc') },
    { value: StaffRole.WAITER, label: t('team.edit.roles.waiter'), description: t('team.edit.roles.waiterDesc') },
    { value: StaffRole.CASHIER, label: t('team.edit.roles.cashier'), description: t('team.edit.roles.cashierDesc') },
    { value: StaffRole.KITCHEN, label: t('team.edit.roles.kitchen'), description: t('team.edit.roles.kitchenDesc') },
    { value: StaffRole.HOST, label: t('team.edit.roles.host'), description: t('team.edit.roles.hostDesc') },
    { value: StaffRole.VIEWER, label: t('team.edit.roles.viewer'), description: t('team.edit.roles.viewerDesc') },
  ]
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
        title: t('team.edit.memberUpdated'),
        description: t('team.edit.memberUpdatedDesc', { firstName: teamMember.firstName, lastName: teamMember.lastName }),
      })
      reset({
        role: data.data.role,
        active: data.data.active,
        pin: '',
      })
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || t('team.edit.updateError')
      toast({
        title: t('common.error'),
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
        title: t('team.edit.noChanges'),
        description: t('team.edit.noChangesDesc'),
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
        <Label>{t('team.edit.role')}</Label>
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
              <strong>{t('team.edit.newRole')}:</strong> {selectedRoleInfo.description}
            </p>
          </div>
        )}
        {(teamMember.role === StaffRole.OWNER || teamMember.role === StaffRole.SUPERADMIN) && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {teamMember.role === StaffRole.OWNER ? t('team.edit.cannotChangeOwnerRole') : t('team.edit.cannotChangeSuperadminRole')}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Status Toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div className="space-y-1">
          <Label className="text-base font-medium">{t('team.edit.memberStatus')}</Label>
          <p className="text-sm text-muted-foreground">
            {isActive ? t('team.edit.memberActive') : t('team.edit.memberInactive')}
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
            {t('team.edit.cannotDeactivateOwner')}
          </AlertDescription>
        </Alert>
      )}

      {/* PIN Field */}
      <div className="space-y-2">
        <Label htmlFor="pin">{t('team.edit.changePin')}</Label>
        <div className="relative">
          <Input
            id="pin"
            type={showPin ? 'text' : 'password'}
            placeholder={t('team.edit.newPin')}
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
            {t('team.edit.newPinSet')}
          </p>
        )}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            ${teamMember.totalSales.toLocaleString()}
          </div>
          <div className="text-sm text-muted-foreground">{t('team.edit.totalSales')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">
            {teamMember.totalOrders}
          </div>
          <div className="text-sm text-muted-foreground">{t('team.edit.orders')}</div>
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
              {t('team.edit.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('team.edit.saveChanges')}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
