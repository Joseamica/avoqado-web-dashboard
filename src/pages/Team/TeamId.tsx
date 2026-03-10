import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Mail, Calendar, DollarSign, ShoppingCart, Star, Edit3,
  UserMinus, Trash2, Eye, EyeOff, Download, KeyRound, Building2, TrendingUp,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useRoleConfig } from '@/hooks/use-role-config'
import { StaffRole } from '@/types'
import teamService from '@/services/team.service'
import { canViewSuperadminInfo, getRoleBadgeColor } from '@/utils/role-permissions'
import { useTranslation } from 'react-i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useVenueDateTime } from '@/utils/datetime'
import { PermissionGate } from '@/components/PermissionGate'

import EditTeamMemberForm from './components/EditTeamMemberForm'
import TeamCommissionSection from './components/TeamCommissionSection'

type TabValue = 'performance' | 'commissions'

export default function TeamId() {
  const { venueId } = useCurrentVenue()
  const { memberId } = useParams<{ memberId: string }>()
  const navigate = useNavigate()
  const { toast } = useToast()
  const { staffInfo } = useAuth()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('team')
  const { t: tCommon } = useTranslation()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()
  const { formatDate } = useVenueDateTime()
  const { getDisplayName: getCustomRoleDisplayName } = useRoleConfig()

  const [activeTab, setActiveTab] = useState<TabValue>('performance')
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showRemoveDialog, setShowRemoveDialog] = useState(false)
  const [showHardDeleteDialog, setShowHardDeleteDialog] = useState(false)
  const [showPin, setShowPin] = useState(false)

  const isSuperadmin = staffInfo?.role === StaffRole.SUPERADMIN
  const locale = getIntlLocale(i18n.language)

  const { data: memberDetails, isLoading } = useQuery({
    queryKey: ['team-member', venueId, memberId],
    queryFn: () => teamService.getTeamMember(venueId, memberId!),
    enabled: !!memberId,
  })

  useEffect(() => {
    if (memberDetails && memberId) {
      setCustomSegment(memberId, `${memberDetails.firstName} ${memberDetails.lastName}`)
    }
    return () => { if (memberId) clearCustomSegment(memberId) }
  }, [memberDetails, memberId, setCustomSegment, clearCustomSegment])

  // ── Mutations ──────────────────────────────────────────
  const removeTeamMemberMutation = useMutation({
    mutationFn: () => teamService.removeTeamMember(venueId, memberId!),
    onSuccess: () => {
      toast({ title: t('toasts.memberRemovedTitle'), description: t('toasts.memberRemovedDesc', { firstName: memberDetails?.firstName || '', lastName: memberDetails?.lastName || '' }) })
      navigate(-1)
    },
    onError: (error: any) => {
      toast({ title: t('toasts.memberRemoveErrorTitle'), description: error.response?.data?.message || t('toasts.memberRemoveErrorDesc'), variant: 'destructive' })
    },
  })

  const hardDeleteMutation = useMutation({
    mutationFn: () => teamService.hardDeleteTeamMember(venueId, memberId!),
    onSuccess: result => {
      toast({ title: t('toasts.memberHardDeletedTitle'), description: t('toasts.memberHardDeletedDesc', { firstName: memberDetails?.firstName || '', lastName: memberDetails?.lastName || '', count: Object.values(result.deletedRecords).reduce((a: number, b: number) => a + b, 0) }) })
      queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
      navigate(-1)
    },
    onError: (error: any) => {
      toast({ title: t('toasts.memberHardDeleteErrorTitle'), description: error.response?.data?.message || t('toasts.memberHardDeleteErrorDesc'), variant: 'destructive' })
    },
  })

  // ── Helpers ────────────────────────────────────────────
  const formatCurrency = useCallback(
    (amount: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'MXN' }).format(amount),
    [locale],
  )

  const handleDownloadReport = useCallback(() => {
    if (!memberDetails) return
    const m = memberDetails
    const avgTicket = m.totalOrders > 0 ? (m.totalSales / m.totalOrders).toFixed(2) : '0'
    const rows = [
      ['Reporte de Miembro del Equipo'],
      ['Generado', new Date().toLocaleString(locale)],
      [],
      ['Información Personal'],
      ['Nombre', `${m.firstName} ${m.lastName}`],
      ['Email', m.email],
      ['Rol', getCustomRoleDisplayName(m.role)],
      ['Estado', m.active ? 'Activo' : 'Inactivo'],
      ['PIN', m.pin ? 'Asignado' : 'No asignado'],
      ['Fecha de inicio', m.startDate ? formatDate(m.startDate) || 'N/A' : 'N/A'],
      [],
      ['Rendimiento (Histórico)'],
      ['Ventas Totales', `$${Number(m.totalSales).toFixed(2)}`],
      ['Órdenes Totales', String(m.totalOrders)],
      ['Propinas Totales', `$${Number(m.totalTips).toFixed(2)}`],
      ['Calificación Promedio', m.averageRating.toFixed(1)],
      ['Ticket Promedio', `$${avgTicket}`],
      [],
      ['Organización'],
      ['Organización', m.venue.organization.name],
      ['Establecimiento', m.venue.name],
    ]

    const csv = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `reporte-${m.firstName}-${m.lastName}-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [memberDetails, locale, formatDate, getCustomRoleDisplayName])

  const handleGoBack = () => navigate(-1)
  const handleEditSuccess = () => {
    setShowEditDialog(false)
    queryClient.invalidateQueries({ queryKey: ['team-member', venueId, memberId] })
    queryClient.invalidateQueries({ queryKey: ['team-members', venueId] })
  }

  // ── Loading / Error States ─────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-6">
          <div className="flex items-center gap-4">
            <div className="h-10 w-10 bg-muted rounded-full" />
            <div className="h-14 w-14 bg-muted rounded-full" />
            <div className="space-y-2">
              <div className="h-6 bg-muted rounded w-48" />
              <div className="h-4 bg-muted rounded w-72" />
            </div>
          </div>
          <div className="grid grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <div key={i} className="h-24 bg-muted rounded-xl" />)}
          </div>
          <div className="h-64 bg-muted rounded-xl" />
        </div>
      </div>
    )
  }

  if (!memberDetails) {
    return (
      <div className="p-6 text-center py-24">
        <h1 className="text-xl font-semibold">{t('detail.errors.memberNotFoundTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('detail.errors.memberNotFoundDesc')}</p>
        <Button onClick={handleGoBack} className="mt-4">{t('detail.errors.backToTeam')}</Button>
      </div>
    )
  }

  if (memberDetails.role === StaffRole.SUPERADMIN && !canViewSuperadminInfo(staffInfo?.role)) {
    return (
      <div className="p-6 text-center py-24">
        <h1 className="text-xl font-semibold">{t('detail.errors.accessDeniedTitle')}</h1>
        <p className="text-muted-foreground mt-2">{t('detail.errors.accessDeniedDesc')}</p>
        <Button onClick={handleGoBack} className="mt-4">{t('detail.errors.backToTeam')}</Button>
      </div>
    )
  }

  const canEdit = memberDetails.role !== StaffRole.SUPERADMIN
  const canRemove = memberDetails.role !== StaffRole.OWNER && memberDetails.role !== StaffRole.SUPERADMIN
  const hasActivity = memberDetails.totalSales > 0 || memberDetails.totalOrders > 0
  const avgTicket = memberDetails.totalOrders > 0 ? memberDetails.totalSales / memberDetails.totalOrders : 0

  return (
    <div className="p-6">
      {/* ─── Header ─────────────────────────────────────── */}
      <div className="flex items-start justify-between mb-8">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleGoBack} className="cursor-pointer shrink-0">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-primary-foreground font-bold text-lg shrink-0">
            {memberDetails.firstName[0]}{memberDetails.lastName[0]}
          </div>
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-2xl font-bold">{memberDetails.firstName} {memberDetails.lastName}</h1>
              <Badge variant="soft" className={getRoleBadgeColor(memberDetails.role, staffInfo?.role)}>
                {getCustomRoleDisplayName(memberDetails.role)}
              </Badge>
              <Badge variant={memberDetails.active ? 'default' : 'secondary'}>
                {memberDetails.active ? t('status.active') : t('status.inactive')}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground flex-wrap">
              <span className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                {memberDetails.email}
              </span>
              <span className="flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5" />
                {t('detail.labels.memberSince', { defaultValue: 'Desde' })}{' '}
                {memberDetails.startDate ? formatDate(memberDetails.startDate) || tCommon('common.na') : tCommon('common.na')}
              </span>
              <span className="flex items-center gap-1.5">
                <KeyRound className="h-3.5 w-3.5" />
                {memberDetails.pin ? (
                  <span className="flex items-center gap-1">
                    <span className="font-mono text-xs">{isSuperadmin && showPin ? memberDetails.pin : '••••'}</span>
                    {isSuperadmin && (
                      <button onClick={() => setShowPin(!showPin)} className="p-0.5 rounded hover:bg-muted transition-colors cursor-pointer">
                        {showPin ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </button>
                    )}
                  </span>
                ) : (
                  <span className="text-orange-500">{t('detail.labels.pinNotAssigned', { defaultValue: 'Sin PIN' })}</span>
                )}
              </span>
              <span className="flex items-center gap-1.5">
                <Building2 className="h-3.5 w-3.5" />
                {memberDetails.venue.organization.name} &middot; {memberDetails.venue.name}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleDownloadReport} className="cursor-pointer">
            <Download className="h-4 w-4 mr-2" />
            {t('actions.download', { defaultValue: 'Descargar' })}
          </Button>
          <PermissionGate permission="teams:update">
            {canEdit && (
              <Button id="member-edit-button" variant="outline" size="sm" onClick={() => setShowEditDialog(true)} className="cursor-pointer">
                <Edit3 className="h-4 w-4 mr-2" />
                {t('actions.edit')}
              </Button>
            )}
          </PermissionGate>
          <PermissionGate permission="teams:delete">
            {canRemove && (
              <Button variant="outline" size="sm" onClick={() => setShowRemoveDialog(true)} className="text-amber-600 hover:text-amber-700 dark:text-amber-500 dark:hover:text-amber-400 cursor-pointer">
                <UserMinus className="h-4 w-4 mr-2" />
                {t('actions.deactivate')}
              </Button>
            )}
          </PermissionGate>
          {isSuperadmin && canRemove && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowHardDeleteDialog(true)}
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground border-0 cursor-pointer"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              {t('actions.hardDelete')}
            </Button>
          )}
        </div>
      </div>

      {/* ─── KPI Cards ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('detail.kpis.totalSales')}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(memberDetails.totalSales)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('detail.kpis.totalOrders')}</p>
                <p className="text-2xl font-bold mt-1">{Number(memberDetails.totalOrders).toLocaleString(locale)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
                <ShoppingCart className="h-5 w-5 text-blue-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('detail.kpis.totalTips', { defaultValue: 'Propinas' })}</p>
                <p className="text-2xl font-bold mt-1">{formatCurrency(memberDetails.totalTips)}</p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-purple-500/10 flex items-center justify-center">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('detail.kpis.avgRating')}</p>
                <p className="text-2xl font-bold mt-1">
                  {memberDetails.averageRating > 0 ? memberDetails.averageRating.toFixed(1) : '—'}
                </p>
              </div>
              <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                <Star className="h-5 w-5 text-yellow-500" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ─── Tabs ───────────────────────────────────────── */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as TabValue)}>
        <div className="border-b border-border mb-6">
          <nav className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActiveTab('performance')}
              className={`relative pb-3 text-sm font-medium transition-colors cursor-pointer ${
                activeTab === 'performance' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('detail.tabs.performance', { defaultValue: 'Rendimiento' })}
              {activeTab === 'performance' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />}
            </button>
            <PermissionGate permission="commissions:read">
              <button
                type="button"
                onClick={() => setActiveTab('commissions')}
                className={`relative pb-3 text-sm font-medium transition-colors cursor-pointer ${
                  activeTab === 'commissions' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {t('detail.tabs.commissions', { defaultValue: 'Comisiones' })}
                {activeTab === 'commissions' && <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />}
              </button>
            </PermissionGate>
          </nav>
        </div>

        {/* ─── Performance Tab ────────────────────────── */}
        <TabsContent value="performance">
          {hasActivity ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('detail.performance.title', { defaultValue: 'Métricas de Rendimiento' })}</CardTitle>
                  <CardDescription>{t('detail.performance.desc', { defaultValue: 'Resumen histórico de actividad' })}</CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="divide-y divide-border/50">
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">{t('detail.performance.avgPerOrder', { defaultValue: 'Ticket promedio' })}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(avgTicket)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">{t('detail.performance.totalTips', { defaultValue: 'Propinas totales' })}</span>
                      <span className="font-semibold tabular-nums">{formatCurrency(memberDetails.totalTips)}</span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">{t('detail.performance.tipsRate', { defaultValue: 'Tasa de propina' })}</span>
                      <span className="font-semibold tabular-nums">
                        {memberDetails.totalSales > 0
                          ? `${((memberDetails.totalTips / memberDetails.totalSales) * 100).toFixed(1)}%`
                          : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">{t('detail.performance.avgRating', { defaultValue: 'Calificación promedio' })}</span>
                      <span className="font-semibold flex items-center gap-1">
                        {memberDetails.averageRating > 0 ? (
                          <>
                            <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            {memberDetails.averageRating.toFixed(1)}
                          </>
                        ) : '—'}
                      </span>
                    </div>
                    <div className="flex justify-between items-center py-3">
                      <span className="text-sm text-muted-foreground">{t('detail.performance.activeDays', { defaultValue: 'Días en equipo' })}</span>
                      <span className="font-semibold tabular-nums">
                        {(() => {
                          const d = new Date(memberDetails.startDate)
                          if (isNaN(d.getTime())) return tCommon('common.na')
                          const days = Math.floor((Date.now() - d.getTime()) / (1000 * 60 * 60 * 24))
                          return days.toLocaleString(locale)
                        })()}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{t('detail.insights.title', { defaultValue: 'Resumen Rápido' })}</CardTitle>
                  <CardDescription>{t('detail.insights.desc', { defaultValue: 'Datos clave de un vistazo' })}</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-5">
                    {/* Visual stat bars */}
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">{t('detail.kpis.totalSales')}</span>
                        <span className="font-medium">{formatCurrency(memberDetails.totalSales)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: '100%' }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-muted-foreground">{t('detail.kpis.totalTips', { defaultValue: 'Propinas' })}</span>
                        <span className="font-medium">{formatCurrency(memberDetails.totalTips)}</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full bg-purple-500 transition-all"
                          style={{ width: memberDetails.totalSales > 0 ? `${Math.min((memberDetails.totalTips / memberDetails.totalSales) * 100, 100)}%` : '0%' }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {memberDetails.totalSales > 0
                          ? `${((memberDetails.totalTips / memberDetails.totalSales) * 100).toFixed(1)}% ${t('detail.insights.ofSales', { defaultValue: 'de las ventas' })}`
                          : ''}
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 pt-2 mt-2 border-t border-border/50">
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-2xl font-bold">{Number(memberDetails.totalOrders).toLocaleString(locale)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('detail.kpis.totalOrders')}</p>
                      </div>
                      <div className="text-center p-3 rounded-xl bg-muted/50">
                        <p className="text-2xl font-bold">{formatCurrency(avgTicket)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{t('detail.performance.avgPerOrder', { defaultValue: 'Ticket promedio' })}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : (
            <Card>
              <CardContent className="py-16 text-center">
                <ShoppingCart className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
                <h3 className="font-semibold text-lg">{t('detail.emptyState.title', { defaultValue: 'Sin actividad registrada' })}</h3>
                <p className="text-sm text-muted-foreground mt-1 max-w-sm mx-auto">
                  {t('detail.emptyState.desc', { defaultValue: 'Este miembro aún no ha registrado ventas u órdenes. Los datos aparecerán aquí una vez que comience a operar.' })}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ─── Commissions Tab ────────────────────────── */}
        <TabsContent value="commissions">
          <PermissionGate permission="commissions:read">
            <TeamCommissionSection staffId={memberDetails.staffId} />
          </PermissionGate>
        </TabsContent>
      </Tabs>

      {/* ─── Edit Dialog ───────────────────────────────── */}
      {showEditDialog && (
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent
            className="max-w-md"
            onCloseAutoFocus={e => {
              e.preventDefault()
              ;(document.getElementById('member-edit-button') as HTMLButtonElement | null)?.focus()
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

      {/* ─── Remove Dialog ─────────────────────────────── */}
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
              <AlertDialogAction onClick={() => { removeTeamMemberMutation.mutate(); setShowRemoveDialog(false) }} disabled={removeTeamMemberMutation.isPending} className="bg-amber-600 hover:bg-amber-700">
                {removeTeamMemberMutation.isPending ? t('dialogs.deactivating') : t('dialogs.deactivateConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}

      {/* ─── Hard Delete Dialog ────────────────────────── */}
      {showHardDeleteDialog && (
        <AlertDialog open={showHardDeleteDialog} onOpenChange={setShowHardDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="text-destructive">{t('dialogs.hardDeleteTitle')}</AlertDialogTitle>
              <AlertDialogDescription className="space-y-2">
                <span className="block">{t('dialogs.hardDeleteDesc', { firstName: memberDetails.firstName, lastName: memberDetails.lastName })}</span>
                <span className="block font-semibold text-destructive">{t('dialogs.hardDeleteWarning')}</span>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('dialogs.removeCancel')}</AlertDialogCancel>
              <AlertDialogAction onClick={() => { hardDeleteMutation.mutate(); setShowHardDeleteDialog(false) }} disabled={hardDeleteMutation.isPending} className="bg-destructive hover:bg-destructive/90">
                {hardDeleteMutation.isPending ? t('dialogs.hardDeleting') : t('dialogs.hardDeleteConfirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      )}
    </div>
  )
}
