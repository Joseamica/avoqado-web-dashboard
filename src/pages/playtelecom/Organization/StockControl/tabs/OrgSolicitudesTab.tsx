import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { IccidBadge } from '../components/IccidBadge'
import { RejectRegistrationDialog } from '../components/RejectRegistrationDialog'
import { useSimRegistrationRequests, useApproveSimRegistration, type SimRegRequest } from '../hooks/useSimRegistrationRequests'
import { StockApprovalQueue } from '../components/StockApprovalQueue'

interface Props {
  orgId: string
}

function requestorName(req: SimRegRequest): string {
  const { requestedBy } = req
  if (!requestedBy) return 'Promotor'
  const first = requestedBy.firstName ?? ''
  const last = requestedBy.lastName ?? ''
  const full = `${first} ${last}`.trim()
  return full || 'Promotor'
}

function statusBadge(status: SimRegRequest['status']) {
  switch (status) {
    case 'APPROVED':
      return (
        <Badge variant="outline" className="text-xs bg-green-500/10 text-green-600 border-green-500/20">
          Aprobada
        </Badge>
      )
    case 'REJECTED':
      return (
        <Badge variant="outline" className="text-xs bg-red-500/10 text-red-600 border-red-500/20">
          Rechazada
        </Badge>
      )
    case 'PARTIAL':
      return (
        <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">
          Parcial
        </Badge>
      )
    default:
      return (
        <Badge variant="outline" className="text-xs bg-blue-500/10 text-blue-600 border-blue-500/20">
          Pendiente
        </Badge>
      )
  }
}

interface RequestRowProps {
  request: SimRegRequest
  orgId: string
  canAct: boolean
}

function RequestRow({ request, orgId, canAct }: RequestRowProps) {
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [rejectOpen, setRejectOpen] = useState(false)
  const approve = useApproveSimRegistration(orgId)

  const toggleItem = (serialNumber: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(serialNumber)) {
        next.delete(serialNumber)
      } else {
        next.add(serialNumber)
      }
      return next
    })
  }

  const selectedSerials = selected.size > 0 ? Array.from(selected) : undefined
  const hasCategory = !!request.proposedCategory

  const handleApprove = () => {
    if (!hasCategory) return
    approve.mutate({
      requestId: request.id,
      categoryId: request.proposedCategory!.id,
      serialNumbers: selectedSerials,
    })
  }

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {/* Summary row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 p-4">
        <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-1 text-sm">
          <div>
            <p className="text-xs text-muted-foreground">Promotor</p>
            <p className="font-medium truncate">{requestorName(request)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Sucursal</p>
            <p className="truncate">{request.registeredFromVenue?.name ?? 'Org'}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Categoría propuesta</p>
            <p className="truncate">{request.proposedCategory?.name ?? '—'}</p>
          </div>
          <div className="flex items-start gap-4">
            <div>
              <p className="text-xs text-muted-foreground">SIMs</p>
              <p className="font-semibold">{request.items.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Fecha</p>
              <p className="whitespace-nowrap">{new Date(request.createdAt).toLocaleDateString('es-MX')}</p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(request.status)}
          <button
            onClick={() => setExpanded(v => !v)}
            className="p-1 rounded hover:bg-muted/50 transition-colors text-muted-foreground"
            aria-label={expanded ? 'Colapsar' : 'Expandir'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded ICCID list */}
      {expanded && (
        <div className="border-t border-border/50 bg-muted/20 px-4 py-3 space-y-3">
          <div className="space-y-1.5">
            {request.items.map(item => (
              <div key={item.id} className="flex items-center gap-2">
                {canAct && (
                  <Checkbox
                    id={`sim-${item.id}`}
                    checked={selected.has(item.serialNumber)}
                    onCheckedChange={() => toggleItem(item.serialNumber)}
                  />
                )}
                <IccidBadge value={item.serialNumber} />
                {item.status !== 'PENDING' && (
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      item.status === 'APPROVED'
                        ? 'bg-green-500/10 text-green-600 border-green-500/20'
                        : item.status === 'DUPLICATE'
                          ? 'bg-amber-500/10 text-amber-600 border-amber-500/20'
                          : 'bg-red-500/10 text-red-600 border-red-500/20'
                    }`}
                  >
                    {item.status === 'APPROVED' ? 'Aprobado' : item.status === 'DUPLICATE' ? 'Duplicado' : 'Rechazado'}
                  </Badge>
                )}
                {item.rejectionReason && <span className="text-xs text-muted-foreground">— {item.rejectionReason}</span>}
              </div>
            ))}
          </div>

          {canAct && (
            <div className="flex items-center gap-2 pt-1">
              {selected.size > 0 && (
                <p className="text-xs text-muted-foreground mr-1">
                  {selected.size} seleccionado{selected.size === 1 ? '' : 's'}
                </p>
              )}
              <Button
                size="sm"
                onClick={handleApprove}
                disabled={approve.isPending || !hasCategory}
                title={!hasCategory ? 'Sin categoría propuesta — no se puede aprobar' : undefined}
              >
                {approve.isPending ? 'Aprobando…' : 'Aprobar'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => setRejectOpen(true)}>
                Rechazar
              </Button>
            </div>
          )}
        </div>
      )}

      <RejectRegistrationDialog
        open={rejectOpen}
        onOpenChange={setRejectOpen}
        orgId={orgId}
        requestId={request.id}
        serialNumbers={selectedSerials}
      />
    </div>
  )
}

export function OrgSolicitudesTab({ orgId }: Props) {
  const { data, isLoading } = useSimRegistrationRequests(orgId)
  const { can } = useAccess()
  const canAct = can('sim-custody:approve-registration')

  return (
    <div className="space-y-8">
      {/* ── Stock Approval Queue (primary) ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">SIMs por aprobar</h3>
          <p className="text-xs text-muted-foreground mt-0.5">SIMs que requieren aprobación del dueño antes de ingresar al almacén</p>
        </div>
        <StockApprovalQueue orgId={orgId} />
      </section>

      {/* ── New TPV registrations (secondary) ── */}
      <section className="space-y-3">
        <div>
          <h3 className="text-base font-semibold">Altas nuevas desde la TPV</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Solicitudes de alta de ICCIDs enviadas desde terminales</p>
        </div>

        {isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
            <Skeleton className="h-20 rounded-lg" />
          </div>
        ) : !data || data.length === 0 ? (
          <GlassCard className="p-12 text-center">
            <p className="text-muted-foreground text-sm">No hay solicitudes pendientes</p>
          </GlassCard>
        ) : (
          <div className="space-y-3">
            {data.map(request => (
              <RequestRow key={request.id} request={request} orgId={orgId} canAct={canAct} />
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
