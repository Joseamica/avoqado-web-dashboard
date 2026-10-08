import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useFeaturePrice } from '@/hooks/use-feature-price'
import { useStaffPaySedes } from '@/hooks/useStaffPay'
import { cn } from '@/lib/utils'
import type { EstadoSedesDto, SedeEnPagoAlPersonalDto } from '@/types/staffPay'
import { Currency } from '@/utils/currency'
import { useVenueDateTime } from '@/utils/datetime'
import { cuentaVacia, textoDeCuenta } from '../cuenta'
import { INSIGNIA_SEDE as INSIGNIA } from '../insigniaSede'
import { mensajeLegible } from '../rangos'
import { ParticipacionSedeDialog } from './ParticipacionSedeDialog'

type Accion = 'activar' | 'desactivar'

/**
 * Pestaña «Sedes» de pago al personal (pantalla 1 del founder): cada sede con su estado, lo que hoy queda fuera y sus
 * botones para activarla desde una fecha o desactivarla con su último día (el diálogo dice los montos antes de confirmar).
 * Antes de activar, sólo la lista y el camino a «Periodos», donde se activa. `GET /sedes` no lleva puerta de plan: una sede
 * que perdió el plan también se ve aquí y se desactiva (es la salida del bloqueo del cierre).
 */
export function SedesTab({ activa }: { activa: boolean }) {
  const { t } = useTranslation('staffPay')
  const { fullBasePath } = useCurrentVenue()
  const { data, isLoading, isError, error, refetch } = useStaffPaySedes(activa)
  // El precio suelto sólo se pide si alguna sede no tiene el plan (es una lectura de facturación).
  const { price } = useFeaturePrice('SERVICE_PAY', { enabled: !!data?.sedes.some(s => s.estado === 'SIN_PLAN') })
  const [abierto, setAbierto] = useState<{ sede: SedeEnPagoAlPersonalDto; accion: Accion } | null>(null)

  const aviso = (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-input p-3 text-sm">
      <AlertTriangle className="h-4 w-4 shrink-0 text-destructive" />
      <span>{mensajeLegible(error) ?? t('sedes.error')}</span>
      <Button variant="outline" size="sm" className="cursor-pointer" onClick={() => void refetch()}>
        {t('period.retry')}
      </Button>
    </div>
  )
  if (isError && !data) return aviso
  if (isLoading || !data) return activa ? <Skeleton className="h-32 w-full" aria-busy="true" /> : null

  return (
    <div className="space-y-4" data-tour="staffpay-sedes">
      {isError && aviso}
      {!data.activado ? (
        <AntesDeActivar data={data} irA={`${fullBasePath}/servicio-pago#periodos`} />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.sedes.map(s => (
            <TarjetaDeSede
              key={s.venueId}
              sede={s}
              precio={price}
              desdeDelPeriodo={data.periodo?.start ?? null}
              onAbrir={accion => setAbierto({ sede: s, accion })}
            />
          ))}
        </ul>
      )}
      {abierto && <ParticipacionSedeDialog sede={abierto.sede} accion={abierto.accion} onClose={() => setAbierto(null)} />}
    </div>
  )
}

function AntesDeActivar({ data, irA }: { data: EstadoSedesDto; irA: string }) {
  const { t } = useTranslation('staffPay')
  return (
    <>
      <Card className="border-input">
        <CardContent className="space-y-2 p-4">
          <p className="text-sm">{t('sedes.antesDeActivar')}</p>
          <Link to={irA} className="text-sm font-medium underline underline-offset-2" data-tour="staffpay-sedes-ir-a-activar">
            {t('sedes.irAActivar')}
          </Link>
        </CardContent>
      </Card>
      <ul className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
        {data.sedes.map(s => (
          <li key={s.venueId} className="flex items-center justify-between gap-2 rounded-lg border border-input p-3">
            <span className="min-w-0 truncate text-sm font-medium">{s.nombre}</span>
            <Badge variant="outline" className={s.tienePlan ? INSIGNIA.ACTIVA : INSIGNIA.SIN_PLAN}>
              {s.tienePlan ? t('sedes.conPlan') : t('sedes.estado.SIN_PLAN')}
            </Badge>
          </li>
        ))}
      </ul>
    </>
  )
}

function TarjetaDeSede({
  sede: s,
  precio,
  desdeDelPeriodo,
  onAbrir,
}: {
  sede: SedeEnPagoAlPersonalDto
  precio: number | null
  desdeDelPeriodo: string | null
  onAbrir: (accion: Accion) => void
}) {
  const { t, i18n } = useTranslation('staffPay')
  const { can } = useAccess()
  const { formatCalendarDate } = useVenueDateTime()
  const fecha = (d: string) => formatCalendarDate(d)
  const conVentana = s.estado === 'ACTIVA' || s.estado === 'ACTIVA_SIN_PLAN'
  // `puedeActivar`/`puedeDesactivar` son el permiso en la sede DESTINO; la ruta va bajo la sede ACTUAL y también exige ahí
  // «Cerrar periodos y registrar pagos» (E6a-fix F3): sin él, el botón terminaría en 403. Se dice que entre desde otra sede.
  const aqui = can('staffpay:close')
  const puedeActivar = s.puedeActivar && aqui
  const puedeDesactivar = s.puedeDesactivar && aqui
  const cambiaDeSede = !aqui && (s.puedeActivar || s.puedeDesactivar)
  const hayFuera = !cuentaVacia(s.fueraEstePeriodo)
  const cuenta = () => textoDeCuenta(t, s.fueraEstePeriodo, i18n.language)
  // Desde cuándo queda fuera lo de una sede sin activar: su mínimo para activarla hoy (o el inicio del periodo si hoy no hay).
  const desdeFuera = s.minimo ?? desdeDelPeriodo
  // Sin botón, se dice por qué: sin días que puedan entrar hoy, o sin el permiso de cerrar en esa sede. Una ventana ya
  // cerrada (con `hasta`) no se desactiva: no es falta de permiso.
  const sinDiasHoy = s.estado === 'SIN_ACTIVAR' && s.minimo === null
  const sinPermiso =
    (s.estado === 'SIN_ACTIVAR' && s.minimo !== null && !s.puedeActivar) || (conVentana && s.hasta === null && !s.puedeDesactivar)

  return (
    <li
      data-estado={s.estado}
      data-sede-id={s.venueId}
      className={cn('space-y-2 rounded-lg border p-4', s.estado === 'ACTIVA_SIN_PLAN' ? 'border-destructive' : 'border-input')}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="min-w-0 font-medium">{s.nombre}</p>
        <Badge variant="outline" className={INSIGNIA[s.estado]}>
          {t(`sedes.estado.${s.estado}`)}
        </Badge>
      </div>
      {conVentana && s.desde && (
        <p className="text-sm text-muted-foreground">
          {s.hasta
            ? t('sedes.activaHasta', { desde: fecha(s.desde), hasta: fecha(s.hasta) })
            : t('sedes.activaDesde', { desde: fecha(s.desde) })}
        </p>
      )}
      {s.estado === 'ACTIVA_SIN_PLAN' && <p className="text-sm font-medium text-destructive">{t('sedes.bloqueaCierre')}</p>}
      {hayFuera && s.estado === 'SIN_ACTIVAR' && desdeFuera && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          {t('sedes.fuera.sinActivar', { desde: fecha(desdeFuera), cuenta: cuenta() })}
        </p>
      )}
      {hayFuera && s.estado === 'ACTIVA' && s.desde && (
        <p className="text-sm text-muted-foreground">{t('sedes.fuera.antesDe', { desde: fecha(s.desde), cuenta: cuenta() })}</p>
      )}
      {s.estado === 'SIN_PLAN' && (
        <p className="text-sm text-muted-foreground">
          {precio != null ? t('sedes.sinPlanPrecio', { precio: Currency(precio) }) : t('sedes.sinPlan')}
        </p>
      )}
      {sinDiasHoy && <p className="text-xs text-muted-foreground">{t('sedes.sinDiasHoy')}</p>}
      {sinPermiso && <p className="text-xs text-muted-foreground">{t('sedes.sinPermiso')}</p>}
      {cambiaDeSede && <p className="text-xs text-muted-foreground">{t('sedes.cambiaDeSede')}</p>}
      {(puedeActivar || puedeDesactivar) && (
        <div className="flex flex-wrap gap-2 pt-1">
          {puedeActivar && (
            <Button size="sm" className="cursor-pointer" onClick={() => onAbrir('activar')} data-tour="staffpay-sede-activar">
              {t('sedes.activar')}
            </Button>
          )}
          {puedeDesactivar && (
            <Button
              size="sm"
              variant="outline"
              className="cursor-pointer"
              onClick={() => onAbrir('desactivar')}
              data-tour="staffpay-sede-desactivar"
            >
              {t('sedes.desactivar')}
            </Button>
          )}
        </div>
      )}
    </li>
  )
}
