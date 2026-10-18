/**
 * `react-i18next` de prueba con las cadenas REALES en español (setup, billing, common), resueltas como el
 * i18next de verdad: primero el JSON y, sólo si la llave falta, su `defaultValue`. Así la prueba ve lo que ve
 * el cliente — un «plan Gratis» escondido en el JSON no pasa verde por culpa de un `defaultValue` distinto —
 * sin montar un proveedor en cada render. Se usa con `vi.mock('react-i18next', () => import('./traduccionesDePrueba'))`.
 *
 * El `t` es ESTABLE por namespace, como el real: uno nuevo en cada render re-disparaba efectos (26-sep).
 */
import billing from '@/locales/es/billing.json'
import common from '@/locales/es/common.json'
import setup from '@/locales/es/setup.json'

type Arbol = Record<string, unknown>
type Opciones = Record<string, unknown> | undefined

const RECURSOS: Record<string, Arbol> = { setup, billing, common }

const buscar = (ns: string, ruta: string) =>
  ruta.split('.').reduce<unknown>((nodo, parte) => (nodo as Arbol | undefined)?.[parte], RECURSOS[ns])

function traducir(nsPorDefecto: string, clave: string, o: Opciones) {
  const [ns, ruta] = clave.includes(':') ? clave.split(':') : [nsPorDefecto, clave]
  const singular = o?.count === 1 ? buscar(ns, `${ruta}_one`) : undefined
  const hallado = typeof singular === 'string' ? singular : buscar(ns, ruta)
  const base = typeof hallado === 'string' ? hallado : typeof o?.defaultValue === 'string' ? o.defaultValue : clave
  return base.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
}

const porNamespace = new Map<string, { t: (clave: string, o?: Opciones) => string; i18n: { language: string } }>()

export function useTranslation(ns: string | string[] = 'setup') {
  const nombre = Array.isArray(ns) ? ns[0] : ns
  let valor = porNamespace.get(nombre)
  if (!valor) {
    valor = { t: (clave, o) => traducir(nombre, clave, o), i18n: { language: 'es' } }
    porNamespace.set(nombre, valor)
  }
  return valor
}
