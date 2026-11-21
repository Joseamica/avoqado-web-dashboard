/**
 * Máquina de efectivo · fase 1a (H5 del SERVIDOR, Codex servidor r5): un folio «por terminar» (`POR_TERMINAR`). La máquina ya cerró
 * el cobro y su desenlace quedó guardado, pero relevaron la PC antes de registrar la venta. El gerente lo TERMINA tal cual: la ventana
 * enseña lo que dijo la máquina y manda SÓLO la `version` que vio (nunca importes tecleados; el SERVIDOR lo registra desde lo
 * congelado, con exactamente un pago). 409 `CASH_MACHINE_DOUBT_CHANGED`: se refresca la lista (la página le pasa la fila nueva) y hay
 * que confirmar otra vez. Cualquier otro rechazo (p. ej. 400 `CASH_MACHINE_DOUBT_RESOLUTION_INCOMPLETE`) enseña la razón del SERVIDOR.
 */
import { useRef, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { cashMachineDoubtsKey } from '@/hooks/use-cash-machine-doubts'
import { useVenueDateTime } from '@/utils/datetime'
import { carritoDeLaDuda, pesosOGuion, useAvisoDelResultado, type CashMachineDoubt } from './ResolveCashMachineDoubtDialog'

/** Una fila `POR_TERMINAR` de `GET …/cash-machine/doubts`: lo congelado del folio y el desenlace que la máquina ya dio (centavos). */
export interface CashMachineFolioToFinish {
  id: string
  referenceCC: string
  kind: 'POR_TERMINAR'
  status: 'ABIERTO' | 'RESUELTO'
  deviceId: string | null
  createdAt: string
  dueCents: number | null
  saleCents: number | null
  tipCents: number | null
  pedido: CashMachineDoubt['pedido']
  saleShiftId: string | null
  outcome: string | null
  creditCents: number | null
  changeDispensedCents: number | null
  /** La hora del comprobante que guardó la máquina; null = la venta queda con turno por conciliar. */
  occurredAt: string | null
  version: number
}

const R = 'cashMachineDoubts.resolve'
const F = 'cashMachineDoubts.toFinish'

/** «Se cobró · Recibió $200.00 · Devolvió $50.00»: lo que dijo la máquina, igual en la tabla y en la ventana. */
export function useLoQueDijoLaMaquina() {
  const { t } = useTranslation('shifts')
  return (f: Pick<CashMachineFolioToFinish, 'outcome' | 'creditCents' | 'changeDispensedCents'>) =>
    [
      f.outcome ? t(`${R}.outcomes.${f.outcome}.label`, { defaultValue: f.outcome }) : '—',
      t(`${R}.conflict.received`, { amount: pesosOGuion(f.creditCents) }),
      t(`${R}.conflict.returned`, { amount: pesosOGuion(f.changeDispensedCents) }),
    ].join(' · ')
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  folio: CashMachineFolioToFinish
}

export function FinishCashMachineFolioDialog({ open, onOpenChange, venueId, folio }: Props) {
  const { t } = useTranslation('shifts')
  const avisar = useAvisoDelResultado()
  const loQueDijo = useLoQueDijoLaMaquina()
  const queryClient = useQueryClient()
  const { formatDateTime } = useVenueDateTime()
  const [serverError, setServerError] = useState<string | null>(null)
  /** Tras un 409 «llegó evidencia nueva»: no se vuelve a mandar hasta que la lista traiga, al menos, la versión que dijo el SERVIDOR. */
  const [versionMinima, setVersionMinima] = useState(0)
  const inFlight = useRef(false) // isPending es estado: dos clics en el mismo tick lo ven viejo

  const version = folio.version ?? 1
  const refrescar = () => queryClient.invalidateQueries({ queryKey: cashMachineDoubtsKey(venueId) })

  const mutation = useMutation({
    // SÓLO la versión: el SERVIDOR termina el folio desde lo congelado (H5). Mandar importes lo trataría como una duda nueva.
    mutationFn: () => api.post(`/api/v1/dashboard/venues/${venueId}/cash-machine/doubts/${folio.referenceCC}/resolve`, { version }),
    onSettled: () => {
      inFlight.current = false
    },
    onSuccess: res => {
      avisar(res, folio.referenceCC)
      refrescar()
      onOpenChange(false)
    },
    onError: (e: any) => {
      const data = e?.response?.data
      if (e?.response?.status === 409 && data?.code === 'CASH_MACHINE_DOUBT_CHANGED') {
        setVersionMinima(Math.max(Number(data?.details?.version) || 0, version + 1))
        setServerError(t(`${R}.changed`))
        refrescar()
        return
      }
      setServerError(data?.message || e?.message || '')
    },
  })

  const saving = mutation.isPending
  const canSave = version >= versionMinima && !saving

  // Mientras se termina no se cierra (ni con la X ni con Esc): el resultado tiene que verse.
  const cerrar = () => {
    if (!saving && !inFlight.current) onOpenChange(false)
  }

  const submit = () => {
    if (!canSave || inFlight.current) return
    inFlight.current = true
    setServerError(null)
    mutation.mutate()
  }

  return (
    <FullScreenModal
      open={open}
      onClose={cerrar}
      title={t(`${F}.title`, { folio: folio.referenceCC })}
      contentClassName="bg-muted/30"
      actions={
        <Button className="cursor-pointer" onClick={submit} disabled={!canSave} data-tour="cash-machine-folio-finish-submit">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t(`${F}.button`)}
        </Button>
      }
    >
      <div className="mx-auto max-w-xl space-y-4 p-6">
        <section className="space-y-1 rounded-2xl border border-border/50 bg-card p-6 text-sm">
          <p className="font-medium">{t(`${F}.label`)}</p>
          <p className="text-muted-foreground">{t(`${F}.explain`)}</p>
        </section>

        <section
          className="space-y-1 rounded-2xl border border-border/50 bg-card p-6 text-sm"
          data-tour="cash-machine-folio-finish-summary"
        >
          <p className="text-base font-semibold">{loQueDijo(folio)}</p>
          <p>{t(`${R}.due`, { due: pesosOGuion(folio.dueCents), sale: pesosOGuion(folio.saleCents), tip: pesosOGuion(folio.tipCents) })}</p>
          <p className="text-muted-foreground">
            {t(`${R}.cart`, { items: carritoDeLaDuda(folio.pedido, t('cashMachineDoubts.promotionLine')) })}
          </p>
          <p className="text-muted-foreground">
            {folio.occurredAt ? t(`${F}.receiptTime`, { time: formatDateTime(folio.occurredAt) }) : t(`${F}.noReceiptTime`)}
          </p>
          {serverError && (
            <p role="alert" className="pt-2 text-sm text-destructive">
              {serverError}
            </p>
          )}
        </section>
      </div>
    </FullScreenModal>
  )
}
