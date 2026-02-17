import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  Megaphone,
  MousePointerClick,
  BarChart3,
  XCircle,
  Send,
  CheckCircle2,
  Clock,
  Eye,
  Ban,
  MessageSquare,
} from 'lucide-react'
import { DateTime } from 'luxon'

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
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
import { CheckboxFilterContent, DateFilterContent, FilterPill, type DateFilter } from '@/components/filters'
import {
  cancelTpvMessage,
  getTpvMessages,
  getTpvMessageResponses,
  type TpvMessage,
  type TpvMessageResponse,
} from '@/services/tpv-messages.service'

interface TpvMessagesListProps {
  venueId: string
}

const TYPE_CONFIG = {
  ANNOUNCEMENT: {
    label: 'Anuncio',
    icon: Megaphone,
    borderColor: 'border-l-blue-500',
    bgColor: 'bg-blue-500/10',
    textColor: 'text-blue-600 dark:text-blue-400',
    badgeBg: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400',
  },
  SURVEY: {
    label: 'Encuesta',
    icon: BarChart3,
    borderColor: 'border-l-purple-500',
    bgColor: 'bg-purple-500/10',
    textColor: 'text-purple-600 dark:text-purple-400',
    badgeBg: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400',
  },
  ACTION: {
    label: 'Accion',
    icon: MousePointerClick,
    borderColor: 'border-l-emerald-500',
    bgColor: 'bg-emerald-500/10',
    textColor: 'text-emerald-600 dark:text-emerald-400',
    badgeBg: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400',
  },
}

const PRIORITY_CONFIG = {
  LOW: { label: 'Baja', color: 'bg-muted text-muted-foreground' },
  NORMAL: { label: 'Normal', color: 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400' },
  HIGH: { label: 'Alta', color: 'bg-orange-100 text-orange-600 dark:bg-orange-500/20 dark:text-orange-400' },
  URGENT: { label: 'Urgente', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' },
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400', dotColor: 'bg-green-500' },
  EXPIRED: { label: 'Expirado', color: 'bg-muted text-muted-foreground', dotColor: 'bg-muted-foreground' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400', dotColor: 'bg-red-500' },
}

const DELIVERY_STATUS_CONFIG: Record<string, { label: string; icon: typeof CheckCircle2; color: string }> = {
  ACKNOWLEDGED: { label: 'Confirmado', icon: CheckCircle2, color: 'text-green-600 dark:text-green-400' },
  DISMISSED: { label: 'Descartado', icon: Eye, color: 'text-muted-foreground' },
  DELIVERED: { label: 'Entregado', icon: Send, color: 'text-blue-600 dark:text-blue-400' },
  PENDING: { label: 'Pendiente', icon: Clock, color: 'text-yellow-600 dark:text-yellow-400' },
}

const PAGE_SIZE = 5

export function TpvMessagesList({ venueId }: TpvMessagesListProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState<string[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cancelDialogId, setCancelDialogId] = useState<string | null>(null)
  const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE)

  // Build API params from filter arrays (API only supports single value)
  const apiStatus = statusFilter.length === 1 ? statusFilter[0] : undefined
  const apiType = typeFilter.length === 1 ? typeFilter[0] : undefined

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['tpv-messages', venueId, apiStatus, apiType],
    queryFn: () =>
      getTpvMessages(venueId, {
        status: apiStatus,
        type: apiType,
        limit: 200,
      }),
    enabled: Boolean(venueId),
  })

  // Client-side filtering for multi-select and date
  const allMessages: TpvMessage[] = useMemo(() => {
    let msgs: TpvMessage[] = messagesData?.data || messagesData || []

    // Multi-select: if API only sent one, client filters the rest
    if (statusFilter.length > 1) {
      msgs = msgs.filter((m) => statusFilter.includes(m.status))
    }
    if (typeFilter.length > 1) {
      msgs = msgs.filter((m) => typeFilter.includes(m.type))
    }

    // Date filter (client-side)
    if (dateFilter) {
      const now = DateTime.now()
      msgs = msgs.filter((m) => {
        const created = DateTime.fromISO(m.createdAt)
        switch (dateFilter.operator) {
          case 'last': {
            const amount = typeof dateFilter.value === 'number' ? dateFilter.value : parseInt(String(dateFilter.value) || '0')
            const unit = dateFilter.unit || 'days'
            return created >= now.minus({ [unit]: amount })
          }
          case 'before':
            return created < DateTime.fromISO(String(dateFilter.value))
          case 'after':
            return created > DateTime.fromISO(String(dateFilter.value))
          case 'on':
            return created.toISODate() === String(dateFilter.value)
          case 'between':
            return created >= DateTime.fromISO(String(dateFilter.value)) && created <= DateTime.fromISO(String(dateFilter.value2))
          default:
            return true
        }
      })
    }

    return msgs
  }, [messagesData, statusFilter, typeFilter, dateFilter])

  const messages = allMessages.slice(0, displayLimit)
  const hasMore = displayLimit < allMessages.length

  // Reset pagination when filters change
  const handleStatusFilter = (values: string[]) => {
    setStatusFilter(values)
    setDisplayLimit(PAGE_SIZE)
  }
  const handleTypeFilter = (values: string[]) => {
    setTypeFilter(values)
    setDisplayLimit(PAGE_SIZE)
  }
  const handleDateFilter = (filter: DateFilter | null) => {
    setDateFilter(filter)
    setDisplayLimit(PAGE_SIZE)
  }

  // Filter display labels
  const statusActiveLabel = statusFilter.length > 0
    ? statusFilter.map((s) => STATUS_CONFIG[s as keyof typeof STATUS_CONFIG]?.label || s).join(', ')
    : null
  const typeActiveLabel = typeFilter.length > 0
    ? typeFilter.map((t) => TYPE_CONFIG[t as keyof typeof TYPE_CONFIG]?.label || t).join(', ')
    : null
  const dateActiveLabel = dateFilter
    ? dateFilter.operator === 'last'
      ? `Últimos ${dateFilter.value} ${dateFilter.unit === 'hours' ? 'h' : dateFilter.unit === 'days' ? 'd' : dateFilter.unit === 'weeks' ? 'sem' : 'mes'}`
      : dateFilter.operator === 'on'
        ? String(dateFilter.value)
        : dateFilter.operator
    : null

  // Fetch responses for expanded survey message
  const { data: responsesData } = useQuery<TpvMessageResponse[]>({
    queryKey: ['tpv-message-responses', venueId, expandedId],
    queryFn: () => getTpvMessageResponses(venueId, expandedId!),
    enabled: Boolean(expandedId) && messages.find((m) => m.id === expandedId)?.type === 'SURVEY',
  })

  const cancelMutation = useMutation({
    mutationFn: (messageId: string) => cancelTpvMessage(venueId, messageId),
    onSuccess: () => {
      toast({ title: 'Mensaje cancelado' })
      queryClient.invalidateQueries({ queryKey: ['tpv-messages', venueId] })
      setCancelDialogId(null)
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo cancelar el mensaje',
      })
    },
  })

  const getDeliveryStats = (message: TpvMessage) => {
    const deliveries = message.deliveries || []
    const total = deliveries.length
    const delivered = deliveries.filter((d) => d.status !== 'PENDING').length
    const acknowledged = deliveries.filter((d) => d.status === 'ACKNOWLEDGED').length
    const dismissed = deliveries.filter((d) => d.status === 'DISMISSED').length
    return { total, delivered, acknowledged, dismissed }
  }

  // Summary stats (computed from ALL messages, not just visible page)
  const summaryStats = useMemo(() => {
    if (!allMessages.length) return null
    const active = allMessages.filter((m) => m.status === 'ACTIVE').length
    let totalDeliveries = 0
    let totalAcknowledged = 0
    let totalDismissed = 0
    allMessages.forEach((m) => {
      const stats = getDeliveryStats(m)
      totalDeliveries += stats.total
      totalAcknowledged += stats.acknowledged
      totalDismissed += stats.dismissed
    })
    const readRate = totalDeliveries > 0 ? Math.round(((totalAcknowledged + totalDismissed) / totalDeliveries) * 100) : 0
    const confirmRate = totalDeliveries > 0 ? Math.round((totalAcknowledged / totalDeliveries) * 100) : 0
    return { total: allMessages.length, active, totalDeliveries, totalAcknowledged, readRate, confirmRate }
  }, [allMessages])

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3 animate-pulse">
                <div className="w-10 h-10 rounded-lg bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-72 rounded bg-muted" />
                  <div className="h-3 w-32 rounded bg-muted" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Summary Stats */}
        {summaryStats && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              label="Total"
              value={summaryStats.total}
              icon={MessageSquare}
              color="text-foreground"
            />
            <SummaryCard
              label="Activos"
              value={summaryStats.active}
              icon={Send}
              color="text-green-600 dark:text-green-400"
            />
            <SummaryCard
              label="Tasa de lectura"
              value={`${summaryStats.readRate}%`}
              icon={Eye}
              color="text-blue-600 dark:text-blue-400"
            />
            <SummaryCard
              label="Tasa de confirmacion"
              value={`${summaryStats.confirmRate}%`}
              icon={CheckCircle2}
              color="text-emerald-600 dark:text-emerald-400"
            />
          </div>
        )}

        {/* Filters — Stripe-style FilterPills */}
        <div className="flex items-center gap-2 flex-wrap">
          <FilterPill
            label="Estado"
            activeLabel={statusActiveLabel}
            onClear={() => handleStatusFilter([])}
          >
            <CheckboxFilterContent
              title="Filtrar por estado"
              options={[
                { value: 'ACTIVE', label: 'Activo' },
                { value: 'EXPIRED', label: 'Expirado' },
                { value: 'CANCELLED', label: 'Cancelado' },
              ]}
              selectedValues={statusFilter}
              onApply={handleStatusFilter}
            />
          </FilterPill>

          <FilterPill
            label="Tipo"
            activeLabel={typeActiveLabel}
            onClear={() => handleTypeFilter([])}
          >
            <CheckboxFilterContent
              title="Filtrar por tipo"
              options={[
                { value: 'ANNOUNCEMENT', label: 'Anuncio' },
                { value: 'SURVEY', label: 'Encuesta' },
                { value: 'ACTION', label: 'Accion' },
              ]}
              selectedValues={typeFilter}
              onApply={handleTypeFilter}
            />
          </FilterPill>

          <FilterPill
            label="Fecha"
            activeLabel={dateActiveLabel}
            onClear={() => handleDateFilter(null)}
          >
            <DateFilterContent
              title="Filtrar por fecha"
              value={dateFilter}
              onApply={handleDateFilter}
            />
          </FilterPill>
        </div>

        {/* Messages List */}
        {allMessages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Megaphone className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium">No hay mensajes</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-[280px]">
                Envia anuncios, encuestas o acciones a tus terminales con el boton "Nuevo mensaje"
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {messages.map((message) => {
              const typeConfig = TYPE_CONFIG[message.type]
              const priorityConfig = PRIORITY_CONFIG[message.priority]
              const statusConfig = STATUS_CONFIG[message.status]
              const stats = getDeliveryStats(message)
              const isExpanded = expandedId === message.id
              const TypeIcon = typeConfig.icon
              const deliveryPercent = stats.total > 0 ? Math.round(((stats.acknowledged + stats.dismissed) / stats.total) * 100) : 0

              return (
                <Card
                  key={message.id}
                  className={`overflow-hidden border-l-[3px] ${typeConfig.borderColor} transition-shadow hover:shadow-md`}
                >
                  <div
                    className="p-4 cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => setExpandedId(isExpanded ? null : message.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <div className={`p-2.5 rounded-xl ${typeConfig.bgColor} shrink-0`}>
                        <TypeIcon className={`w-4 h-4 ${typeConfig.textColor}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Title row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-semibold truncate">{message.title}</h4>
                          <div className="flex items-center gap-1.5">
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border-transparent ${statusConfig.color}`}>
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${statusConfig.dotColor} mr-1`} />
                              {statusConfig.label}
                            </Badge>
                            {message.priority !== 'NORMAL' && (
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 h-5 border-transparent ${priorityConfig.color}`}>
                                {priorityConfig.label}
                              </Badge>
                            )}
                          </div>
                        </div>

                        {/* Body preview */}
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{message.body}</p>

                        {/* Meta row + delivery progress */}
                        <div className="flex items-center gap-3 mt-2.5">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span>{DateTime.fromISO(message.createdAt).toRelative()}</span>
                            <span className="hidden sm:inline">
                              {message.createdByName}
                            </span>
                          </div>

                          {/* Delivery progress inline */}
                          {stats.total > 0 && (
                            <div className="flex items-center gap-2 ml-auto">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <div className="flex items-center gap-2 cursor-help">
                                    <div className="w-20 sm:w-28">
                                      <Progress
                                        value={deliveryPercent}
                                        className="h-1.5"
                                      />
                                    </div>
                                    <span className="text-xs font-medium tabular-nums whitespace-nowrap">
                                      {stats.acknowledged}/{stats.total}
                                    </span>
                                  </div>
                                </TooltipTrigger>
                                <TooltipContent side="bottom">
                                  <div className="space-y-1 text-xs">
                                    <div className="flex justify-between gap-4">
                                      <span>Confirmados:</span>
                                      <span className="font-medium">{stats.acknowledged}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>Descartados:</span>
                                      <span className="font-medium">{stats.dismissed}</span>
                                    </div>
                                    <div className="flex justify-between gap-4">
                                      <span>Pendientes:</span>
                                      <span className="font-medium">{stats.total - stats.acknowledged - stats.dismissed}</span>
                                    </div>
                                  </div>
                                </TooltipContent>
                              </Tooltip>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        <div className="w-8 h-8">
                          {message.status === 'ACTIVE' && stats.total > 0 && stats.acknowledged + stats.dismissed < stats.total && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    setCancelDialogId(message.id)
                                  }}
                                >
                                  <XCircle className="w-4 h-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Cancelar mensaje</TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                        <div className="w-5 flex justify-center">
                          {isExpanded ? (
                            <ChevronDown className="w-4 h-4 text-muted-foreground transition-transform" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform" />
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border bg-muted/10">
                      {/* Full message body */}
                      <div className="px-4 pt-4 pb-3">
                        <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Mensaje completo</p>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.body}</p>
                      </div>

                      <Separator />

                      {/* Delivery Status */}
                      {message.deliveries && message.deliveries.length > 0 && (
                        <div className="px-4 pt-3 pb-3">
                          <div className="flex items-center justify-between mb-3">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                              Estado de entrega
                            </p>
                            <span className="text-xs text-muted-foreground">
                              {stats.acknowledged + stats.dismissed}/{stats.total} leidos
                            </span>
                          </div>

                          <div className="space-y-1.5">
                            {message.deliveries.map((delivery) => {
                              const dConfig = DELIVERY_STATUS_CONFIG[delivery.status] || DELIVERY_STATUS_CONFIG.PENDING
                              const DIcon = dConfig.icon

                              return (
                                <div
                                  key={delivery.id}
                                  className="flex items-center gap-3 px-3 py-2 rounded-lg bg-muted/40"
                                >
                                  <DIcon className={`w-4 h-4 shrink-0 ${dConfig.color}`} />
                                  <span className="text-sm flex-1 truncate">
                                    {delivery.terminal?.name || delivery.terminalId.slice(-8)}
                                  </span>
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] px-1.5 py-0 h-5 border-transparent ${
                                      delivery.status === 'ACKNOWLEDGED'
                                        ? 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400'
                                        : delivery.status === 'DISMISSED'
                                          ? 'bg-muted text-muted-foreground'
                                          : delivery.status === 'DELIVERED'
                                            ? 'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'
                                            : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/20 dark:text-yellow-400'
                                    }`}
                                  >
                                    {dConfig.label}
                                  </Badge>
                                  <span className="text-[11px] text-muted-foreground min-w-[60px] text-right">
                                    {delivery.acknowledgedAt
                                      ? DateTime.fromISO(delivery.acknowledgedAt).toRelative()
                                      : delivery.deliveredAt
                                        ? DateTime.fromISO(delivery.deliveredAt).toRelative()
                                        : '-'}
                                  </span>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}

                      {/* Survey Responses */}
                      {message.type === 'SURVEY' && responsesData && responsesData.length > 0 && (
                        <>
                          <Separator />
                          <div className="px-4 pt-3 pb-3">
                            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-3">
                              Respuestas ({responsesData.length})
                            </p>
                            <SurveyResultsChart
                              surveyOptions={(message as any).surveyOptions || []}
                              responses={responsesData}
                            />
                          </div>
                        </>
                      )}

                      <Separator />

                      {/* Metadata footer */}
                      <div className="px-4 py-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                        <span>
                          Creado: {DateTime.fromISO(message.createdAt).toFormat('dd/MM/yyyy HH:mm')}
                        </span>
                        {message.expiresAt && (
                          <span>
                            Expira: {DateTime.fromISO(message.expiresAt).toRelative()}
                          </span>
                        )}
                        <span>
                          Confirmacion: {message.requiresAck ? 'Requerida' : 'Opcional'}
                        </span>
                        {message.targetType === 'SPECIFIC_TERMINALS' && (
                          <span>Destino: {message.targetTerminalIds.length} terminales</span>
                        )}
                        {message.targetType === 'ALL_TERMINALS' && (
                          <span>Destino: Todas las terminales</span>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}

            {/* Load More / Counter */}
            {(hasMore || allMessages.length > PAGE_SIZE) && (
              <div className="flex items-center justify-between pt-2">
                <p className="text-xs text-muted-foreground">
                  Mostrando {messages.length} de {allMessages.length} mensajes
                </p>
                {hasMore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
                    className="text-xs"
                  >
                    Ver mas mensajes
                  </Button>
                )}
              </div>
            )}
          </div>
        )}

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={!!cancelDialogId} onOpenChange={() => setCancelDialogId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar mensaje</AlertDialogTitle>
              <AlertDialogDescription>
                El mensaje sera cancelado y removido de todas las terminales que aun no lo hayan visto.
                Las terminales que ya lo confirmaron o descartaron no se veran afectadas.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Volver</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => cancelDialogId && cancelMutation.mutate(cancelDialogId)}
                className="bg-destructive hover:bg-destructive/90"
                disabled={cancelMutation.isPending}
              >
                {cancelMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Cancelando...
                  </>
                ) : (
                  <>
                    <Ban className="w-4 h-4 mr-2" />
                    Cancelar mensaje
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

// ──────────────────────────────────────────
// Summary Card
// ──────────────────────────────────────────

function SummaryCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string
  value: string | number
  icon: typeof MessageSquare
  color: string
}) {
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-muted">
            <Icon className={`w-4 h-4 ${color}`} />
          </div>
          <div>
            <p className="text-lg font-bold tabular-nums leading-none">{value}</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

// ──────────────────────────────────────────
// Survey Results Chart (horizontal bar)
// ──────────────────────────────────────────

function SurveyResultsChart({
  surveyOptions,
  responses,
}: {
  surveyOptions: string[]
  responses: TpvMessageResponse[]
}) {
  // Count votes per option
  const voteCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    surveyOptions.forEach((opt) => {
      counts[opt] = 0
    })
    responses.forEach((r) => {
      r.selectedOptions.forEach((opt) => {
        if (counts[opt] !== undefined) counts[opt]++
      })
    })
    return counts
  }, [surveyOptions, responses])

  const maxVotes = Math.max(...Object.values(voteCounts), 1)

  return (
    <div className="space-y-2">
      {surveyOptions.map((option) => {
        const count = voteCounts[option] || 0
        const percent = Math.round((count / responses.length) * 100) || 0

        return (
          <div key={option} className="space-y-1">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium truncate mr-2">{option}</span>
              <span className="text-muted-foreground tabular-nums shrink-0">
                {count} {count === 1 ? 'voto' : 'votos'} ({percent}%)
              </span>
            </div>
            <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full rounded-full bg-purple-500 dark:bg-purple-400 transition-all duration-500"
                style={{ width: `${maxVotes > 0 ? (count / maxVotes) * 100 : 0}%` }}
              />
            </div>
          </div>
        )
      })}

      {/* Individual responses */}
      <div className="mt-3 pt-2 border-t border-border">
        <p className="text-[11px] text-muted-foreground mb-2">Respuestas individuales</p>
        <div className="space-y-1.5">
          {responses.map((response) => (
            <div key={response.id} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-xs font-medium truncate">
                  {response.terminal?.name || response.terminalId.slice(-8)}
                </span>
                {response.respondedByName && (
                  <span className="text-[11px] text-muted-foreground truncate">
                    ({response.respondedByName})
                  </span>
                )}
              </div>
              <div className="flex gap-1 flex-wrap justify-end shrink-0">
                {response.selectedOptions.map((opt, i) => (
                  <Badge key={i} variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                    {opt}
                  </Badge>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
