/**
 * Campaign Detail Page
 *
 * View campaign details, stats, and delivery log.
 * Shows open/click rates and allows cancelling sending campaigns.
 *
 * Design: FullScreenModal Pattern (Rule 15) + Modern Dashboard Design System
 */

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Progress } from '@/components/ui/progress'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import * as marketingService from '@/services/superadmin-marketing.service'
import type { CampaignStatus, DeliveryStatus } from '@/services/superadmin-marketing.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileText,
  Loader2,
  Mail,
  MailOpen,
  MousePointerClick,
  Pencil,
  RefreshCw,
  Send,
  StopCircle,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
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
import { useEffect, useState } from 'react'

// ============================================================================
// DESIGN SYSTEM COMPONENTS
// ============================================================================

const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
}> = ({ children, className }) => (
  <div
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      className,
    )}
  >
    {children}
  </div>
)

const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-muted-foreground',
  }
  return (
    <span className="relative flex h-3 w-3">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}

type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'red'

const ACCENT_COLORS: Record<AccentColor, string> = {
  green: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
  blue: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
  purple: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
  orange: 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400',
  red: 'from-red-500/20 to-red-500/5 text-red-600 dark:text-red-400',
}

const MetricCard: React.FC<{
  label: string
  value: string | number
  subValue?: string
  icon: React.ReactNode
  accent?: AccentColor
}> = ({ label, value, subValue, icon, accent = 'blue' }) => (
  <GlassCard className="p-4 h-full">
    <div className="flex items-start justify-between">
      <div className={cn('p-2 rounded-xl bg-gradient-to-br', ACCENT_COLORS[accent])}>{icon}</div>
    </div>
    <div className="mt-3">
      <p className="text-2xl font-bold tracking-tight">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
      {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
    </div>
  </GlassCard>
)

// ============================================================================
// STATUS CONFIG
// ============================================================================

const STATUS_CONFIG: Record<
  CampaignStatus,
  { label: string; pulseStatus: 'success' | 'warning' | 'error' | 'neutral'; icon: any }
> = {
  DRAFT: { label: 'Borrador', pulseStatus: 'neutral', icon: FileText },
  SCHEDULED: { label: 'Programada', pulseStatus: 'warning', icon: Clock },
  SENDING: { label: 'Enviando', pulseStatus: 'warning', icon: Send },
  COMPLETED: { label: 'Completada', pulseStatus: 'success', icon: CheckCircle2 },
  FAILED: { label: 'Fallida', pulseStatus: 'error', icon: XCircle },
  CANCELLED: { label: 'Cancelada', pulseStatus: 'neutral', icon: X },
}

const DELIVERY_STATUS_CONFIG: Record<DeliveryStatus, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  PENDING: { label: 'Pendiente', variant: 'outline' },
  SENT: { label: 'Enviado', variant: 'default' },
  FAILED: { label: 'Fallido', variant: 'destructive' },
  BOUNCED: { label: 'Rebotado', variant: 'destructive' },
}

// ============================================================================
// TABS CONFIG (URL Hash-Based)
// ============================================================================

const VALID_TABS = ['details', 'deliveries', 'preview'] as const
type TabValue = (typeof VALID_TABS)[number]

// ============================================================================
// MAIN COMPONENT
// ============================================================================

function CampaignDetail() {
  const navigate = useNavigate()
  const location = useLocation()
  const { campaignId } = useParams()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false)
  const [sendDialogOpen, setSendDialogOpen] = useState(false)

  // URL hash-based tabs
  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '')
    return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'details'
  }

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

  useEffect(() => {
    const tabFromHash = getTabFromHash()
    if (tabFromHash !== activeTab) {
      setActiveTab(tabFromHash)
    }
  }, [location.hash])

  const handleTabChange = (value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    navigate(`${location.pathname}#${tab}`, { replace: true })
  }

  // Fetch campaign
  const {
    data: campaign,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['marketing-campaign', campaignId],
    queryFn: () => marketingService.getCampaign(campaignId!),
    enabled: !!campaignId,
    refetchInterval: query => (query.state.data?.status === 'SENDING' ? 10000 : false),
  })

  // Fetch deliveries
  const { data: deliveriesData } = useQuery({
    queryKey: ['campaign-deliveries', campaignId],
    queryFn: () => marketingService.getCampaignDeliveries(campaignId!, { limit: 100 }),
    enabled: !!campaignId,
    refetchInterval: campaign?.status === 'SENDING' ? 10000 : false,
  })

  // Cancel campaign mutation
  const cancelMutation = useMutation({
    mutationFn: () => marketingService.cancelCampaign(campaignId!),
    onSuccess: () => {
      toast({ title: 'Campaña cancelada', description: 'El envío de la campaña ha sido detenido.' })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-deliveries', campaignId] })
      setCancelDialogOpen(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo cancelar la campaña', variant: 'destructive' })
    },
  })

  // Send campaign mutation
  const sendMutation = useMutation({
    mutationFn: () => marketingService.sendCampaign(campaignId!),
    onSuccess: data => {
      toast({
        title: 'Campaña iniciada',
        description: `Se enviarán ${data.totalRecipients} emails. El proceso puede tomar varios minutos.`,
      })
      queryClient.invalidateQueries({ queryKey: ['marketing-campaign', campaignId] })
      queryClient.invalidateQueries({ queryKey: ['campaign-deliveries', campaignId] })
      setSendDialogOpen(false)
    },
    onError: () => {
      toast({ title: 'Error', description: 'No se pudo iniciar la campaña', variant: 'destructive' })
    },
  })

  const goBack = () => navigate('/superadmin/marketing')

  // Compute values (safe defaults when campaign not loaded yet)
  const statusConfig = campaign ? STATUS_CONFIG[campaign.status] : null
  const progress = campaign && campaign.totalRecipients > 0 ? (campaign.sentCount / campaign.totalRecipients) * 100 : 0
  const openRate = campaign && campaign.sentCount > 0 ? ((campaign.openedCount / campaign.sentCount) * 100).toFixed(1) : '0.0'
  const clickRate = campaign && campaign.sentCount > 0 ? ((campaign.clickedCount / campaign.sentCount) * 100).toFixed(1) : '0.0'

  return (
    <>
      <FullScreenModal
        open={true}
        onClose={goBack}
        title={campaign?.name || 'Campaña'}
        contentClassName="bg-muted/30"
        actions={
          campaign ? (
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="rounded-full cursor-pointer"
                onClick={() => refetch()}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refrescar
              </Button>
              {campaign.status === 'DRAFT' && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full cursor-pointer"
                    onClick={() => navigate(`/superadmin/marketing/${campaignId}/edit`)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Editar
                  </Button>
                  <Button
                    size="sm"
                    className="rounded-full cursor-pointer"
                    onClick={() => setSendDialogOpen(true)}
                    disabled={sendMutation.isPending}
                  >
                    {sendMutation.isPending ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Enviar
                  </Button>
                </>
              )}
              {campaign.status === 'SENDING' && (
                <Button
                  variant="destructive"
                  size="sm"
                  className="rounded-full cursor-pointer"
                  onClick={() => setCancelDialogOpen(true)}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <StopCircle className="h-4 w-4 mr-2" />
                  )}
                  Cancelar envío
                </Button>
              )}
            </div>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-96">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !campaign ? (
          <div className="flex flex-col items-center justify-center h-96 gap-4">
            <p className="text-muted-foreground">Campaña no encontrada</p>
          </div>
        ) : (
          <div className="max-w-7xl mx-auto px-6 py-8 space-y-6">
            {/* Status + Subject header */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-card border border-border/50">
                <StatusPulse status={statusConfig!.pulseStatus} />
                <span className="text-sm font-medium">{statusConfig!.label}</span>
              </div>
              <p className="text-sm text-muted-foreground">{campaign.subject}</p>
            </div>

            {/* Progress (for sending campaigns) */}
            {campaign.status === 'SENDING' && (
              <GlassCard className="p-4 border-blue-500/30 bg-blue-500/5">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-600 dark:text-blue-400" />
                      </div>
                      <span className="font-medium text-sm">Enviando emails...</span>
                    </div>
                    <span className="text-sm text-muted-foreground font-medium">
                      {campaign.sentCount} / {campaign.totalRecipients}
                    </span>
                  </div>
                  <Progress value={progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    El envío se procesa en lotes de 50 emails cada 5 minutos para evitar límites de Resend.
                  </p>
                </div>
              </GlassCard>
            )}

            {/* Metric Cards - Bento Grid */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-5">
              <MetricCard
                label="Destinatarios"
                value={campaign.totalRecipients}
                icon={<Users className="w-4 h-4" />}
                accent="blue"
              />
              <MetricCard
                label="Enviados"
                value={campaign.sentCount}
                subValue={`${progress.toFixed(0)}% completado`}
                icon={<Mail className="w-4 h-4" />}
                accent="blue"
              />
              <MetricCard
                label="Abiertos"
                value={campaign.openedCount}
                subValue={`${openRate}% open rate`}
                icon={<MailOpen className="w-4 h-4" />}
                accent="green"
              />
              <MetricCard
                label="Clicks"
                value={campaign.clickedCount}
                subValue={`${clickRate}% click rate`}
                icon={<MousePointerClick className="w-4 h-4" />}
                accent="purple"
              />
              <MetricCard
                label="Fallidos"
                value={campaign.failedCount}
                icon={<AlertTriangle className="w-4 h-4" />}
                accent="red"
              />
            </div>

            {/* Tabs: Details, Deliveries, Preview — Pill-Style + URL Hash */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-card px-1 py-1 text-muted-foreground border border-border/50">
                <TabsTrigger
                  value="details"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  Detalles
                </TabsTrigger>
                <TabsTrigger
                  value="deliveries"
                  className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  <span>Entregas</span>
                  <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
                    {deliveriesData?.total || 0}
                  </span>
                </TabsTrigger>
                <TabsTrigger
                  value="preview"
                  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground cursor-pointer"
                >
                  Vista previa
                </TabsTrigger>
              </TabsList>

              {/* Details Tab */}
              <TabsContent value="details" className="mt-4">
                <GlassCard className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                      <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Información de la campaña</h3>
                      <p className="text-xs text-muted-foreground">Detalles de configuración y envío</p>
                    </div>
                  </div>

                  <div className="h-px bg-border/50 mb-6" />

                  <div className="grid gap-6 md:grid-cols-2">
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Creada</p>
                      <p className="text-sm font-medium">
                        {DateTime.fromISO(campaign.createdAt).toLocaleString(DateTime.DATETIME_MED)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Creada por</p>
                      <p className="text-sm font-medium">
                        {campaign.creator.firstName} {campaign.creator.lastName}
                      </p>
                    </div>
                    {campaign.startedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Iniciada</p>
                        <p className="text-sm font-medium">
                          {DateTime.fromISO(campaign.startedAt).toLocaleString(DateTime.DATETIME_MED)}
                        </p>
                      </div>
                    )}
                    {campaign.completedAt && (
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Completada</p>
                        <p className="text-sm font-medium">
                          {DateTime.fromISO(campaign.completedAt).toLocaleString(DateTime.DATETIME_MED)}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="h-px bg-border/50 my-6" />

                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider mb-3">Targeting</p>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline" className="rounded-full">
                        {campaign.targetAllVenues ? 'Todos los venues' : `${campaign.targetVenueIds.length} venues`}
                      </Badge>
                      {campaign.includeStaff && (
                        <Badge variant="outline" className="rounded-full">
                          Staff: {campaign.targetStaffRoles.join(', ')}
                        </Badge>
                      )}
                    </div>
                  </div>
                </GlassCard>
              </TabsContent>

              {/* Deliveries Tab */}
              <TabsContent value="deliveries" className="mt-4">
                <GlassCard className="overflow-hidden">
                  <div className="p-6 pb-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                        <Mail className="w-4 h-4 text-green-600 dark:text-green-400" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-sm">Log de entregas</h3>
                        <p className="text-xs text-muted-foreground">Estado de cada email enviado</p>
                      </div>
                    </div>
                  </div>

                  {!deliveriesData?.deliveries.length ? (
                    <div className="px-6 pb-6">
                      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                        <Mail className="h-8 w-8 mb-3 opacity-40" />
                        <p className="text-sm">No hay entregas registradas</p>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 pb-6">
                      <div className="rounded-xl border border-border/50 overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow className="hover:bg-transparent">
                              <TableHead className="text-xs uppercase tracking-wider">Email</TableHead>
                              <TableHead className="text-xs uppercase tracking-wider">Tipo</TableHead>
                              <TableHead className="text-xs uppercase tracking-wider">Estado</TableHead>
                              <TableHead className="text-xs uppercase tracking-wider">Enviado</TableHead>
                              <TableHead className="text-xs uppercase tracking-wider">Abierto</TableHead>
                              <TableHead className="text-xs uppercase tracking-wider">Click</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {deliveriesData.deliveries.map(delivery => {
                              const dStatusConfig = DELIVERY_STATUS_CONFIG[delivery.status]
                              return (
                                <TableRow key={delivery.id}>
                                  <TableCell>
                                    <div>
                                      <p className="font-medium text-sm">{delivery.recipientEmail}</p>
                                      {delivery.venueName && (
                                        <p className="text-xs text-muted-foreground">{delivery.venueName}</p>
                                      )}
                                    </div>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant="outline" className="rounded-full text-xs">
                                      {delivery.isStaff ? 'Staff' : 'Venue'}
                                    </Badge>
                                  </TableCell>
                                  <TableCell>
                                    <Badge variant={dStatusConfig.variant} className="rounded-full text-xs">
                                      {dStatusConfig.label}
                                    </Badge>
                                    {delivery.error && (
                                      <p className="text-xs text-red-500 mt-1">{delivery.error}</p>
                                    )}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {delivery.sentAt
                                      ? DateTime.fromISO(delivery.sentAt).toRelative({ locale: 'es' })
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {delivery.openedAt
                                      ? DateTime.fromISO(delivery.openedAt).toRelative({ locale: 'es' })
                                      : '-'}
                                  </TableCell>
                                  <TableCell className="text-xs text-muted-foreground">
                                    {delivery.clickedAt
                                      ? DateTime.fromISO(delivery.clickedAt).toRelative({ locale: 'es' })
                                      : '-'}
                                  </TableCell>
                                </TableRow>
                              )
                            })}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}
                </GlassCard>
              </TabsContent>

              {/* Preview Tab */}
              <TabsContent value="preview" className="mt-4">
                <GlassCard className="p-6">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                      <MailOpen className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-sm">Vista previa del email</h3>
                      <p className="text-xs text-muted-foreground">Así se verá el email en la bandeja de entrada</p>
                    </div>
                  </div>

                  <div className="h-px bg-border/50 mb-6" />

                  <div className="rounded-xl border border-border/50 overflow-hidden">
                    {/* Email header simulation */}
                    <div className="bg-muted/30 p-4 border-b border-border/50">
                      <p className="text-sm text-muted-foreground">De: Avoqado &lt;noreply@avoqado.io&gt;</p>
                      <p className="text-sm text-muted-foreground">Para: [destinatario]</p>
                      <p className="font-medium mt-2">{campaign.subject}</p>
                    </div>
                    {/* Email body */}
                    <div
                      className="p-4 bg-background prose prose-sm max-w-none dark:prose-invert"
                      dangerouslySetInnerHTML={{ __html: campaign.bodyHtml }}
                    />
                  </div>
                </GlassCard>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </FullScreenModal>

      {/* Cancel Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Cancelar envío?</AlertDialogTitle>
            <AlertDialogDescription>
              Los emails pendientes no serán enviados. Los emails ya enviados no se verán afectados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Continuar enviando</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelMutation.mutate()}
              className="bg-destructive text-destructive-foreground rounded-full cursor-pointer"
            >
              Cancelar envío
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Send Confirmation Dialog */}
      <AlertDialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Enviar campaña?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción enviará emails a todos los destinatarios configurados. El proceso puede tomar varios minutos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => sendMutation.mutate()} className="rounded-full cursor-pointer">
              <Send className="h-4 w-4 mr-2" />
              Enviar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export default CampaignDetail
