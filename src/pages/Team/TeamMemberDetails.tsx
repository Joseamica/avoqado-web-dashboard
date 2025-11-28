import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Mail, Calendar, DollarSign, ShoppingCart, Star, Edit3, Trash2, Shield, Clock, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
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
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { StaffRole } from '@/types'
import teamService from '@/services/team.service'
import { canViewSuperadminInfo, getRoleDisplayName, getRoleBadgeColor } from '@/utils/role-permissions'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'

import EditTeamMemberForm from './components/EditTeamMemberForm'

export default function TeamMemberDetails() {
  const { venueId } = useCurrentVenue()
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('team')
  const { t: tCommon } = useTranslation()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)

  // Fetch team member details
  const { data: memberDetails, isLoading } = useQuery({
    queryKey: ['team-member', venueId, memberId],
    queryFn: () => teamService.getTeamMember(venueId, memberId!),
    enabled: !!memberId,
  })

  // Set breadcrumb to show member name instead of ID
  useEffect(() => {
    if (memberDetails && memberId) {
      const fullName = `${memberDetails.firstName} ${memberDetails.lastName}`
      setCustomSegment(memberId, fullName)
    }
    return () => {
      if (memberId) {
        clearCustomSegment(memberId)
      }
    }
  }, [memberDetails, memberId, setCustomSegment, clearCustomSegment])

  // Remove team member mutation
  const removeTeamMemberMutation = useMutation({
    mutationFn: () => teamService.removeTeamMember(venueId, memberId!),
    onSuccess: () => {
      toast({
        title: t('toasts.memberRemovedTitle'),
        description: t('toasts.memberRemovedDesc'),
      })
      navigate(-1)
    },
    onError: (error: any) => {
      toast({
        title: t('toasts.memberRemoveErrorTitle'),
        description: error.response?.data?.message || t('toasts.memberRemoveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleGoBack = () => {
    navigate(-1)
  }

  const handleEditSuccess = () => {
    setShowEditDialog(false)
    queryClient.invalidateQueries({ queryKey: ['team-member', venueId, memberId] })
    queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
  }

  const handleRemoveConfirm = () => {
    removeTeamMemberMutation.mutate()
    setShowRemoveDialog(false)
  }

  if (isLoading) {
    return (
      <div className="p-6 bg-background text-foreground">
        <div className="animate-pulse">
          <div className="h-8 bg-muted rounded w-1/3 mb-6"></div>
          <div className="space-y-4">
            <div className="h-32 bg-muted rounded"></div>
            <div className="h-48 bg-muted rounded"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!memberDetails) {
    return (
      <div className="p-6 bg-background text-foreground">
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-foreground">{t('detail.errors.memberNotFoundTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('detail.errors.memberNotFoundDesc')}</p>
          <Button onClick={handleGoBack} className="mt-4">
            {t('detail.errors.backToTeam')}
          </Button>
        </div>
      </div>
    )
  }

  // Hide superadmin members from non-superadmin users
  if (memberDetails.role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(staffInfo?.role)) {
    return (
      <div className="p-6 bg-background text-foreground">
        <div className="text-center py-12">
          <h1 className="text-xl font-semibold text-foreground">{t('detail.errors.accessDeniedTitle')}</h1>
          <p className="text-muted-foreground mt-2">{t('detail.errors.accessDeniedDesc')}</p>
          <Button onClick={handleGoBack} className="mt-4">
            {t('detail.errors.backToTeam')}
          </Button>
        </div>
      </div>
    )
  }

  const canEdit = memberDetails.role !== StaffRole.SUPERADMIN
  const canRemove = memberDetails.role !== StaffRole.OWNER && memberDetails.role !== StaffRole.SUPERADMIN

  return (
    <div className="p-6 bg-background text-foreground">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-4">
          <Button variant="ghost" onClick={handleGoBack} className="p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">
              {memberDetails.firstName} {memberDetails.lastName}
            </h1>
            <p className="text-muted-foreground">{t('detail.subtitle')}</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          {canEdit && (
            <Button id="member-edit-button" variant="outline" onClick={() => setShowEditDialog(true)}>
              <Edit3 className="h-4 w-4 mr-2" />
              {t('actions.edit')}
            </Button>
          )}
          {canRemove && (
            <Button variant="outline" onClick={() => setShowRemoveDialog(true)} className="text-destructive hover:text-destructive/80">
              <Trash2 className="h-4 w-4 mr-2" />
              {t('actions.delete')}
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Member Profile Card */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-linear-to-r from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-primary-foreground font-bold text-lg">
                  {memberDetails.firstName[0]}
                  {memberDetails.lastName[0]}
                </div>
                <div className="flex-1">
                  <CardTitle className="text-lg">
                    {memberDetails.firstName} {memberDetails.lastName}
                  </CardTitle>
                  <Badge variant="soft" className={getRoleBadgeColor(memberDetails.role, staffInfo?.role)}>
                    {getRoleDisplayName(memberDetails.role, staffInfo?.role)}
                  </Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{memberDetails.email}</span>
              </div>

              <div className="flex items-center space-x-3">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm">{tCommon('account:accountInfo.memberSince')}</div>
                  <div className="text-xs text-muted-foreground">
                    {memberDetails.startDate
                      ? (() => {
                          const d = new Date(memberDetails.startDate)
                          return isNaN(d.getTime()) ? tCommon('common.na') : d.toLocaleDateString(getIntlLocale(i18n.language))
                        })()
                      : tCommon('common.na')}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <div>
                  <div className="text-sm">{t('columns.status')}</div>
                  <Badge variant={memberDetails.active ? 'default' : 'secondary'}>
                    {memberDetails.active ? t('status.active') : t('status.inactive')}
                  </Badge>
                </div>
              </div>

              {memberDetails.pin && (
                <div className="flex items-center space-x-3">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="text-sm">{t('detail.labels.pin')}</div>
                    <div className="text-xs text-muted-foreground">••••</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Performance Metrics */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('detail.kpis.totalSales')}</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                      {Number(memberDetails.totalSales).toLocaleString(getIntlLocale(i18n.language))}
                    </p>
                  </div>
                  <DollarSign className="h-8 w-8 text-green-500 dark:text-green-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('detail.kpis.totalOrders')}</p>
                    <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                      {Number(memberDetails.totalOrders).toLocaleString(getIntlLocale(i18n.language))}
                    </p>
                  </div>
                  <ShoppingCart className="h-8 w-8 text-blue-500 dark:text-blue-400" />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">{t('detail.kpis.avgRating')}</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{memberDetails.averageRating.toFixed(1)}</p>
                  </div>
                  <Star className="h-8 w-8 text-yellow-500 dark:text-yellow-400" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Additional Metrics */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <TrendingUp className="h-5 w-5 mr-2" />
                {t('detail.performance.title')}
              </CardTitle>
              <CardDescription>{t('detail.performance.desc')}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('detail.performance.totalTips')}:</span>
                    <span className="font-medium">{Number(memberDetails.totalTips).toLocaleString(getIntlLocale(i18n.language))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('detail.performance.avgPerOrder')}:</span>
                    <span className="font-medium">
                      {memberDetails.totalOrders > 0
                        ? (memberDetails.totalSales / memberDetails.totalOrders).toLocaleString(getIntlLocale(i18n.language), {
                            minimumFractionDigits: 2,
                            maximumFractionDigits: 2,
                          })
                        : (0).toLocaleString(getIntlLocale(i18n.language), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('detail.performance.activeDays')}:</span>
                    <span className="font-medium">
                      {(() => {
                        const d = new Date(memberDetails.startDate)
                        if (isNaN(d.getTime())) return tCommon('common.na')
                        const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
                        return days.toLocaleString(getIntlLocale(i18n.language))
                      })()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">{t('detail.performance.venue')}:</span>
                    <span className="font-medium">{memberDetails.venue.name}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Organization Info */}
          <Card>
            <CardHeader>
              <CardTitle>{t('detail.organization.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('detail.organization.organization')}:</span>
                  <span className="font-medium">{memberDetails.venue.organization.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-muted-foreground">{t('detail.organization.establishment')}:</span>
                  <span className="font-medium">{memberDetails.venue.name}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit Dialog */}
      {showEditDialog && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent
            className="max-w-md"
            onCloseAutoFocus={e => {
              // Restore focus to the Edit button for accessibility
              e.preventDefault()
              const el = document.getElementById('member-edit-button') as HTMLButtonElement | null
              el?.focus()
            }}
          >
            <DialogHeader>
              <DialogTitle>{t('dialogs.editMemberTitle')}</DialogTitle>
              <DialogDescription>
                {t('dialogs.editMemberDesc', { firstName: memberDetails.firstName, lastName: memberDetails.lastName })}
              </DialogDescription>
            </DialogHeader>
            <EditTeamMemberForm venueId={venueId} teamMember={memberDetails} onSuccess={handleEditSuccess} />
          </DialogContent>
        </Dialog>
      )}

      {/* Remove Confirmation Dialog */}
      {showRemoveDialog && (
        <AlertDialog open={showRemoveDialog} onOpenChange={setShowRemoveDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('dialogs.removeTitle')}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('dialogs.removeDesc', { firstName: memberDetails.firstName, lastName: memberDetails.lastName })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('dialogs.removeCancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleRemoveConfirm}
                disabled={removeTeamMemberMutation.isPending}
                className="bg-destructive hover:bg-destructive/90"
              >
                {removeTeamMemberMutation.isPending ? t('dialogs.removing') : t('dialogs.removeConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
