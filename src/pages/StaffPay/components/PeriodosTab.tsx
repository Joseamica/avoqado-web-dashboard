import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
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
import { Card, CardContent } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { useSetPeriodicity, useStaffPayAccess, useStaffPayPeriods } from '@/hooks/useStaffPay'
import type { PeriodoListadoDto } from '@/types/staffPay'
import { PeriodoAbiertoTab } from './PeriodoAbiertoTab'
import { PeriodoCerradoView } from './PeriodoCerradoView'
import { ActivarPagoAlPersonal } from './ActivarPagoAlPersonal'
import { InterruptorPropinas } from './InterruptorPropinas'
import { AvisoSedesFuera } from './AvisoSedesFuera'
import { useNombrePeriodo } from '../useNombrePeriodo'
import { hoyEnSede } from '../hoyEnSede'
import { useVenueDateTime } from '@/utils/datetime'
import { useFocoDeVuelta } from '../foco'
import { esNoActivado } from '../rangos'

const clave = (p: PeriodoListadoDto) => p.start
/** El periodo elegido vive en la URL (`?periodo=2026-09-01`): al recargar se vuelve a ver el mismo. */
const PARAM = 'periodo'

/**
 * La pestaña «Periodos»: arriba, cuál periodo se ve (el abierto actual primero), cada cuánto se paga y si las propinas van
 * en el recibo; abajo, el periodo abierto (en vivo, con «Cerrar») o el cerrado (congelado, con «Marcar pagado»). Sin
 * activar pago al personal, en su lugar la pantalla que explica y activa (spec §11).
 */
export function PeriodosTab({ activa }: { activa: boolean }) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const { toast } = useToast()
  const { data: acceso } = useStaffPayAccess()
  // Sin activar no hay periodos que ver: la pestaña explica y ofrece activar (spec §11), sin pedir la lista (daría 403).
  const { data, isLoading, isError, error, isFetching, refetch, hasNextPage, fetchNextPage, isFetchingNextPage } = useStaffPayPeriods(
    activa && acceso?.activado === true,
  )
  const setPeriodicity = useSetPeriodicity()
  const location = useLocation()
  const navigate = useNavigate()
  const elegido = new URLSearchParams(location.search).get(PARAM)
  // `replace` y conservando el hash: la pestaña («#periodos») no se pierde y «atrás» no recorre cada periodo visto.
  const setElegido = (v: string | null) => {
    const sp = new URLSearchParams(location.search)
    if (v) sp.set(PARAM, v)
    else sp.delete(PARAM)
    const search = sp.toString()
    navigate({ search: search ? `?${search}` : '', hash: location.hash }, { replace: true })
  }
  // Cambiar la frecuencia se confirma: después del primer cierre ya no tiene vuelta. Desde la fase 3 queda fija al activar
  // (el servidor manda `puedeCambiarPeriodicidad: false` y este diálogo no se alcanza); manda el servidor, así que se queda.
  const [nuevaFrecuencia, setNuevaFrecuencia] = useState<'MONTHLY' | 'SEMIMONTHLY' | null>(null)
  const items = data?.items ?? []
  // Un `?periodo=` que no está en la lista (viejo, mal escrito, de otra frecuencia) cae al periodo actual.
  const actual = items.find(p => clave(p) === elegido) ?? items[0]
  const nombrePeriodo = useNombrePeriodo()
  const focoFrecuencia = useFocoDeVuelta()
  const { venueTimezone, formatCalendarDate } = useVenueDateTime()
  const mes = (p: PeriodoListadoDto) => nombrePeriodo(p, data?.periodicidad ?? 'MONTHLY')
  // «Abierto» sólo el periodo en curso: uno que ya terminó y nadie cerró dice «Sin cerrar». No «Sin movimientos»: un mes sin
  // guardar puede tener clases (sólo un cierre o un ajuste guardan el periodo), y eso sólo lo sabe la vista, con el reporte.
  const hoy = hoyEnSede(venueTimezone)
  const estado = (p: PeriodoListadoDto) =>
    p.estado === 'OPEN'
      ? p.end < hoy
        ? t('periods.notClosed')
        : t('periods.open')
      : p.personas === 0
        ? t('closed.badge')
        : p.pagadas === p.personas
          ? t('periods.paid')
          : t('periods.closedPaid', { pagadas: p.pagadas, count: p.personas })

  const cambiarPeriodicidad = async () => {
    if (!nuevaFrecuencia) return
    try {
      await setPeriodicity.mutateAsync(nuevaFrecuencia)
      setElegido(null)
      toast({ title: t('periods.periodicitySaved') })
    } catch (err) {
      toast({ title: (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? t('errors.generic'), variant: 'destructive' })
    } finally {
      setNuevaFrecuencia(null)
    }
  }

  // Todos los hooks ya se llamaron. Sin activar —o si la lista contesta «sin activar» antes de que el acceso se refresque—,
  // la pantalla de activar en lugar de un error.
  if ((acceso && !acceso.activado) || (isError && !data && esNoActivado(error))) return activa ? <ActivarPagoAlPersonal /> : null
  if (isError && !data) {
    return (
      <Card className="border-input" role="alert">
        <CardContent className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('periods.error')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </CardContent>
      </Card>
    )
  }
  if (isLoading || !data) {
    if (!activa) return null
    return <Skeleton className="h-24 w-full" aria-busy="true" />
  }
  if (!actual) return <p className="text-sm text-muted-foreground">{t('periods.empty')}</p>

  const puedeCerrar = can('staffpay:close')
  const puedeEditar = data.puedeCambiarPeriodicidad && puedeCerrar
  // El primero es el periodo de hoy (el server los manda del más nuevo al más viejo): ahí cae un ajuste nuevo.
  const abiertoHoy = items[0].estado === 'OPEN' ? mes(items[0]) : undefined

  return (
    <div className="space-y-6">
      <AvisoSedesFuera activa={activa} />
      {isError && (
        // Ya hay lista, pero recargarla falló (p. ej. tras un cierre): se dice, para que nada se quede cargando sin fin.
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-input p-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <span>{t('periods.error')}</span>
          </div>
          <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => refetch()}>
            {t('period.retry')}
          </Button>
        </div>
      )}
      <div className="flex flex-wrap items-start gap-x-6 gap-y-4">
        <div className="w-full space-y-1.5 sm:w-96">
          <Label htmlFor="staffpay-periodo">{t('periods.period')}</Label>
          <Select value={clave(actual)} onValueChange={setElegido}>
            <SelectTrigger
              id="staffpay-periodo"
              className="h-auto min-h-9 w-full cursor-pointer whitespace-normal text-left [&>span]:line-clamp-2"
              data-tour="staffpay-period-select"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {items.map(p => (
                <SelectItem key={clave(p)} value={clave(p)} className="cursor-pointer">
                  {mes(p)} · {estado(p)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {hasNextPage && (
            <Button
              variant="link"
              size="sm"
              className="h-auto cursor-pointer px-0"
              disabled={isFetchingNextPage}
              onClick={() => fetchNextPage()}
              data-tour="staffpay-period-load-older"
            >
              {isFetchingNextPage && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
              {t('periods.loadOlder')}
            </Button>
          )}
          {acceso?.startDate && (
            <p className="text-xs text-muted-foreground">{t('activation.activeSince', { fecha: formatCalendarDate(acceso.startDate) })}</p>
          )}
        </div>
        <div className="w-full space-y-1.5 sm:w-auto sm:max-w-sm">
          <Label htmlFor="staffpay-periodicidad">{t('periods.periodicity')}</Label>
          <Select
            value={data.periodicidad}
            onValueChange={v => v !== data.periodicidad && setNuevaFrecuencia(v as 'MONTHLY' | 'SEMIMONTHLY')}
            disabled={!puedeEditar || setPeriodicity.isPending}
          >
            <SelectTrigger id="staffpay-periodicidad" className="w-full cursor-pointer sm:w-64" data-tour="staffpay-periodicity">
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
          <p className="text-xs text-muted-foreground">
            {data.puedeCambiarPeriodicidad ? (puedeCerrar ? t('periods.periodicityHelp') : t('periods.periodicityNoPermission')) : t('periods.periodicityLocked')}
          </p>
        </div>
        <InterruptorPropinas encendidas={!!acceso?.propinasEncendidas} />
      </div>
      {actual.estado === 'CLOSED' && actual.id ? (
        <PeriodoCerradoView key={actual.id} periodId={actual.id} fecha={actual.start} etiqueta={mes(actual)} etiquetaAbierto={abiertoHoy} />
      ) : (
        <PeriodoAbiertoTab key={actual.start} activa={activa} fecha={actual.start} etiqueta={mes(actual)} onYaCerrado={() => {
            // Quien cerró ya está recargando la lista (useInvalidarTodo): no se pide dos veces.
            if (!isFetching) void refetch()
          }} />
      )}
      <AlertDialog open={!!nuevaFrecuencia} onOpenChange={o => !o && !setPeriodicity.isPending && setNuevaFrecuencia(null)}>
        <AlertDialogContent onOpenAutoFocus={focoFrecuencia.onOpenAutoFocus} onCloseAutoFocus={focoFrecuencia.onCloseAutoFocus}>
          <AlertDialogHeader>
            <AlertDialogTitle>{nuevaFrecuencia && t('periods.changeTitle', { frecuencia: t(`periods.short.${nuevaFrecuencia}`) })}</AlertDialogTitle>
            <AlertDialogDescription>{nuevaFrecuencia && t(`periods.changeHelp.${nuevaFrecuencia}`)}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="cursor-pointer" disabled={setPeriodicity.isPending}>
              {t('closed.cancel')}
            </AlertDialogCancel>
            <AlertDialogAction
              className="cursor-pointer"
              disabled={setPeriodicity.isPending}
              onClick={e => {
                e.preventDefault()
                void cambiarPeriodicidad()
              }}
            >
              {setPeriodicity.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {nuevaFrecuencia && t('periods.changeConfirm', { frecuencia: t(`periods.short.${nuevaFrecuencia}`) })}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
