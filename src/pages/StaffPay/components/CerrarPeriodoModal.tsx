import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useClosePeriod, useClosePreview } from '@/hooks/useStaffPay'
import { useVenueDateTime } from '@/utils/datetime'
import type { Bloqueo, ResultadoCierreDto } from '@/types/staffPay'
import { useNombreSede } from '../useNombreSede'
import { useAccionDelModal } from '../accionDelModal'
import { useFocoDeVuelta } from '../foco'
import { conSigno, monto } from '../conSigno'

interface Props {
  open: boolean
  /** Un día dentro del periodo que se cierra. */
  fecha: string
  /** «septiembre 2026»: el botón dice qué se cierra. */
  etiqueta?: string
  onOpenChange: (open: boolean) => void
  onCerrado: (r: ResultadoCierreDto) => void
  /** Salida del bloqueo «hay excepciones»: abre la lista para resolverlas. */
  onVerExcepciones?: () => void
}

/**
 * Cerrar un periodo congela lo que se le debe a cada persona. Antes de confirmar dice QUÉ se congela (clases, personas,
 * sedes, total) o POR QUÉ todavía no se puede; confirmar manda la huella del preview que se vio, y si el server dice
 * que los números cambiaron, se vuelve a cargar el preview: nunca se cierra con números viejos.
 */
export function CerrarPeriodoModal({ open, fecha, etiqueta, onOpenChange, onCerrado, onVerExcepciones }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  const { formatCalendarDate } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const { data: p, isLoading, isError, error, isFetching, refetch } = useClosePreview(open ? fecha : null)
  const cerrar = useClosePeriod()
  const [entiendo, setEntiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  const listo = !!p && !isError && p.puedeCerrar && (p.huerfanas === 0 || entiendo)

  const confirmar = async () => {
    if (!p || !listo || enviando || isFetching) return
    setEnviando(true)
    try {
      const r = await cerrar.mutateAsync({ fecha, huellaEsperada: p.huella, confirmarHuerfanas: p.huerfanas > 0 && entiendo })
      // Un reintento (doble clic, otra pestaña) devuelve el MISMO cierre: se dice, no se presenta como uno nuevo.
      toast({ title: r.yaCerrado ? t('close.alreadyClosed', { total: monto(r.total) }) : t('close.done') })
      onCerrado(r)
      onOpenChange(false)
    } catch (err) {
      const resp = (err as { response?: { status?: number; data?: { code?: string; message?: string } } })?.response
      const data = resp?.data
      if (data?.code === 'HUELLA_CAMBIO') {
        toast({ title: t('close.changed'), description: t('close.changedHelp') })
        setEntiendo(false)
        await refetch()
      } else {
        toast({ title: data?.message ?? t('errors.generic'), variant: 'destructive' })
        // Un 4xx (otro lo cerró, cambió un permiso, una clase empezó…) deja el preview viejo diciendo «se puede cerrar»:
        // se recarga para que aparezcan los bloqueos reales y el botón se apague.
        if (resp?.status && resp.status >= 400 && resp.status < 500) {
          setEntiendo(false)
          await refetch()
        }
      }
    } finally {
      setEnviando(false)
    }
  }

  const textoBloqueo = (b: Bloqueo) =>
    t(`close.block.${b.codigo}`, 'n' in b ? { count: b.n } : 'hasta' in b ? { hasta: formatCalendarDate(b.hasta) } : undefined)
  const mensajeError = (error as { response?: { data?: { message?: string } } } | null)?.response?.data?.message
  const foco = useFocoDeVuelta()
  const accion = useAccionDelModal(
    <Button className="cursor-pointer" disabled={!listo || enviando || isFetching} onClick={confirmar} data-tour="staffpay-close-confirm">
      {enviando ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Lock className="mr-2 h-4 w-4" />}
      {etiqueta ? t('close.confirmNamed', { periodo: etiqueta }) : t('close.confirm')}
    </Button>,
  )

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      // En el celular el título corto: el periodo ya lo dicen el botón de abajo y el rango de la tarjeta.
      title={etiqueta && !accion.enCelular ? t('close.titleNamed', { periodo: etiqueta }) : t('close.titleLoading')}
      contentClassName="bg-muted/30"
      actions={accion.actions}
      onOpenAutoFocus={foco.onOpenAutoFocusPantallaCompleta}
      onCloseAutoFocus={foco.onCloseAutoFocus}
    >
      <div className="mx-auto max-w-xl space-y-4 p-6">
        {isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" aria-busy="true" />
        ) : isError || !p ? (
          <section role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/50 bg-card p-6 text-sm">
            <div className="flex items-start gap-2">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{mensajeError ?? t('close.previewError')}</span>
            </div>
            <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
              {t('period.retry')}
            </Button>
          </section>
        ) : (
          <>
            {p.bloqueos.length > 0 && (
              <section role="alert" className="space-y-3 rounded-2xl border border-amber-500/40 bg-card p-6">
                <p className="text-sm font-medium">{t('close.blockedTitle')}</p>
                <ul className="space-y-2">
                  {p.bloqueos.map(b => (
                    <li key={b.codigo} className="flex flex-wrap items-start justify-between gap-2 text-sm">
                      <span className="flex items-start gap-2">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        <span>{textoBloqueo(b)}</span>
                      </span>
                      {b.codigo === 'EXCEPCIONES' && onVerExcepciones && (
                        <Button variant="outline" size="sm" className="cursor-pointer" onClick={onVerExcepciones}>
                          {t('period.seeExceptions')}
                        </Button>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}
            <section className="space-y-3 rounded-2xl border border-border/50 bg-card p-6" data-tour="staffpay-close-summary">
              <p className="text-xs text-muted-foreground">
                {t('close.range', { start: formatCalendarDate(p.periodo.start), end: formatCalendarDate(p.periodo.end) })}
              </p>
              <p className="text-3xl font-bold tabular-nums">{monto(p.total)}</p>
              <p className="text-sm">
                {p.clases === 0 && p.personas === 0
                  ? t('close.empty')
                  : t('close.willFreeze', {
                      count: p.clases,
                      personas: t('close.people', { count: p.personas }),
                      // Sólo donde hay dinero: «en Avoqado Wellness», no todas las sedes del alcance (QA defecto 8).
                      sedes: (p.sedesConDinero ?? p.periodo.venueIds).map(nombreSede).join(', '),
                      total: monto(p.total),
                    })}
              </p>
              {Number(p.totalAjustes) !== 0 && (
                <p className="text-sm text-muted-foreground">{t('close.adjustmentsIncluded', { total: conSigno(p.totalAjustes) })}</p>
              )}
              <p className="text-sm text-muted-foreground">{t('close.afterwards')}</p>
            </section>
            {p.huerfanas > 0 && (
              <section className="rounded-2xl border border-border/50 bg-card p-6">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="staffpay-huerfanas"
                    checked={entiendo}
                    onCheckedChange={v => setEntiendo(v === true)}
                    className="mt-0.5 cursor-pointer"
                    data-tour="staffpay-close-orphans"
                  />
                  <Label htmlFor="staffpay-huerfanas" className="cursor-pointer text-sm font-normal leading-snug">
                    {t('close.orphansConfirm', { count: p.huerfanas })}
                  </Label>
                </div>
              </section>
            )}
          </>
        )}
      </div>
      {accion.abajo}
    </FullScreenModal>
  )
}
