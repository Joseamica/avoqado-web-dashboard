/**
 * Carril F2 (hz:fefa11b6:D7): el cambio contra el otro periodo, como lo calculó el SERVIDOR. Flecha por si la cifra subió o bajó, color
 * por el sentido del renglón (más ventas = verde; más devoluciones o comisiones = rojo; informativo = gris), «nuevo» si antes era $0.
 */
import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { CambioDeCifra } from '@/services/reports/salesSummary.service'
import { tonoDelCambio, type Sentido } from '../compararPeriodos'

export function CambioDelPeriodo({
  cambio,
  sentido,
  formatCurrency,
}: {
  cambio: CambioDeCifra | null | undefined
  sentido: Sentido
  formatCurrency: (n: number) => string
}) {
  const { t, i18n } = useTranslation('reports')
  if (!cambio) return null
  const tono = tonoDelCambio(sentido, cambio.difference)
  if (tono === 'igual') return <span data-tono="igual">{t('salesSummary.compare.noChange')}</span>
  const sube = cambio.difference > 0
  const Flecha = sube ? ArrowUp : ArrowDown
  const porcentaje = cambio.isNew
    ? t('salesSummary.compare.new')
    : cambio.percent != null
      ? `${new Intl.NumberFormat(getIntlLocale(i18n.language), { maximumFractionDigits: 1 }).format(Math.abs(cambio.percent))} %`
      : null
  return (
    <span
      data-tono={tono}
      className={cn(
        'inline-flex items-center gap-0.5 whitespace-nowrap tabular-nums',
        tono === 'mejora' && 'text-emerald-600 dark:text-emerald-400',
        tono === 'empeora' && 'text-destructive',
      )}
    >
      <Flecha aria-hidden className="h-3 w-3 shrink-0" />
      <span className="sr-only">{t(sube ? 'salesSummary.compare.up' : 'salesSummary.compare.down')} </span>
      {formatCurrency(Math.abs(cambio.difference))}
      {porcentaje && ` · ${porcentaje}`}
    </span>
  )
}

/** «antes $X · ▲ $Y · 12 %»: lo del otro periodo debajo de un importe. */
export function AntesDelPeriodo({
  valor,
  cambio,
  sentido,
  formatCurrency,
}: {
  valor: number | null | undefined
  cambio: CambioDeCifra | null | undefined
  sentido: Sentido
  formatCurrency: (n: number) => string
}) {
  const { t } = useTranslation('reports')
  return (
    <span className="block text-xs text-muted-foreground" data-testid="comparado">
      {t('salesSummary.compare.before')} {valor == null ? '—' : formatCurrency(valor)}
      {cambio && (
        <>
          {' · '}
          <CambioDelPeriodo cambio={cambio} sentido={sentido} formatCurrency={formatCurrency} />
        </>
      )}
    </span>
  )
}
