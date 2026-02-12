import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, ChevronRight, Loader2, Megaphone, MousePointerClick, BarChart3, Trash2 } from 'lucide-react'
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useToast } from '@/hooks/use-toast'
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
  ANNOUNCEMENT: { label: 'Anuncio', icon: Megaphone, color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  SURVEY: { label: 'Encuesta', icon: BarChart3, color: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' },
  ACTION: { label: 'Accion', icon: MousePointerClick, color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
}

const PRIORITY_CONFIG = {
  LOW: { label: 'Baja', color: 'bg-muted text-muted-foreground' },
  NORMAL: { label: 'Normal', color: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' },
  HIGH: { label: 'Alta', color: 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400' },
  URGENT: { label: 'Urgente', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

const STATUS_CONFIG = {
  ACTIVE: { label: 'Activo', color: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  EXPIRED: { label: 'Expirado', color: 'bg-muted text-muted-foreground' },
  CANCELLED: { label: 'Cancelado', color: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400' },
}

export function TpvMessagesList({ venueId }: TpvMessagesListProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [cancelDialogId, setCancelDialogId] = useState<string | null>(null)

  const { data: messagesData, isLoading } = useQuery({
    queryKey: ['tpv-messages', venueId, statusFilter, typeFilter],
    queryFn: () =>
      getTpvMessages(venueId, {
        status: statusFilter !== 'all' ? statusFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        limit: 50,
      }),
    enabled: Boolean(venueId),
  })

  const messages: TpvMessage[] = messagesData?.data || messagesData || []

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Filters */}
        <div className="flex gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Estado" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ACTIVE">Activos</SelectItem>
              <SelectItem value="EXPIRED">Expirados</SelectItem>
              <SelectItem value="CANCELLED">Cancelados</SelectItem>
            </SelectContent>
          </Select>

          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="ANNOUNCEMENT">Anuncios</SelectItem>
              <SelectItem value="SURVEY">Encuestas</SelectItem>
              <SelectItem value="ACTION">Acciones</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Messages List */}
        {messages.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <Megaphone className="w-10 h-10 text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No hay mensajes</p>
              <p className="text-xs text-muted-foreground mt-1">Crea uno nuevo con el boton de arriba</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => {
              const typeConfig = TYPE_CONFIG[message.type]
              const priorityConfig = PRIORITY_CONFIG[message.priority]
              const statusConfig = STATUS_CONFIG[message.status]
              const stats = getDeliveryStats(message)
              const isExpanded = expandedId === message.id
              const TypeIcon = typeConfig.icon

              return (
                <Card key={message.id} className="overflow-hidden">
                  <div
                    className="p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                    onClick={() => setExpandedId(isExpanded ? null : message.id)}
                  >
                    <div className="flex items-start gap-3">
                      {/* Type Icon */}
                      <div className={`p-2 rounded-lg ${typeConfig.color}`}>
                        <TypeIcon className="w-4 h-4" />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-medium truncate">{message.title}</h4>
                          <Badge variant="outline" className={`text-xs ${statusConfig.color} border-transparent`}>
                            {statusConfig.label}
                          </Badge>
                          <Badge variant="outline" className={`text-xs ${priorityConfig.color} border-transparent`}>
                            {priorityConfig.label}
                          </Badge>
                        </div>

                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{message.body}</p>

                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>
                            {DateTime.fromISO(message.createdAt).toRelative()}
                          </span>
                          <span>Por: {message.createdByName}</span>
                          {stats.total > 0 && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">
                                  {stats.acknowledged}/{stats.total} confirmados
                                </span>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Entregados: {stats.delivered}/{stats.total}</p>
                                <p>Confirmados: {stats.acknowledged}</p>
                                <p>Descartados: {stats.dismissed}</p>
                              </TooltipContent>
                            </Tooltip>
                          )}
                          {message.targetType === 'SPECIFIC_TERMINALS' && (
                            <span>Terminales especificas ({message.targetTerminalIds.length})</span>
                          )}
                        </div>
                      </div>

                      {/* Expand Arrow + Cancel Button */}
                      <div className="flex items-center gap-2">
                        {message.status === 'ACTIVE' && (
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  setCancelDialogId(message.id)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Cancelar mensaje</TooltipContent>
                          </Tooltip>
                        )}
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail */}
                  {isExpanded && (
                    <div className="border-t border-border p-4 bg-muted/20 space-y-4">
                      {/* Full body */}
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Mensaje completo</p>
                        <p className="text-sm whitespace-pre-wrap">{message.body}</p>
                      </div>

                      {/* Delivery Status Table */}
                      {message.deliveries && message.deliveries.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Estado de entrega</p>
                          <div className="rounded-lg border border-border overflow-hidden">
                            <table className="w-full text-sm">
                              <thead className="bg-muted/50">
                                <tr>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Terminal</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Estado</th>
                                  <th className="text-left px-3 py-2 text-xs font-medium text-muted-foreground">Confirmado por</th>
                                </tr>
                              </thead>
                              <tbody>
                                {message.deliveries.map((delivery) => (
                                  <tr key={delivery.id} className="border-t border-border">
                                    <td className="px-3 py-2 text-sm">
                                      {delivery.terminal?.name || delivery.terminalId.slice(-8)}
                                    </td>
                                    <td className="px-3 py-2">
                                      <Badge
                                        variant="outline"
                                        className={`text-xs border-transparent ${
                                          delivery.status === 'ACKNOWLEDGED'
                                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                            : delivery.status === 'DISMISSED'
                                              ? 'bg-muted text-muted-foreground'
                                              : delivery.status === 'DELIVERED'
                                                ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
                                                : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                                        }`}
                                      >
                                        {delivery.status === 'ACKNOWLEDGED'
                                          ? 'Confirmado'
                                          : delivery.status === 'DISMISSED'
                                            ? 'Descartado'
                                            : delivery.status === 'DELIVERED'
                                              ? 'Entregado'
                                              : 'Pendiente'}
                                      </Badge>
                                    </td>
                                    <td className="px-3 py-2 text-xs text-muted-foreground">
                                      {delivery.acknowledgedBy || '-'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {/* Survey Responses */}
                      {message.type === 'SURVEY' && responsesData && responsesData.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">
                            Respuestas de encuesta ({responsesData.length})
                          </p>
                          <div className="space-y-2">
                            {responsesData.map((response) => (
                              <div key={response.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm">{response.terminal?.name || response.terminalId.slice(-8)}</span>
                                  {response.respondedByName && (
                                    <span className="text-xs text-muted-foreground">({response.respondedByName})</span>
                                  )}
                                </div>
                                <div className="flex gap-1 flex-wrap justify-end">
                                  {response.selectedOptions.map((opt, i) => (
                                    <Badge key={i} variant="secondary" className="text-xs">
                                      {opt}
                                    </Badge>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Metadata */}
                      <div className="flex gap-4 text-xs text-muted-foreground pt-2 border-t border-border">
                        {message.expiresAt && (
                          <span>Expira: {DateTime.fromISO(message.expiresAt).toRelative()}</span>
                        )}
                        <span>Requiere confirmacion: {message.requiresAck ? 'Si' : 'No'}</span>
                        {message._count?.responses != null && message._count.responses > 0 && (
                          <span>Respuestas: {message._count.responses}</span>
                        )}
                      </div>
                    </div>
                  )}
                </Card>
              )
            })}
          </div>
        )}

        {/* Cancel Confirmation Dialog */}
        <AlertDialog open={!!cancelDialogId} onOpenChange={() => setCancelDialogId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancelar mensaje</AlertDialogTitle>
              <AlertDialogDescription>
                El mensaje sera cancelado y removido de todas las terminales que aun no lo hayan visto.
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
                  'Cancelar mensaje'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}
