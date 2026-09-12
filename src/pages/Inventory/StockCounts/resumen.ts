import type { TFunction } from 'i18next'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { StockCountSummary } from '@/services/stockCount.service'

/**
 * Formato de las cantidades de un conteo. Nació de la captura de Mindform:
 * «−6968054.083999999» era un flotante crudo; la cantidad correcta era
 * −6,968,054.084 gramos — y ni siquiera debía sumarse, porque nadie había
 * contado nada.
 *
 * 🔴 El idioma de la app es 'es' | 'en' | 'fr' (i18n.ts, `supportedLngs`), y
 * `Intl` interpreta 'es' como España: −6.968.054,084 (punto para miles, coma
 * para decimales). Nuestro ICP es MEXICANO y lee al revés. Por eso el locale
 * pasa por `getIntlLocale`, el mismo helper que ya usan el dinero y las fechas
 * del dashboard ('es' → 'es-MX'); es idempotente, así que da igual si quien
 * llama manda 'es' o 'es-MX'.
 */
export function formatearDiferencia(n: number, locale: string): string {
  return new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 3, signDisplay: 'exceptZero' }).format(n)
}

export function formatearCantidad(n: number, locale: string): string {
  return new Intl.NumberFormat(getIntlLocale(locale), { maximumFractionDigits: 3 }).format(n)
}

/** Abreviatura traducida de la unidad (`units.GRAM_abbr` → «g»); si no existe, el nombre en minúsculas. */
export function etiquetaDeUnidad(t: TFunction, unit: string): string {
  const key = `units.${unit}_abbr`
  const label = t(key)
  return label === key ? unit.toLowerCase() : label
}

/** «Sin contar» si nadie capturó nada; si no, una entrada por unidad: «−150 g · −2 pza». */
export function diferenciasComoTexto(summary: StockCountSummary, t: TFunction, locale: string): string {
  if (summary.countedCount === 0) return t('stockCounts.notCounted')
  return summary.differenceByUnit.map(d => `${formatearDiferencia(d.difference, locale)} ${etiquetaDeUnidad(t, d.unit)}`).join(' · ')
}

export function colorDeDiferencia(n: number): string {
  if (n === 0) return 'text-muted-foreground'
  return n > 0 ? 'text-green-700 dark:text-green-400 font-medium' : 'text-red-700 dark:text-red-400 font-medium'
}
