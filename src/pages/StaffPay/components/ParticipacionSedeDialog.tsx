import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { useActivateSede, useDeactivateSede, useParticipationPreview } from '@/hooks/useStaffPay'
import type { CuentaDto, SedeEnPagoAlPersonalDto, VistaPreviaParticipacionDto } from '@/types/staffPay'
import { useVenueDateTime } from '@/utils/datetime'
import { cuentaVacia, textoDeCuenta } from '../cuenta'
import { useFocoDeVuelta } from '../foco'
import { mensajeLegible, sinRespuesta } from '../rangos'
import { AvisoSinConexion } from './AvisoSinConexion'

interface Props {
  sede: SedeEnPagoAlPersonalDto
  accion: 'activar' | 'desactivar'
  onClose: () => void
  /**
   * A dónde vuelve el foco si el botón que abrió ya no está (selector). Sin él, al primer botón de la tarjeta de la sede
   * («Sedes»). Abierto desde el modal del cierre, a un lugar DENTRO de ese modal (E6a-fix F8): el de «Sedes» no existe ahí y
   * el foco caía en la página de fondo, tapada por el modal.
   */
  focoDeVuelta?: string
}

const estadoHttp = (e: unknown) => (e as { response?: { status?: number } } | null)?.response?.status ?? 0
const codigo = (e: unknown) => (e as { response?: { data?: { code?: string } } } | null)?.response?.data?.code

/**
 * Activar una sede desde un día, o desactivarla con su último día (pantalla 2 del founder, diseño r3.7(2), r5.4). Antes de
 * confirmar dice, con montos netos, qué entra y qué queda fuera con ESA fecha (la vista previa del servidor). Confirmar manda
 * la fecha de la vista previa y el «hoy» de la sede que se vio (`fechaEsperada`): si ya es otro día, 409 FECHA_CAMBIO y se
 * vuelve a pedir. Online-only: nada cambia hasta que el servidor contesta.
 */
export function ParticipacionSedeDialog({ sede, accion, onClose, focoDeVuelta }: Props) {
  const { t, i18n } = useTranslation('staffPay')
  const { toast } = useToast()
  const { formatCalendarDate } = useVenueDateTime()
  // Sin fecha elegida, el servidor responde con «hoy» de la sede.
  const [fecha, setFecha] = useState<string | undefined>()
  const [enviando, setEnviando] = useState(false)
  const [hecho, setHecho] = useState(false)
  // Ni mientras se envía ni después del éxito se vuelve a pedir la vista previa (E6a-fix F12, QA H10): el éxito invalida todo
  // pago al personal y el servidor ya diría 409 «ya está activa / no está activa» (una petición tirada, con su error en
  // consola). Un rechazo la relee a mano (`refetch`).
  const q = useParticipationPreview(sede.venueId, accion, fecha, !enviando && !hecho)
  const activar = useActivateSede()
  const desactivar = useDeactivateSede()
  // Candado síncrono (como CerrarPeriodoModal): el estado no alcanza a cambiar entre dos clics seguidos.
  const enVuelo = useRef(false)
  // Si el botón que abrió ya no está (Activar pasó a Desactivar), el foco vuelve al primer botón de la tarjeta de la sede; si la
  // tarjeta se quedó sin botones (desactivada con último día = hoy, E6a-fix2 C3), a la tarjeta misma. O al lugar que diga quien
  // lo abrió (el modal del cierre).
  const tarjeta = `[data-sede-id="${sede.venueId}"]`
  const foco = useFocoDeVuelta(focoDeVuelta ?? [`${tarjeta} button`, tarjeta])
  const v = q.data
  // Online-only por defecto, pero sin red el envío queda EN PAUSA (C5): se dice, y cancelar lo quita de la cola de verdad (no sale al
  // volver la red). Mientras se manda de verdad, no se cierra.
  const mutacion = accion === 'activar' ? activar : desactivar
  const cerrar = () => {
    if (mutacion.isPaused) {
      mutacion.cancelarEnPausa()
      enVuelo.current = false
      setEnviando(false)
    } else if (enviando) return
    onClose()
  }
  // Mientras se envía, el éxito refresca todo (también esta vista previa, que ya diría «ya está activa»): no se muestra.
  const errorVista = q.isError && !enviando
  // Sin red la vista previa de ESTA fecha espera a la red (G2): se dice, y no se confirma con los montos (y la fecha) de una vista
  // previa anterior que el `placeholderData` conserva.
  const vistaEnPausa = q.isPaused && !enviando
  const listo = !!v && !errorVista && !q.isFetching && !vistaEnPausa && !enviando
  const fmt = (d: string) => formatCalendarDate(d)
  const cuenta = (c: CuentaDto) => textoDeCuenta(t, c, i18n.language)
  const fechaVista = vistaEnPausa ? (fecha ?? v?.fecha) : (v?.fecha ?? fecha)

  const confirmar = async () => {
    if (!v || !listo || enVuelo.current) return
    enVuelo.current = true
    setEnviando(true)
    try {
      if (accion === 'activar') {
        const r = await activar.mutateAsync({ sedeId: sede.venueId, desde: v.fecha, fechaEsperada: v.maximo })
        setHecho(true)
        toast({ title: t('sedes.dialogo.activada', { sede: sede.nombre, fecha: fmt(r.ventana?.desde ?? v.fecha) }) })
      } else {
        const r = await desactivar.mutateAsync({ sedeId: sede.venueId, hasta: v.fecha, fechaEsperada: v.maximo })
        setHecho(true)
        toast({
          title: r.ventana
            ? t('sedes.dialogo.desactivada', { sede: sede.nombre, fecha: fmt(r.ventana.hasta ?? v.fecha) })
            : t('sedes.dialogo.borrada', { sede: sede.nombre }),
        })
      }
      onClose()
    } catch (err) {
      toast({ title: mensajeLegible(err) ?? t('errors.generic'), variant: 'destructive' })
      if (codigo(err) === 'FECHA_CAMBIO') {
        // Ya es otro día en la sede: la fecha elegida pudo quedar fuera del rango; se vuelve a «hoy» del servidor.
        if (fecha === undefined) void q.refetch()
        else setFecha(undefined)
      } else if (!sinRespuesta(err) && estadoHttp(err) >= 400 && estadoHttp(err) < 500) {
        // Otro la cambió (ya activa, se cruza, perdió el plan…): la vista previa dice el estado real y apaga el botón.
        void q.refetch()
      }
    } finally {
      enVuelo.current = false
      setEnviando(false)
    }
  }

  const etiquetaFecha = accion === 'activar' ? t('sedes.dialogo.desde') : t('sedes.dialogo.hasta')
  const confirmarTexto = t(accion === 'activar' ? 'sedes.dialogo.confirmarActivar' : 'sedes.dialogo.confirmarDesactivar', {
    fecha: fechaVista ? fmt(fechaVista) : '…',
  })

  return (
    <Dialog open onOpenChange={o => !o && cerrar()}>
      <DialogContent hasTitle className="max-w-lg" onOpenAutoFocus={foco.onOpenAutoFocus} onCloseAutoFocus={foco.onCloseAutoFocus}>
        <DialogHeader>
          <DialogTitle>
            {t(accion === 'activar' ? 'sedes.dialogo.tituloActivar' : 'sedes.dialogo.tituloDesactivar', { sede: sede.nombre })}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="staffpay-sede-fecha">{etiquetaFecha}</Label>
            <Input
              id="staffpay-sede-fecha"
              type="date"
              className="h-12 w-full text-base sm:w-56"
              min={v?.minimo}
              max={v?.maximo}
              value={fecha ?? v?.fecha ?? ''}
              disabled={enviando}
              onChange={e => setFecha(e.target.value || undefined)}
              data-tour="staffpay-sede-fecha"
            />
            {/* Siempre montada: es la descripción del diálogo (Radix la pide al abrir); el rango llega con la vista previa. */}
            <DialogDescription className="text-xs">
              {v ? t('sedes.dialogo.rango', { desde: fmt(v.minimo), hasta: fmt(v.maximo) }) : null}
            </DialogDescription>
          </div>
          {errorVista ? (
            <div role="alert" className="flex items-start gap-2 rounded-lg border border-input p-3 text-sm">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
              <span>{mensajeLegible(q.error) ?? t('errors.generic')}</span>
            </div>
          ) : vistaEnPausa ? (
            <AvisoSinConexion texto={t('offline.willCalculate')} dataTour="staffpay-sede-preview-offline" />
          ) : !v ? (
            <Skeleton className="h-20 w-full" aria-busy="true" />
          ) : (
            <div className={q.isFetching ? 'space-y-2 opacity-60' : 'space-y-2'} aria-busy={q.isFetching}>
              <Montos v={v} sede={sede} fmt={fmt} cuenta={cuenta} />
            </div>
          )}
        </div>
        {mutacion.isPaused && <AvisoSinConexion texto={t('offline.willSendSede')} dataTour="staffpay-sede-offline" />}
        <DialogFooter className="gap-2">
          {/* En pausa (sin red) cancelar es seguro: la petición no ha salido y se quita de la cola (C5). */}
          <Button variant="outline" className="cursor-pointer" disabled={enviando && !mutacion.isPaused} onClick={cerrar}>
            {t('closed.cancel')}
          </Button>
          <Button
            className="cursor-pointer"
            variant={accion === 'desactivar' ? 'destructive' : 'default'}
            disabled={!listo}
            onClick={() => void confirmar()}
            data-tour={accion === 'activar' ? 'staffpay-sede-confirmar-activar' : 'staffpay-sede-confirmar-desactivar'}
          >
            {(enviando || q.isFetching) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmarTexto}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Qué cambia con la fecha de la vista previa: siempre la fecha de ESA vista previa junto a sus montos (nunca mezclados). */
function Montos({
  v,
  sede,
  fmt,
  cuenta,
}: {
  v: VistaPreviaParticipacionDto
  sede: SedeEnPagoAlPersonalDto
  fmt: (d: string) => string
  cuenta: (c: CuentaDto) => string
}) {
  const { t } = useTranslation('staffPay')
  const f = fmt(v.fecha)
  if (v.accion === 'activar') {
    const fuera = !cuentaVacia(v.quedanFuera)
    return (
      <>
        <p className="text-sm">
          {cuentaVacia(v.entran)
            ? t('sedes.dialogo.entranNada', { fecha: f })
            : t('sedes.dialogo.entran', { cuenta: cuenta(v.entran), fecha: f, sede: sede.nombre })}
        </p>
        <p className="text-sm text-muted-foreground">
          {fuera ? t('sedes.dialogo.quedanFuera', { cuenta: cuenta(v.quedanFuera), fecha: f }) : t('sedes.dialogo.quedaFueraNada')}
        </p>
        {fuera && <p className="text-xs text-muted-foreground">{t('sedes.dialogo.ajuste')}</p>}
      </>
    )
  }
  // Desactivar con un último día antes de su inicio borra la activación (el servidor guarda hasta = desde − 1).
  const borra = !!sede.desde && v.fecha < sede.desde
  return (
    <>
      <p className="text-sm">
        {cuentaVacia(v.dejanDeEntrar)
          ? t('sedes.dialogo.nadaCambia')
          : t('sedes.dialogo.dejanDeEntrar', { cuenta: cuenta(v.dejanDeEntrar), fecha: f })}
      </p>
      {!cuentaVacia(v.permanecen) && (
        <p className="text-sm text-muted-foreground">{t('sedes.dialogo.permanecen', { cuenta: cuenta(v.permanecen), fecha: f })}</p>
      )}
      {borra && <p className="text-sm font-medium text-destructive">{t('sedes.dialogo.borraActivacion')}</p>}
    </>
  )
}
