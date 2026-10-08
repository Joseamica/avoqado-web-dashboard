import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

/**
 * Con Pago al personal activo, los montos de las tablas de comisiones son lo CALCULADO por el motor y pueden no coincidir con lo
 * que se paga (devoluciones de hoy, comisiones ya pagadas por el flujo viejo): se dice, y a quien puede verlo se le lleva al
 * recibo (E6a-fix2 C6; el historial de la persona en Equipo, E6a-fix3). Sin Pago al personal activo, no dice nada.
 */
export function NotaDeLoCalculado({ staffPayActive, puedeVerRecibos }: { staffPayActive: boolean; puedeVerRecibos: boolean }) {
  const { t } = useTranslation('commissions')
  const { fullBasePath } = useCurrentVenue()
  if (!staffPayActive) return null
  return (
    <p className="text-sm text-muted-foreground" data-tour="commissions-summary-calculated-note">
      {t('summary.calculatedNote')}{' '}
      {puedeVerRecibos && (
        <Link to={`${fullBasePath}/servicio-pago#periodos`} className="font-medium text-foreground underline underline-offset-2">
          {t('overview.goToStaffPay')}
        </Link>
      )}
    </p>
  )
}

/** El servidor topa la tabla y dice cuántos renglones había: si son más de los recibidos, se dice (nunca un recorte mudo). */
export function MostrandoDeTotal({ n, total }: { n: number; total?: number }) {
  const { t } = useTranslation('commissions')
  if (total === undefined || total <= n) return null
  return (
    <p className="text-sm text-muted-foreground" role="status" data-tour="commissions-summary-showing">
      {t('summary.showing', { n, total })}
    </p>
  )
}
