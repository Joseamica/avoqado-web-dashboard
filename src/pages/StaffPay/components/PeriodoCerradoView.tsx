import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Info, Loader2, Plus } from 'lucide-react'
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
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useMarkPaid, useStaffPayReport } from '@/hooks/useStaffPay'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { useNombreSede } from '../useNombreSede'
import { conSigno } from '../conSigno'
import { TABLA_PERIODO } from './ListasDelPeriodo'
import { DesglosePersona } from './DesglosePersona'
import { AjusteManualModal } from './AjusteManualModal'

const LIMITE = 50

interface Props {
  periodId: string
  /** Un día del periodo cerrado (su inicio): con él se lee lo congelado. */
  fecha: string
  /** «septiembre 2026». */
  etiqueta: string
  /** «octubre 2026»: el periodo abierto al que va un ajuste nuevo. */
  etiquetaAbierto?: string
}

/**
 * Un periodo cerrado en sólo lectura, leído de lo congelado: quién cobra cuánto y quién ya está pagado. «Marcar
 * pagado» REGISTRA un pago hecho fuera de Avoqado (no mueve dinero) y siempre pide confirmación.
 */
export function PeriodoCerradoView({ periodId, fecha, etiqueta, etiquetaAbierto }: Props) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { toast } = useToast()
  const { formatDate, formatCalendarDate } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const [offset, setOffset] = useState(0)
  const { data: crudo, isLoading, isError, isPlaceholderData, refetch } = useStaffPayReport({ offset, limit: LIMITE, fecha })
  // 🔴 Codex R1-2: sólo los datos de ESTE periodo; mostrar septiembre y marcar pagado agosto sería pagar el mes equivocado.
  // El hook sólo conserva lo previo dentro del mismo periodo (paginar): mientras llega la página, no se marcan pagos.
  // `estado`: recién cerrado, la caché todavía puede traer el reporte EN VIVO de este mismo periodo (misma llave).
  const data = crudo && crudo.periodo.id === periodId && crudo.periodo.estado === 'CLOSED' ? crudo : undefined
  const marcar = useMarkPaid(periodId)
  // Con UNA persona se guarda su total: la confirmación dice cuánto se registra como pagado.
  const [confirmar, setConfirmar] = useState<{ staffId?: string; nombre?: string; total?: string } | null>(null)
  const [persona, setPersona] = useState<{ staffId: string; staffName: string; clases: number; total: string } | null>(null)
  const [ajusteAbierto, setAjusteAbierto] = useState(false)
  const puedePagar = can('staffpay:close')

  if (isError && !data) {
    return (
      <Card className="border-input" role="alert">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('period.error')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (isLoading || !data) {
    return (
      <div className="space-y-4" aria-busy="true">
        <Skeleton className="h-6 w-64" />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <Skeleton className="h-40" />
      </div>
    )
  }

  const tj = data.tarjetas
  // Del periodo ENTERO, no de la página que se ve (Codex R1-23).
  const pagadas = tj.pagadas ?? 0
  const pendientes = Math.max(0, tj.personas - pagadas)
  const items = data.personas.items
  const total = data.personas.total
  const ocupado = isPlaceholderData || marcar.isPending

  const ejecutar = async () => {
    if (!confirmar) return
    try {
      const r = await marcar.mutateAsync(confirmar.staffId ? { staffId: confirmar.staffId } : {})
      toast({ title: r.marcados === 0 ? t('closed.alreadyPaid') : t('closed.markedPaid', { count: r.marcados }) })
    } catch (err) {
      toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      setConfirmar(null)
    }
  }

  return (
    <div className="space-y-4" data-tour="staffpay-closed-period">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold">
          {t('period.title', { start: formatCalendarDate(data.periodo.start), end: formatCalendarDate(data.periodo.end) })}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs">{tj.personas > 0 && pendientes === 0 ? t('periods.paid') : t('closed.badge')}</span>
        {data.parcial && (
          <span className="rounded-full border border-amber-500/40 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-400">{t('period.partial')}</span>
        )}
        {data.parcial && data.venueIds.length > 0 && <span className="text-xs text-muted-foreground">{data.venueIds.map(nombreSede).join(' · ')}</span>}
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {(
          [
            [t('period.cards.total'), Currency(Number(tj.total))],
            [t('period.cards.classes'), tj.clases],
            [t('period.cards.people'), tj.personas],
            [t('closed.paidCard'), t('closed.paidOf', { pagadas, personas: tj.personas })],
          ] as const
        ).map(([label, value]) => (
          <Card key={String(label)} className="border-input">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{label}</p>
              <p className="text-xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {puedePagar ? (
        <div className="flex flex-wrap items-center gap-2">
          {!data.parcial && pendientes > 0 && (
            <Button size="sm" className="cursor-pointer" disabled={ocupado} onClick={() => setConfirmar({})} data-tour="staffpay-closed-mark-all">
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
              {t('closed.markAllPaid')}
            </Button>
          )}
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => setAjusteAbierto(true)} data-tour="staffpay-closed-adjust">
            <Plus className="mr-1 h-3.5 w-3.5" />
            {etiquetaAbierto ? t('manualAdjust.add', { periodo: etiquetaAbierto }) : t('closed.addToOpen')}
          </Button>
          <p className="text-xs text-muted-foreground">
            {data.parcial && pendientes > 0 ? t('closed.markAllPartial') : t('closed.frozenHelp')}
          </p>
        </div>
      ) : (
        <div className="flex items-start gap-2 rounded-lg border border-input p-3 text-sm text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('closed.noPermission')}</span>
        </div>
      )}

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('closed.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className={TABLA_PERIODO}>
            <thead>
              <tr className="border-b border-border text-left">
                <th className="py-2">{t('period.columns.person')}</th>
                <th>{t('period.columns.level')}</th>
                <th>{t('period.columns.venue')}</th>
                <th className="text-right">{t('period.columns.classes')}</th>
                <th className="text-right">{t('period.columns.adjustments')}</th>
                <th className="text-right">{t('period.columns.total')}</th>
                <th>{t('closed.payment')}</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.staffId} className="border-b border-border/50">
                  <td className="py-2 font-medium">{p.staffName}</td>
                  <td>{p.payLevelName ?? '—'}</td>
                  <td className="text-muted-foreground">{p.venueIds.map(nombreSede).join(', ')}</td>
                  <td className="text-right">{p.clases}</td>
                  <td className="whitespace-nowrap text-right">{Number(p.ajustes ?? 0) !== 0 ? conSigno(p.ajustes!) : '—'}</td>
                  <td className="whitespace-nowrap text-right font-semibold">{Currency(Number(p.total))}</td>
                  <td className="whitespace-nowrap">
                    {p.pagadoEn ? (
                      <span className="inline-flex items-center gap-1 text-sm">
                        <CheckCircle2 className="h-3.5 w-3.5 text-muted-foreground" />
                        {t('closed.paidOn', { fecha: formatDate(p.pagadoEn) })}
                      </span>
                    ) : (
                      <Badge variant="outline">{t('closed.pending')}</Badge>
                    )}
                  </td>
                  <td className="whitespace-nowrap text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="cursor-pointer"
                      aria-label={t('period.detailTitle', { name: p.staffName })}
                      onClick={() => setPersona({ staffId: p.staffId, staffName: p.staffName, clases: p.clases, total: p.total })}
                    >
                      {t('period.detail')}
                    </Button>
                    {puedePagar && !p.pagadoEn && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="cursor-pointer"
                        disabled={ocupado}
                        aria-label={t('closed.markPaidFor', { nombre: p.staffName })}
                        onClick={() => setConfirmar({ staffId: p.staffId, nombre: p.staffName, total: p.total })}
                        data-tour="staffpay-closed-mark-paid"
                      >
                        {t('closed.markPaid')}
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > LIMITE && (
        <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
          <span>{t('period.pageRange', { from: offset + 1, to: Math.min(offset + LIMITE, total), total })}</span>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            aria-label={t('period.previousPage')}
            disabled={offset === 0}
            onClick={() => setOffset(o => Math.max(0, o - LIMITE))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="cursor-pointer"
            aria-label={t('period.nextPage')}
            disabled={offset + LIMITE >= total}
            onClick={() => setOffset(o => o + LIMITE)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <AlertDialog open={!!confirmar} onOpenChange={o => !o && !marcar.isPending && setConfirmar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmar?.staffId
                ? t('closed.markPaidTitle', { nombre: confirmar.nombre, monto: Currency(Number(confirmar.total)) })
                : t('closed.markAllPaidTitle', { periodo: etiqueta })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('closed.markPaidHelp')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={marcar.isPending}>
              {t('closed.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={marcar.isPending}
              onClick={e => {
                // Se cierra al terminar (no al hacer clic): el usuario ve que se está registrando.
                e.preventDefault()
                void ejecutar()
              }}
            >
              {marcar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {confirmar?.staffId
                ? t('closed.markPaidConfirm', { monto: Currency(Number(confirmar.total)) })
                : t('closed.markAllPaidConfirm', { count: pendientes })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {persona && <DesglosePersona {...persona} fecha={fecha} cerrado onClose={() => setPersona(null)} />}
      {ajusteAbierto && <AjusteManualModal open onOpenChange={setAjusteAbierto} sedes={data.venueIds} etiqueta={etiquetaAbierto} />}
    </div>
  )
}
