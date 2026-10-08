import type { CuentaDto } from '@/types/staffPay'
import { getIntlLocale } from '@/utils/i18n-locale'
import { monto } from './conSigno'

type T = (k: string, o?: Record<string, unknown>) => string
/** `Intl.ListFormat` es ES2021 y el `lib` del proyecto es ES2020: se tipa aquí sólo lo que se usa (existe en todo navegador soportado). */
type FormatoDeLista = new (locale: string, o: { type: 'conjunction' }) => { format: (partes: string[]) => string }
const ListFormat = (Intl as unknown as { ListFormat: FormatoDeLista }).ListFormat

/** «a, b y c» / «a, b, and c», según el idioma de la app. */
export const lista = (partes: string[], idioma?: string) => new ListFormat(getIntlLocale(idioma), { type: 'conjunction' }).format(partes)

/** Cuántos nombres se dicen uno por uno; los demás, «y N sedes más» (como el aviso de sedes fuera). */
export const MAX_NOMBRADAS = 3
/** «A», «A y B», «A, B y C» o «A, B, C y 2 sedes más» (E6a-fix2 K3). */
export function nombresCortos(t: T, nombres: string[], idioma?: string): string {
  if (nombres.length <= MAX_NOMBRADAS) return lista(nombres, idioma)
  return `${nombres.slice(0, MAX_NOMBRADAS).join(', ')} ${t('sedes.aviso.mas', { count: nombres.length - MAX_NOMBRADAS })}`
}

/** Sin movimientos y sin clases por valorar (una venta y su devolución son 2 movimientos y $0: eso SÍ se dice). */
export const cuentaVacia = (c: CuentaDto) =>
  c.clases.n === 0 && c.clases.pendientesDeValoracion === 0 && c.comisiones.n === 0 && c.propinas.n === 0

/**
 * «3 clases ($1,500.00), 41 comisiones ($1,230.00) y 18 propinas ($540.00)»: neto, y un tipo en cero no se nombra (diseño
 * r5.4). Las clases que todavía no se pueden valorar se dicen aparte, nunca como $0.
 */
export function textoDeCuenta(t: T, c: CuentaDto, idioma?: string): string {
  const partes = [
    c.clases.n ? t('sedes.cuenta.clases', { count: c.clases.n, total: monto(c.clases.total) }) : null,
    c.comisiones.n ? t('sedes.cuenta.comisiones', { count: c.comisiones.n, total: monto(c.comisiones.total) }) : null,
    c.propinas.n ? t('sedes.cuenta.propinas', { count: c.propinas.n, total: monto(c.propinas.total) }) : null,
    c.clases.pendientesDeValoracion ? t('sedes.cuenta.sinValorar', { count: c.clases.pendientesDeValoracion }) : null,
  ].filter((x): x is string => !!x)
  return lista(partes, idioma)
}
