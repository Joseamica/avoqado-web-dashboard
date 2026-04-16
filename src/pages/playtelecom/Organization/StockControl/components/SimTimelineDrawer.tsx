/**
 * SimTimelineDrawer — side sheet that renders the full custody timeline of a
 * single ICCID (plan §2.1.1). Zero backend cost: query hits
 * GET /sim-custody/events?serialNumber=X.
 *
 * This drawer is the single biggest argument for the feature: resolves SIM
 * ownership disputes in ~5 seconds.
 */
import { useQuery } from '@tanstack/react-query'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Loader2, PackageCheck, ArrowRight, CheckCircle2, XCircle, RotateCcw, DollarSign } from 'lucide-react'
import { getSimCustodyEvents, type CustodyEvent } from '@/services/simCustody.service'
import { useVenueDateTime } from '@/utils/datetime'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  serialNumber: string | null
}

const EVENT_META: Record<
  string,
  { label: string; Icon: typeof PackageCheck }
> = {
  ASSIGNED_TO_SUPERVISOR: { label: 'Asignado a Supervisor', Icon: ArrowRight },
  ASSIGNED_TO_PROMOTER: { label: 'Asignado a Promotor', Icon: ArrowRight },
  ACCEPTED_BY_PROMOTER: { label: 'Aceptado por Promotor', Icon: CheckCircle2 },
  REJECTED_BY_PROMOTER: { label: 'Rechazado por Promotor', Icon: XCircle },
  COLLECTED_FROM_PROMOTER: { label: 'Recolectado del Promotor', Icon: RotateCcw },
  COLLECTED_FROM_SUPERVISOR: { label: 'Recolectado del Supervisor', Icon: RotateCcw },
  MARKED_SOLD: { label: 'Vendido', Icon: DollarSign },
}

export function SimTimelineDrawer({ open, onOpenChange, orgId, serialNumber }: Props) {
  const { formatDateTime } = useVenueDateTime()
  const enabled = open && Boolean(serialNumber)

  const { data, isLoading, error } = useQuery({
    queryKey: ['sim-custody-events', orgId, serialNumber],
    queryFn: () => getSimCustodyEvents(orgId, serialNumber!),
    enabled,
    staleTime: 30_000,
  })

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Historial del SIM</SheetTitle>
          <SheetDescription className="font-mono text-xs">{serialNumber ?? '—'}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Cargando historial…
            </div>
          )}
          {error && (
            <p className="text-sm text-red-600">No se pudo cargar el historial. Intenta de nuevo.</p>
          )}
          {data && data.events.length === 0 && (
            <p className="text-sm text-muted-foreground">Este SIM no tiene eventos registrados todavía.</p>
          )}
          {data?.events.map((ev: CustodyEvent) => {
            const meta = EVENT_META[ev.eventType] ?? { label: ev.eventType, Icon: PackageCheck }
            const Icon = meta.Icon
            return (
              <div key={ev.id} className="flex gap-3">
                <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <Icon className="h-4 w-4 text-foreground" aria-hidden />
                </div>
                <div className="min-w-0 flex-1 space-y-1">
                  <p className="text-sm font-medium">{meta.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {ev.fromState ?? '—'} → <span className="font-medium">{ev.toState}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(ev.createdAt)}</p>
                  {ev.reason && (
                    <p className="text-xs">
                      Motivo: <span className="font-medium">{ev.reason === 'STAFF_TERMINATED' ? 'Baja de empleado' : 'SIM defectuoso'}</span>
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </SheetContent>
    </Sheet>
  )
}
