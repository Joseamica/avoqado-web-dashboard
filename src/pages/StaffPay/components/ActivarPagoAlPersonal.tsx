import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Wallet } from 'lucide-react'
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
import { Card, CardContent } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useActivateStaffPay, useStaffPayAccess, useStaffPaySedes } from '@/hooks/useStaffPay'
import { useVenueDateTime } from '@/utils/datetime'
import { useFocoDeVuelta } from '../foco'
import { hoyEnSede } from '../hoyEnSede'
import { inicioDelPeriodo, mensajeLegible } from '../rangos'

type Periodicidad = 'MONTHLY' | 'SEMIMONTHLY'

/**
 * Antes de activar (spec §7.1, §10, §11): qué hace, cada cuánto se paga, desde qué fecha entra lo de las sedes y cuáles
 * entran. Un negocio con el plan no ve el módulo prendido solo: activar confirma la periodicidad, aunque sea la mensual de
 * fábrica. La periodicidad guardada sale de `GET /access` (E1d) y, si ya es fija (periodos guardados), no se cambia. Se
 * manda la fecha que vio el dueño (`inicioEsperado`): si bajo el candado del servidor sale otra (pasó la medianoche del
 * cambio de periodo), 409 INICIO_CAMBIO y la pantalla vuelve a calcularla. El servidor es idempotente (`yaActivado`).
 */
export function ActivarPagoAlPersonal() {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { toast } = useToast()
  const { venueTimezone, formatCalendarDate } = useVenueDateTime()
  const { data: acceso, refetch: releerAcceso } = useStaffPayAccess()
  const sedesQ = useStaffPaySedes()
  const activar = useActivateStaffPay()
  const foco = useFocoDeVuelta()
  const [elegida, setElegida] = useState<Periodicidad | null>(null)
  // Las sedes que el dueño DESMARCÓ, guardadas al desmarcarlas: las demás con el plan entran (marcadas por defecto).
  const [desmarcadas, setDesmarcadas] = useState<ReadonlySet<string>>(() => new Set())
  const [confirmando, setConfirmando] = useState(false)
  // Candado síncrono (como Sedes y el cierre, E6a-fix F12 / QA H9): `isPending` no alcanza a cambiar entre dos clics seguidos.
  const enVuelo = useRef(false)
  const puede = can('staffpay:close')
  const fija = acceso?.periodicidadFija === true
  const guardada: Periodicidad = acceso?.periodicidad ?? 'MONTHLY'
  const periodicidad: Periodicidad = fija ? guardada : (elegida ?? guardada)
  // Lo que el servidor guardará: el inicio del periodo abierto hoy en la zona de la sede. Se recalcula en cada pintada.
  // Si el periodo de hoy ya se cerró (otra sede más al oeste), el servidor empieza al día siguiente de su fin: cuando lo sabe y
  // la periodicidad es la guardada, su fecha manda; si no, el cálculo de siempre.
  const desde =
    periodicidad === guardada && acceso?.inicioAlActivar
      ? acceso.inicioAlActivar
      : inicioDelPeriodo(hoyEnSede(venueTimezone), periodicidad)
  const sedes = sedesQ.data?.sedes ?? []
  const marcadas = sedes.filter(s => s.tienePlan && !desmarcadas.has(s.venueId)).map(s => s.venueId)
  const sedesCargadas = !!sedesQ.data
  const sinMarcar = sedesCargadas && marcadas.length === 0
  const bloqueado = !sedesCargadas || sinMarcar || activar.isPending

  const marcar = (venueId: string, si: boolean) =>
    setDesmarcadas(prev => {
      const nuevo = new Set(prev)
      if (si) nuevo.delete(venueId)
      else nuevo.add(venueId)
      return nuevo
    })

  const confirmar = async () => {
    if (enVuelo.current) return
    enVuelo.current = true
    try {
      const r = await activar.mutateAsync({ periodicidad, inicioEsperado: desde, sedes: marcadas })
      toast({ title: t('activation.done', { fecha: formatCalendarDate(r.startDate) }) })
    } catch (err) {
      toast({ title: mensajeLegible(err) ?? t('errors.generic'), variant: 'destructive' })
      // Algo cambió del otro lado (la periodicidad ya es fija, una sede perdió el plan) o la respuesta se perdió y quizá sí se
      // activó (volver a activar es idempotente): se vuelve a leer lo que se muestra.
      void releerAcceso()
      void sedesQ.refetch()
    } finally {
      enVuelo.current = false
      setConfirmando(false)
    }
  }

  return (
    <Card className="border-input" data-tour="staffpay-activation">
      <CardContent className="space-y-5 p-6">
        <div className="flex items-start gap-3">
          <Wallet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
          <div className="space-y-1">
            <h3 className="font-semibold">{t('activation.title')}</h3>
            <p className="text-sm text-muted-foreground">{t('activation.what')}</p>
            <p className="text-sm text-muted-foreground">{t('activation.noMoney')}</p>
          </div>
        </div>
        <div className="w-full space-y-1.5 sm:w-72">
          <Label htmlFor="staffpay-activar-periodicidad">{t('periods.periodicity')}</Label>
          <Select value={periodicidad} onValueChange={v => setElegida(v as Periodicidad)} disabled={!puede || fija || activar.isPending}>
            <SelectTrigger id="staffpay-activar-periodicidad" className="w-full cursor-pointer" data-tour="staffpay-activation-periodicity">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="MONTHLY" className="cursor-pointer">
                {t('periods.monthly')}
              </SelectItem>
              <SelectItem value="SEMIMONTHLY" className="cursor-pointer">
                {t('periods.semimonthly')}
              </SelectItem>
            </SelectContent>
          </Select>
          {fija && <p className="text-xs text-muted-foreground">{t('activation.periodicityFixed')}</p>}
        </div>
        <fieldset className="space-y-2" data-tour="staffpay-activation-venues">
          <legend className="text-sm font-medium">{t('activation.venues')}</legend>
          {sedesQ.isLoading ? (
            <Skeleton className="h-16 w-full sm:w-96" aria-busy="true" />
          ) : sedesQ.isError && !sedesQ.data ? (
            <div role="alert" className="flex flex-wrap items-center gap-3 text-sm">
              <span>{mensajeLegible(sedesQ.error) ?? t('activation.venuesError')}</span>
              <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void sedesQ.refetch()}>
                {t('period.retry')}
              </Button>
            </div>
          ) : (
            // El servidor topa la organización (409 DEMASIADAS_SEDES pasado el límite): la lista entera, con su propio scroll.
            <ul className="max-h-64 w-full space-y-1 overflow-y-auto rounded-lg border border-input p-2 sm:w-96">
              {sedes.map(s => {
                const id = `staffpay-activar-sede-${s.venueId}`
                return (
                  <li key={s.venueId} className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50">
                    <Checkbox
                      id={id}
                      checked={s.tienePlan && !desmarcadas.has(s.venueId)}
                      disabled={!puede || !s.tienePlan || activar.isPending}
                      onCheckedChange={v => marcar(s.venueId, v === true)}
                      aria-describedby={s.tienePlan ? undefined : `${id}-sin-plan`}
                      className="mt-0.5 cursor-pointer"
                    />
                    <div className="min-w-0">
                      <Label htmlFor={id} className={s.tienePlan ? 'cursor-pointer font-normal' : 'font-normal text-muted-foreground'}>
                        {s.nombre}
                      </Label>
                      {!s.tienePlan && (
                        <p id={`${id}-sin-plan`} className="text-xs text-muted-foreground">
                          {t('activation.venueNoPlan')}
                        </p>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
          {sinMarcar && <p className="text-xs text-muted-foreground">{t('activation.noVenues')}</p>}
        </fieldset>
        <p className="text-sm">{t('activation.since', { fecha: formatCalendarDate(desde) })}</p>
        {puede ? (
          <Button className="cursor-pointer" disabled={bloqueado} onClick={() => setConfirmando(true)} data-tour="staffpay-activate">
            {t('activation.button')}
          </Button>
        ) : (
          <p className="text-sm text-muted-foreground">{t('activation.noPermission')}</p>
        )}
      </CardContent>
      <AlertDialog open={confirmando} onOpenChange={o => !o && !activar.isPending && setConfirmando(false)}>
        <AlertDialogContent onOpenAutoFocus={foco.onOpenAutoFocus} onCloseAutoFocus={foco.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('activation.confirmTitle', { frecuencia: t(`periods.short.${periodicidad}`) })}</AlertDialogTitle>
            <AlertDialogDescription>{t('activation.confirmHelp', { fecha: formatCalendarDate(desde) })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={activar.isPending}>
              {t('closed.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={activar.isPending}
              onClick={e => {
                e.preventDefault()
                void confirmar()
              }}
            >
              {activar.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('activation.button')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}
