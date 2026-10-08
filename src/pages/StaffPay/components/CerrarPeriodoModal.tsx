import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useClosePeriod, useClosePreview, useStaffPaySedes } from '@/hooks/useStaffPay'
import { cn } from '@/lib/utils'
import { useVenueDateTime } from '@/utils/datetime'
import type { Bloqueo, ResultadoCierreDto, SedeEnPagoAlPersonalDto } from '@/types/staffPay'
import { useNombreSede } from '../useNombreSede'
import { useAccionDelModal } from '../accionDelModal'
import { ANCLA_FOCO, soltarFocoAlAbrir, useFocoDeVuelta } from '../foco'
import { conSigno, monto } from '../conSigno'
import { lista as listaNatural } from '../cuenta'
import { AvisosDelCierre, CierrePorSede } from './DetalleDelCierre'
import { ParticipacionSedeDialog } from './ParticipacionSedeDialog'

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

type BloqueoSinPlan = Extract<Bloqueo, { codigo: 'SEDE_ACTIVA_SIN_PLAN' }>

/**
 * Cerrar un periodo congela lo que se le debe a cada persona. Antes de confirmar dice QUÉ se congela (clases, comisiones,
 * propinas, personas, sedes, total; y sede por sede qué entra y qué no) o POR QUÉ todavía no se puede; confirmar manda la
 * huella del preview que se vio, y si el server dice que los números cambiaron, se vuelve a cargar el preview: nunca se
 * cierra con números viejos. Una sede activa que perdió el plan bloquea EN ROJO y, si otra sede tiene el plan, se puede
 * desactivar aquí mismo con el diálogo de «Sedes» (pantalla 3 del founder).
 */
export function CerrarPeriodoModal({ open, fecha, etiqueta, onOpenChange, onCerrado, onVerExcepciones }: Props) {
  const { t, i18n } = useTranslation('staffPay')
  const { toast } = useToast()
  const { formatCalendarDate } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const { data: p, isLoading, isError, error, isFetching, refetch } = useClosePreview(open ? fecha : null)
  const cerrar = useClosePeriod()
  const [entiendo, setEntiendo] = useState(false)
  const [enviando, setEnviando] = useState(false)
  // Candado síncrono (full-testing C6): el estado no alcanza a cerrarse entre dos clics seguidos.
  const enVuelo = useRef(false)
  const listo = !!p && !isError && p.puedeCerrar && (p.huerfanas === 0 || entiendo)
  // La sede activa sin plan (diseño r4.7): con otra sede con plan, desactivarla libera el cierre; las sedes (con su permiso
  // y su `desde`, que pide el diálogo) sólo se piden en ese caso.
  const sinPlan = p?.bloqueos.find((b): b is BloqueoSinPlan => b.codigo === 'SEDE_ACTIVA_SIN_PLAN')
  const sedes = useStaffPaySedes(open && !!sinPlan?.otrasConPlan)
  // Como en «Sedes» (E6a-fix F3): `puedeDesactivar` es el permiso en la sede destino, y la ruta además exige «Cerrar periodos»
  // en ESTA sede; sin él no se ofrece un botón que acabaría en 403, y se dice desde dónde se puede.
  const { can } = useAccess()
  const aqui = can('staffpay:close')
  const conPermisoAlla = sinPlan?.otrasConPlan
    ? (sedes.data?.sedes ?? []).filter(s => sinPlan.venueIds.includes(s.venueId) && s.puedeDesactivar)
    : []
  const desactivables = aqui ? conPermisoAlla : []
  const [desactivando, setDesactivando] = useState<SedeEnPagoAlPersonalDto | null>(null)

  const confirmar = async () => {
    if (!p || !listo || enviando || isFetching || enVuelo.current) return
    enVuelo.current = true
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
      enVuelo.current = false
      setEnviando(false)
    }
  }

  // El nombre que trae la vista previa; con un server previo (sin `porSede`), el de la sesión.
  const nombreDe = (id: string) => p?.porSede?.find(s => s.venueId === id)?.nombre ?? nombreSede(id)
  const textoBloqueo = (b: Bloqueo) =>
    b.codigo === 'SEDE_ACTIVA_SIN_PLAN'
      ? t(`close.block.SEDE_ACTIVA_SIN_PLAN_${b.otrasConPlan ? 'otras' : 'ninguna'}`, {
          count: b.venueIds.length,
          sedes: listaNatural(b.venueIds.map(nombreDe), i18n?.language),
        })
      : t(`close.block.${b.codigo}`, 'n' in b ? { count: b.n } : 'hasta' in b ? { hasta: formatCalendarDate(b.hasta) } : undefined)
  // Sólo donde hay dinero: «en Avoqado Wellness», no todas las sedes del alcance (QA defecto 8). Una lista VACÍA (p. ej. el
  // único dinero es un ajuste de una sede que ya salió del alcance) omite «en …»; `venueIds` sólo cubre un server previo.
  const sedesTexto = p ? (p.sedesConDinero ?? p.periodo.venueIds).map(nombreSede).join(', ') : ''
  // Fase 3 (spec §11): cuántas clases, comisiones y propinas se congelan; un tipo en cero no se nombra.
  const comisiones = p?.comisiones ?? 0
  const propinas = p?.propinas ?? 0
  const conVentas = comisiones + propinas > 0
  const lista = p
    ? listaNatural(
        [
          p.clases > 0 ? t('close.classes', { count: p.clases }) : null,
          comisiones > 0 ? t('close.commissions', { count: comisiones }) : null,
          propinas > 0 ? t('close.tips', { count: propinas }) : null,
        ].filter((x): x is string => !!x),
        i18n?.language,
      )
    : ''
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
              // Rojo si una sede activa perdió el plan (pantalla 3 del founder); los demás bloqueos siguen en ámbar.
              <section
                role="alert"
                className={cn('space-y-3 rounded-2xl border bg-card p-6', sinPlan ? 'border-destructive' : 'border-amber-500/40')}
              >
                <p className="text-sm font-medium">{t('close.blockedTitle')}</p>
                <ul className="space-y-2">
                  {p.bloqueos.map(b => {
                    const rojo = b.codigo === 'SEDE_ACTIVA_SIN_PLAN'
                    return (
                      <li
                        key={b.codigo}
                        className={cn('flex flex-wrap items-start justify-between gap-2 text-sm', rojo && 'font-medium text-destructive')}
                        data-tour={rojo ? 'staffpay-close-block-sede' : undefined}
                      >
                        <span className="flex items-start gap-2">
                          <AlertTriangle
                            className={cn('mt-0.5 h-4 w-4 shrink-0', rojo ? 'text-destructive' : 'text-amber-600 dark:text-amber-400')}
                          />
                          <span>{textoBloqueo(b)}</span>
                        </span>
                        {b.codigo === 'EXCEPCIONES' && onVerExcepciones && (
                          <Button variant="outline" size="sm" className="cursor-pointer" onClick={onVerExcepciones}>
                            {t('period.seeExceptions')}
                          </Button>
                        )}
                        {rojo && !aqui && conPermisoAlla.length > 0 && (
                          <span className="text-xs font-normal text-muted-foreground">{t('sedes.cambiaDeSede')}</span>
                        )}
                        {rojo &&
                          desactivables.map(s => (
                            <Button
                              key={s.venueId}
                              variant="outline"
                              size="sm"
                              className="cursor-pointer"
                              data-tour="staffpay-close-deactivate-sede"
                              onClick={e => {
                                // Se abre un diálogo encima de este: suelta el foco antes de que el de abajo quede oculto.
                                soltarFocoAlAbrir(e.currentTarget)
                                setDesactivando(s)
                              }}
                            >
                              {t('close.deactivateSede', { sede: s.nombre })}
                            </Button>
                          ))}
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}
            {/* Ancla del foco DENTRO del modal (E6a-fix F8): al desactivar una sede desde el bloqueo, su botón desaparece y el
                foco vuelve aquí, al resumen de lo que se congela, nunca a la página de fondo. */}
            <section
              tabIndex={-1}
              data-staffpay-cierre-ancla
              className={cn('space-y-3 rounded-2xl border border-border/50 bg-card p-6', ANCLA_FOCO)}
              data-tour="staffpay-close-summary"
            >
              <p className="text-xs text-muted-foreground">
                {t('close.range', { start: formatCalendarDate(p.periodo.start), end: formatCalendarDate(p.periodo.end) })}
              </p>
              <p className="text-3xl font-bold tabular-nums">{monto(p.total)}</p>
              <p className="text-sm">
                {p.clases === 0 && p.personas === 0
                  ? t('close.empty')
                  : p.clases === 0 && !conVentas
                    ? // Sólo ajustes (o sólo anuladas): se congelan recibos, no «0 clases» (E6a-fix F5). Un tipo en cero no se nombra.
                      t(sedesTexto ? 'close.willFreezeReceipts' : 'close.willFreezeReceiptsNoVenue', {
                        count: p.personas,
                        personas: t('close.people', { count: p.personas }),
                        sedes: sedesTexto,
                        total: monto(p.total),
                      })
                    : conVentas
                      ? t(sedesTexto ? 'close.willFreezeSales' : 'close.willFreezeSalesNoVenue', {
                          count: p.clases + comisiones + propinas,
                          lista,
                          personas: t('close.people', { count: p.personas }),
                          sedes: sedesTexto,
                          total: monto(p.total),
                        })
                      : t(sedesTexto ? 'close.willFreeze' : 'close.willFreezeNoVenue', {
                          count: p.clases,
                          personas: t('close.people', { count: p.personas }),
                          sedes: sedesTexto,
                          total: monto(p.total),
                        })}
              </p>
              {Number(p.totalAjustes) !== 0 && (
                <p className="text-sm text-muted-foreground">{t('close.adjustmentsIncluded', { total: conSigno(p.totalAjustes) })}</p>
              )}
              {(p.reversos ?? 0) > 0 && <p className="text-sm text-muted-foreground">{t('close.reversals', { count: p.reversos })}</p>}
              <p className="text-sm text-muted-foreground">{t('close.afterwards')}</p>
            </section>
            <CierrePorSede porSede={p.porSede} />
            <AvisosDelCierre p={p} />
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
      {open && desactivando && (
        // El diálogo de «Sedes» (E3c) en modo desactivar: al confirmar refresca todo pago al personal, también esta vista previa.
        <ParticipacionSedeDialog
          sede={desactivando}
          accion="desactivar"
          focoDeVuelta="[data-staffpay-cierre-ancla]"
          onClose={() => setDesactivando(null)}
        />
      )}
    </FullScreenModal>
  )
}
