import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Save, Shield, Eye, EyeOff, Layers } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole } from '@/types'
import teamService, { TeamMember, UpdateTeamMemberRequest } from '@/services/team.service'
import permissionSetService from '@/services/permissionSet.service'
import { canViewSuperadminInfo, getRoleBadgeColor } from '@/utils/role-permissions'

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
  const { t } = useTranslation('team')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const { getDisplayName: getCustomRoleDisplayName } = useRoleConfig()

  const getRoleLabel = (role: StaffRole) => {
    if (role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(staffInfo?.role)) {
      return 'Sistema'
    }
    return getCustomRoleDisplayName(role)
  }

  const editTeamMemberSchema = z.object({
    role: z.nativeEnum(StaffRole).optional(),
    active: z.boolean().optional(),
    pin: z
      .string()
      .min(4, t('edit.validation.pinMinLength'))
      .max(10, t('edit.validation.pinMaxLength'))
      .regex(/^\d+$/, t('edit.validation.pinOnlyDigits'))
      .optional()
      .or(z.literal('')),
  })

  const ROLE_OPTIONS = [
    { value: StaffRole.ADMIN, label: getRoleLabel(StaffRole.ADMIN), description: t('edit.roles.adminDesc') },
    { value: StaffRole.MANAGER, label: getRoleLabel(StaffRole.MANAGER), description: t('edit.roles.managerDesc') },
    { value: StaffRole.WAITER, label: getRoleLabel(StaffRole.WAITER), description: t('edit.roles.waiterDesc') },
    { value: StaffRole.CASHIER, label: getRoleLabel(StaffRole.CASHIER), description: t('edit.roles.cashierDesc') },
    { value: StaffRole.KITCHEN, label: getRoleLabel(StaffRole.KITCHEN), description: t('edit.roles.kitchenDesc') },
    { value: StaffRole.HOST, label: getRoleLabel(StaffRole.HOST), description: t('edit.roles.hostDesc') },
    { value: StaffRole.VIEWER, label: getRoleLabel(StaffRole.VIEWER), description: t('edit.roles.viewerDesc') },
  ]
  const [showPin, setShowPin] = useState(false)
  const [selectedRole, setSelectedRole] = useState<StaffRole>(teamMember.role)
  const [isActive, setIsActive] = useState(teamMember.active)
  const [selectedPermissionSetId, setSelectedPermissionSetId] = useState<string | null>(teamMember.permissionSetId)

  // Fetch permission sets for the venue
  const { data: permissionSetsData } = useQuery({
    queryKey: ['permission-sets', venueId],
    queryFn: () => permissionSetService.getAll(venueId),
  })
  const permissionSets = permissionSetsData?.data ?? []

  // Filter role options to hide SUPERADMIN from non-superadmin users
  const filteredRoleOptions = ROLE_OPTIONS.filter(option => option.value !== StaffRole.SUPERADMIN || canViewSuperadminInfo(staffInfo?.role))

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
    setValue('role', selectedRole, { shouldDirty: true })
    setValue('active', isActive, { shouldDirty: true })
  }, [selectedRole, isActive, setValue])

  const updateMutation = useMutation({
    mutationFn: (data: UpdateTeamMemberRequest) => teamService.updateTeamMember(venueId, teamMember.id, data),
    onSuccess: data => {
      toast({
        title: t('edit.memberUpdated'),
        description: t('edit.memberUpdatedDesc', { firstName: teamMember.firstName, lastName: teamMember.lastName }),
      })
      reset({
        role: data.data.role,
        active: data.data.active,
        pin: '',
      })
      onSuccess()
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || tCommon('common.error')
      toast({
        title: tCommon('common.error'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const assignPermissionSetMutation = useMutation({
    mutationFn: (permissionSetId: string | null) => permissionSetService.assignToStaff(venueId, teamMember.id, permissionSetId),
    onSuccess: () => {
      // Handled in onSubmit combined flow
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || tCommon('common.error')
      toast({
        title: tCommon('common.error'),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const onSubmit = async (data: EditTeamMemberFormData) => {
    const updateData: UpdateTeamMemberRequest = {}
    const permissionSetChanged = selectedPermissionSetId !== teamMember.permissionSetId

    if (data.role !== teamMember.role) {
      updateData.role = data.role
    }

    if (data.active !== teamMember.active) {
      updateData.active = data.active
    }

    if (data.pin && data.pin.trim() !== '') {
      updateData.pin = data.pin
    }

    const hasRoleChanges = Object.keys(updateData).length > 0

    // Only submit if there are actual changes
    if (!hasRoleChanges && !permissionSetChanged) {
      toast({
        title: t('edit.noChanges'),
        description: t('edit.noChangesDesc'),
      })
      return
    }

    // Assign permission set if changed
    if (permissionSetChanged) {
      await assignPermissionSetMutation.mutateAsync(selectedPermissionSetId)
    }

    // Update role/active/pin if changed
    if (hasRoleChanges) {
      updateMutation.mutate(updateData)
    } else {
      // Only permission set changed, trigger success directly
      toast({
        title: t('edit.memberUpdated'),
        description: t('edit.memberUpdatedDesc', { firstName: teamMember.firstName, lastName: teamMember.lastName }),
      })
      onSuccess()
    }
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
          {getRoleLabel(teamMember.role)}
        </Badge>
      </div>

      {/* Role Selection */}
      <div className="space-y-2">
        <Label>{t('edit.role')}</Label>
        <Select
          onValueChange={value => setSelectedRole(value as StaffRole)}
          value={selectedRole}
          disabled={teamMember.role === StaffRole.OWNER || teamMember.role === StaffRole.SUPERADMIN}
        >
          <SelectTrigger data-autofocus>
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="max-w-[90vw] sm:max-w-md">
            {filteredRoleOptions.map(option => (
              <SelectItem key={option.value} value={option.value} disabled={option.value === StaffRole.SUPERADMIN}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.role && <p className="text-sm text-destructive">{errors.role.message}</p>}
        {selectedRoleInfo && selectedRole !== teamMember.role && (
          <div className="w-full max-w-full p-3 bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-md overflow-hidden">
            <p className="text-sm text-blue-800 dark:text-blue-200 break-words whitespace-normal overflow-wrap-anywhere">
              <strong className="font-semibold">{t('edit.newRole')}:</strong> <span className="inline">{selectedRoleInfo.description}</span>
            </p>
          </div>
        )}
        {(teamMember.role === StaffRole.OWNER || teamMember.role === StaffRole.SUPERADMIN) && (
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              {teamMember.role === StaffRole.OWNER ? t('edit.cannotChangeOwnerRole') : t('edit.cannotChangeSuperadminRole')}
            </AlertDescription>
          </Alert>
        )}
      </div>

      {/* Permission Set */}
      {permissionSets.length > 0 && (
        <div className="space-y-2">
          <Label className="flex items-center gap-1.5">
            <Layers className="h-4 w-4" />
            {t('edit.permissionSet')}
          </Label>
          <Select
            value={selectedPermissionSetId ?? '_none'}
            onValueChange={value => setSelectedPermissionSetId(value === '_none' ? null : value)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="max-w-[90vw] sm:max-w-md">
              <SelectItem value="_none">{t('edit.permissionSetNone')}</SelectItem>
              {permissionSets.map(ps => (
                <SelectItem key={ps.id} value={ps.id}>
                  <span className="flex items-center gap-2">
                    {ps.color && (
                      <span className="inline-block h-2.5 w-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: ps.color }} />
                    )}
                    {ps.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedPermissionSetId && selectedPermissionSetId !== teamMember.permissionSetId && (
            <div className="w-full p-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md">
              <p className="text-sm text-amber-800 dark:text-amber-200">{t('edit.permissionSetOverride')}</p>
            </div>
          )}
        </div>
      )}

      {/* Status Toggle */}
      <div className="flex items-center justify-between p-4 border border-border rounded-lg">
        <div className="space-y-1">
          <Label className="text-base font-medium">{t('edit.memberStatus')}</Label>
          <p className="text-sm text-muted-foreground">{isActive ? t('edit.memberActive') : t('edit.memberInactive')}</p>
        </div>
        <Switch checked={isActive} onCheckedChange={setIsActive} disabled={!canDeactivate} />
      </div>
      {!canDeactivate && (
        <Alert>
          <Shield className="h-4 w-4" />
          <AlertDescription>{t('edit.cannotDeactivateOwner')}</AlertDescription>
        </Alert>
      )}

      {/* PIN Field */}
      <div className="space-y-2">
        <Label htmlFor="pin">{t('edit.changePin')}</Label>
        <div className="relative">
          <Input
            id="pin"
            type={showPin ? 'text' : 'password'}
            placeholder={t('edit.newPin')}
            className="pr-10"
            maxLength={10}
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
        {errors.pin && <p className="text-sm text-destructive">{errors.pin.message}</p>}
        {watchedPin && <p className="text-sm text-blue-600 dark:text-blue-400">{t('edit.newPinSet')}</p>}
      </div>

      {/* Performance Summary */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted rounded-lg">
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">${teamMember.totalSales.toLocaleString()}</div>
          <div className="text-sm text-muted-foreground">{t('edit.totalSales')}</div>
        </div>
        <div className="text-center">
          <div className="text-2xl font-bold text-foreground">{teamMember.totalOrders}</div>
          <div className="text-sm text-muted-foreground">{t('edit.orders')}</div>
        </div>
      </div>

      {/* Submit Button */}
      <div className="flex justify-end space-x-3">
        <Button
          type="submit"
          disabled={
            (!isDirty && selectedPermissionSetId === teamMember.permissionSetId) ||
            updateMutation.isPending ||
            assignPermissionSetMutation.isPending
          }
          className="min-w-[120px]"
        >
          {updateMutation.isPending || assignPermissionSetMutation.isPending ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
              {t('edit.saving')}
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              {t('edit.saveChanges')}
            </>
          )}
        </Button>
      </div>
    </form>
  )
}
