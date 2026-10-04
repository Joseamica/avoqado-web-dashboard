import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
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
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useClassDifference, useSettleDifference } from '@/hooks/useStaffPay'
import type { FilaDiferenciaDto, PreviewLiquidacionDto } from '@/types/staffPay'
import { useVenueDateTime } from '@/utils/datetime'
import { conSigno } from '../conSigno'
import { porPersona, useCausaDiferencia } from '../diferencias'
import { useFocoDeVuelta } from '../foco'
import { periodicidadDe, useNombrePeriodo } from '../useNombrePeriodo'
import { useNombreSede, useRutaDeSede } from '../useNombreSede'

/**
 * Por qué una clase con diferencia no se puede liquidar todavía, en ámbar, y su ÚNICA salida real. Toda diferencia es de un
 * periodo cerrado, y el server rechaza niveles y versiones de tabla con fecha dentro de un periodo cerrado
 * (`assertFechaNoCerrada`): ni la tabla ni asignar el nivel la arreglan (Codex C3). Se resuelve en la clase: «Ajustar monto»
 * (o, sin coach, asignarla o «No se paga esta clase»). El enlace va a la clase en SU sede, no en la del URL (Codex C4).
 */
export function MotivoPorResolver({
  filas,
  classVenueId,
  sessionId,
  enLaClase = false,
  onNavegar,
}: {
  /** Las filas de la clase (todas sus personas): de ahí salen el motivo, la fecha y quién no tenía nivel. */
  filas: FilaDiferenciaDto[]
  classVenueId: string
  sessionId: string
  /** Ya se está en la clase (diálogo abierto desde su tarjeta): se dice qué botón usar, sin enlace. */
  enLaClase?: boolean
  onNavegar?: () => void
}) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { formatCalendarDate } = useVenueDateTime()
  const rutaDeSede = useRutaDeSede()
  // Ajustar una clase pide `staffpay:manage`, y `staffpay:close` si ya está contabilizada (ancla). Sin eso no se le dice
  // «usa Ajustar monto» como si pudiera: se dice qué permiso falta y a quién pedirlo.
  const anclada = filas.some(f => f.periodoOrigenId !== null)
  const puedeResolver = can('staffpay:close') || (!anclada && can('staffpay:manage'))
  const conMotivo = filas.find(f => f.motivo)
  const motivo = conMotivo?.motivo ?? null
  // Quien no tenía nivel es quien da la clase hoy (la coach original conserva el nivel de su primera línea).
  const sinNivel = filas[0]?.coachActualNombre ?? filas.find(f => f.persona !== null && f.persona === f.coachActual)?.personaNombre
  const fecha = conMotivo?.fechaValoracion ?? filas[0]?.fechaValoracion
  return (
    <div className="space-y-0.5">
      <p className="text-sm text-amber-700 dark:text-amber-400">
        {motivo === 'COACH_SIN_NIVEL' && sinNivel && fecha
          ? t('differences.noLevelFor', { persona: sinNivel, fecha: formatCalendarDate(fecha) })
          : motivo
            ? t(`reasons.${motivo}`)
            : t('differences.blockedGeneric')}
      </p>
      <p className="text-xs text-muted-foreground">
        {!puedeResolver
          ? t('differences.exitNoPermission')
          : motivo === 'SIN_COACH'
            ? t(enLaClase ? 'classCard.exitNoCoach' : 'differences.exitNoCoach')
            : t(enLaClase ? 'differences.exitClassHere' : 'differences.exitClass')}
      </p>
      {!enLaClase && puedeResolver && (
        <Link
          to={`${rutaDeSede(classVenueId)}/reservations/calendar?clase=${encodeURIComponent(sessionId)}`}
          onClick={onNavegar}
          className="text-xs font-medium underline underline-offset-2"
        >
          {t('differences.openClass')}
        </Link>
      )}
    </div>
  )
}

/** El encabezado de «Diferencias pendientes»: a donde vuelve el foco si la fila liquidada ya no está. */
export const ID_DIFERENCIAS = 'staffpay-diferencias'

interface Props {
  /** 🔴 La sede de la CLASE (no la del URL): ahí se pide el preview y se liquida (Codex R1-18). */
  classVenueId: string
  sessionId: string
  /** Para nombrar la clase mientras llega el preview. */
  clase?: { productName: string; startsAt: string }
  /** De dónde se abrió: la lista del periodo cerrado o la tarjeta de la clase (cambia el aviso y a dónde vuelve el foco). */
  desde?: 'lista' | 'clase'
  onClose: () => void
}

type ErrorApi = {
  response?: { status?: number; data?: { code?: string; message?: string; details?: { preview?: PreviewLiquidacionDto } } }
}

/**
 * «Liquidar diferencia» de UNA clase: dice a quién se le agrega cuánto y en qué mes, y confirma con la huella del preview
 * que se vio. Se monta al abrirse, así que cada apertura trae su propia clave (`solicitudId`): un doble clic o un reintento
 * tras HUELLA_CAMBIO reusan la de esta apertura; reabrir la clase con una diferencia nueva, no.
 */
export function LiquidarDialog({ classVenueId, sessionId, clase, desde = 'lista', onClose }: Props) {
  const { t } = useTranslation('staffPay')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const { formatDateTime } = useVenueDateTime()
  const nombreSede = useNombreSede()
  const nombrePeriodo = useNombrePeriodo()
  const causa = useCausaDiferencia()
  // Si la fila liquidada ya no está, al encabezado de la sección; si la sección también se fue, al del periodo (o, en la
  // tarjeta, a su título).
  const foco = useFocoDeVuelta(desde === 'lista' ? `#${ID_DIFERENCIAS}` : undefined)
  const { data: p, isLoading, isFetching, isError, error, refetch } = useClassDifference(classVenueId, sessionId, true)
  const liquidar = useSettleDifference(classVenueId, sessionId)
  // Nace al ABRIR, no con la clase: con la misma clave, el server respondería «ya liquidada» con las líneas viejas y no
  // pagaría una diferencia nueva de la misma clase.
  const [solicitudId, setSolicitudId] = useState(() => crypto.randomUUID())
  const [enviando, setEnviando] = useState(false)
  // HUELLA_CAMBIO: los montos de abajo ya son los nuevos; se dice (con antes → ahora si se sabe) hasta el siguiente intento.
  const [cambio, setCambio] = useState<string | null>(null)
  // SEDE_FUERA_DEL_PERIODO: la sede salió del destino entre el preview y la confirmación.
  const [sedeSalio, setSedeSalio] = useState(false)
  // CLASE_EN_EXCEPCION: vale para el preview con el que se intentó; el nuevo (el hook ya lo pidió) trae su motivo.
  const [excepcionEn, setExcepcionEn] = useState<PreviewLiquidacionDto | null>(null)
  const enExcepcion = !!p && excepcionEn === p

  const filas = p?.filas ?? []
  const conMonto = filas.filter(f => f.pendiente !== null && Number(f.pendiente) !== 0).sort(porPersona)
  const bloqueada = !!p?.bloqueada || enExcepcion
  const ampliar = !!p && (!p.sedeEnDestino || sedeSalio)
  const destino = p ? nombrePeriodo(p.destino, periodicidadDe(p.destino)) : ''
  const origen = p?.periodoOrigen ? nombrePeriodo(p.periodoOrigen, periodicidadDe(p.periodoOrigen)) : ''
  const listo = !!p?.periodoOrigen && !bloqueada && conMonto.length > 0 && !isFetching && !enviando
  const cabecera = filas[0] ?? clase
  const mensajeError = (error as ErrorApi | null)?.response?.data?.message

  const confirmar = async () => {
    if (!p?.periodoOrigen || !listo) return
    setEnviando(true)
    setCambio(null)
    try {
      const r = await liquidar.mutateAsync({
        periodoOrigenId: p.periodoOrigen.id,
        huellaEsperada: p.huella,
        solicitudId,
        ...(ampliar ? { ampliarAlcance: true } : {}),
      })
      // Una repetición (doble clic, la respuesta que no llegó) devuelve lo MISMO: se dice, no se presenta como pago nuevo.
      toast({ title: r.yaLiquidada ? t('differences.alreadySettled') : t('differences.settled', { periodo: destino }) })
      onClose()
    } catch (err) {
      const data = (err as ErrorApi)?.response?.data
      if (data?.code === 'HUELLA_CAMBIO') {
        // El hook ya puso en la caché el preview que vino en la respuesta; si no vino, se pide.
        const nuevo = data.details?.preview ?? (await refetch())?.data
        const pendiente = (x: PreviewLiquidacionDto) => x.bloqueada || x.filas.some(f => f.pendiente !== null && Number(f.pendiente) !== 0)
        if (nuevo && !pendiente(nuevo)) {
          // Otra pantalla ya la liquidó: no hay nada que revisar (QA B-2).
          toast({ title: t('differences.alreadySettledElsewhere') })
          onClose()
          return
        }
        const texto =
          nuevo && nuevo.total !== p.total
            ? t('differences.changedFromTo', { antes: conSigno(p.total), ahora: conSigno(nuevo.total) })
            : t('differences.changedHelp')
        setCambio(texto)
        toast({ title: t('differences.changed'), description: texto })
      } else if (data?.code === 'SEDE_FUERA_DEL_PERIODO') {
        setSedeSalio(true)
      } else if (data?.code === 'ORIGEN_CAMBIO') {
        toast({ title: t('differences.moved'), description: t(desde === 'lista' ? 'differences.movedHelp' : 'differences.movedHelpClass') })
        onClose()
      } else if (data?.code === 'CLASE_EN_EXCEPCION') {
        setExcepcionEn(p)
      } else {
        // CLAVE_REUTILIZADA no debería pasar con una clave nueva por apertura; si pasa, el siguiente intento lleva otra.
        if (data?.code === 'CLAVE_REUTILIZADA') setSolicitudId(crypto.randomUUID())
        toast({ title: data?.message ?? t('errors.generic'), variant: 'destructive' })
      }
    } finally {
      setEnviando(false)
    }
  }

  const contenido = () => {
    if (isLoading) return <Skeleton className="h-20 w-full" aria-busy="true" />
    if (isError && !p) {
      return (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{mensajeError ?? t('differences.previewError')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </div>
      )
    }
    if (!p) return null
    if (bloqueada) {
      return (
        <div className="space-y-1 rounded-lg border border-amber-500/40 p-3" role="note">
          <p className="text-sm">{t('differences.blocked')}</p>
          <MotivoPorResolver
            filas={filas}
            classVenueId={classVenueId}
            sessionId={sessionId}
            enLaClase={desde === 'clase'}
            onNavegar={onClose}
          />
        </div>
      )
    }
    if (!p.periodoOrigen || conMonto.length === 0) return <p className="text-sm text-muted-foreground">{t('differences.nothing')}</p>
    return (
      <div className="space-y-3">
        <ul className="max-h-[40vh] divide-y divide-border/50 overflow-y-auto rounded-lg border border-input text-sm">
          {conMonto.map(f => (
            <li key={f.persona} className="flex items-baseline justify-between gap-3 px-3 py-2">
              {/* Por persona: una sustitución trae un descuento y un pago en la misma clase. */}
              <span className="min-w-0 break-words">
                {f.personaNombre ?? t('period.noCoach')}
                {causa(f) && <span className="block text-xs text-muted-foreground">{causa(f)}</span>}
                <span className="block text-xs text-muted-foreground">
                  {t(Number(f.pendiente) < 0 ? 'differences.subtractsFrom' : 'differences.addsTo', { destino })}
                </span>
              </span>
              <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums">{conSigno(f.pendiente!)}</span>
            </li>
          ))}
        </ul>
        <p className="text-sm">{t('differences.originUnchanged', { origen })}</p>
        {ampliar && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400" role="note">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t('differences.venueOutside', { sede: nombreSede(classVenueId), destino })}</span>
          </p>
        )}
        {cambio && (
          <p className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-400" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{cambio}</span>
          </p>
        )}
      </div>
    )
  }

  return (
    <AlertDialog open onOpenChange={o => !o && !enviando && onClose()}>
      <AlertDialogContent onOpenAutoFocus={foco.onOpenAutoFocus} onCloseAutoFocus={foco.onCloseAutoFocus}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('differences.settleTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {cabecera
              ? t(classVenueId !== venueId ? 'differences.classLineVenue' : 'differences.classLine', {
                  clase: cabecera.productName,
                  fecha: formatDateTime(cabecera.startsAt),
                  sede: nombreSede(classVenueId),
                })
              : t('differences.help')}
          </AlertDialogDescription>
        </AlertDialogHeader>
        {contenido()}
        <AlertDialogFooter>
          <AlertDialogCancel className="cursor-pointer" disabled={enviando}>
            {t('closed.cancel')}
          </AlertDialogCancel>
          <AlertDialogAction
            className="cursor-pointer"
            disabled={!listo}
            onClick={e => {
              // Se cierra al terminar, no al hacer clic: se ve que se está liquidando.
              e.preventDefault()
              void confirmar()
            }}
            data-tour="staffpay-settle-confirm"
          >
            {(enviando || isFetching) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {ampliar
              ? t('differences.addVenueAndSettle')
              : destino
                ? t('differences.settleIn', { periodo: destino })
                : t('differences.settle')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
