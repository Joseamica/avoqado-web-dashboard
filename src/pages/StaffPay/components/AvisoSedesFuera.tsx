import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info } from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useStaffPaySedes } from '@/hooks/useStaffPay'
import { useVenueDateTime } from '@/utils/datetime'
import { cuentaVacia, lista, textoDeCuenta } from '../cuenta'

/** Cuántas sedes sin activar se nombran una por una; las demás, «y N sedes más». */
const MAX_NOMBRADAS = 3

/**
 * El aviso de «Periodos» cuando hay sedes fuera (diseño r3.10, r4.11): en ROJO las activas que perdieron el plan (bloquean el
 * cierre) y en ámbar las que no están activas y tienen dinero fuera. Las dos llevan a «Sedes». Sin datos (cargando o con
 * error) no estorba: la pestaña «Sedes» dice el error.
 */
export function AvisoSedesFuera({ activa }: { activa: boolean }) {
  const { t, i18n } = useTranslation('staffPay')
  const { fullBasePath } = useCurrentVenue()
  const { formatCalendarDate } = useVenueDateTime()
  const { data } = useStaffPaySedes(activa)
  if (!activa || !data?.activado) return null
  const sinPlan = data.sedes.filter(s => s.estado === 'ACTIVA_SIN_PLAN')
  const fuera = data.sedes.filter(s => s.estado === 'SIN_ACTIVAR' && !cuentaVacia(s.fueraEstePeriodo))
  if (sinPlan.length === 0 && fuera.length === 0) return null
  const verSedes = (
    <Link
      to={`${fullBasePath}/servicio-pago#sedes`}
      className="text-sm font-medium underline underline-offset-2"
      data-tour="staffpay-ver-sedes"
    >
      {t('sedes.verSedes')}
    </Link>
  )
  const desde = (minimo: string | null) => formatCalendarDate(minimo ?? data.periodo?.start ?? null)

  return (
    <div className="space-y-3">
      {sinPlan.length > 0 && (
        <div role="alert" className="flex flex-wrap items-start gap-2 rounded-lg border border-destructive p-3 text-sm text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="min-w-0 flex-1">
            {t('sedes.aviso.sinPlan', {
              sedes: lista(
                sinPlan.map(s => s.nombre),
                i18n.language,
              ),
              count: sinPlan.length,
            })}
          </span>
          {verSedes}
        </div>
      )}
      {fuera.length > 0 && (
        <div
          role="note"
          className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/50 p-3 text-sm text-amber-800 dark:text-amber-300"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <ul className="min-w-0 flex-1 space-y-1">
            {fuera.slice(0, MAX_NOMBRADAS).map(s => (
              <li key={s.venueId}>
                {t('sedes.aviso.sinActivar', {
                  sede: s.nombre,
                  desde: desde(s.minimo),
                  cuenta: textoDeCuenta(t, s.fueraEstePeriodo, i18n.language),
                })}
              </li>
            ))}
            {fuera.length > MAX_NOMBRADAS && <li>{t('sedes.aviso.mas', { count: fuera.length - MAX_NOMBRADAS })}</li>}
          </ul>
          {verSedes}
        </div>
      )}
    </div>
  )
}
