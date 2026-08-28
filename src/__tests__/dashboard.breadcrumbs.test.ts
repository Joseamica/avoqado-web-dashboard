import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'

/**
 * La miga de pan traduce cada segmento de la URL con `routeKeyMap` (src/dashboard.tsx).
 * Un segmento SIN entrada no falla: cae a un fallback que humaniza el slug de la URL. Como
 * los slugs estan en ingles, el usuario en espanol termina leyendo "Modifier groups",
 * "Purchase orders" o "Suppliers" dentro de un dashboard en espanol.
 *
 * Ya se parcheo tres veces a mano (promociones, tarjeta digital, y el resto del catalogo).
 * Estos tests existen para que no haya una cuarta: avisan en cuanto alguien agrega una ruta
 * nueva sin traducir, en vez de que se descubra mirando la pantalla meses despues.
 */

const raiz = process.cwd()
const leer = (p: string) => fs.readFileSync(path.join(raiz, p), 'utf8')

function segmentosMapeados(): Set<string> {
  const src = leer('src/dashboard.tsx')
  const bloque = src.slice(src.indexOf('const routeKeyMap'))
  const cuerpo = bloque.slice(0, bloque.indexOf('\n}'))
  const claves = [...cuerpo.matchAll(/^ {2}('?[\w-]+'?)\s*:/gm)].map(m => m[1].replace(/'/g, ''))
  return new Set(claves)
}

function segmentosDeRutas(): Set<string> {
  const rutas = leer('src/routes/venueRoutes.tsx')
  const segs = new Set<string>()
  for (const [, p] of rutas.matchAll(/path:\s*'([^']+)'/g)) {
    for (const parte of p.split('/')) {
      if (parte && !parte.startsWith(':') && parte !== '*') segs.add(parte.toLowerCase())
    }
  }
  return segs
}

/**
 * Deuda congelada: segmentos que hoy siguen sin traducir. Son pantallas internas de
 * contabilidad/reportes y segmentos tecnicos que no se leen como seccion.
 * Se puede QUITAR de esta lista (mapeando el segmento), nunca AGREGAR: si un segmento nuevo
 * necesita entrar aqui, lo correcto es traducirlo.
 */
const DEUDA_CONOCIDA = new Set([
  '1',
  '2',
  '3',
  '4',
  '5',
  'venues',
  'wl',
  'kyc-required',
  'config',
  'local',
  'google',
  'activos-fijos',
  'area-tickets',
    'available-balance',
  'balanza',
  'basic-info',
  'beneficiarios',
  'bundles',
  'buzon',
  'catalogo',
  'chat',
  'conciliacion',
  'configuracion',
  'contact-images',
  'cuentas-por-pagar',
  'dispersiones',
  'external-settlements',
  'home-charts',
  'impuestos',
  'ingresos',
    'isr',
  'libro-diario',
    'movimientos',
  'online-booking',
  'pay-later-aging',
  'preparacion',
  'pricing',
        'resumen',
  'routing-rules',
  'sales-by-category',
  'sales-by-item',
  'sales-summary',
  'spei',
    'tokens',
  'virtual-terminal',
])

describe('miga de pan · traduccion de las rutas', () => {
  it('no hay rutas nuevas sin traducir', () => {
    const mapeados = segmentosMapeados()
    const nuevos = [...segmentosDeRutas()].filter(s => !mapeados.has(s) && !DEUDA_CONOCIDA.has(s)).sort()

    expect(
      nuevos,
      `Estas rutas nuevas saldrian en INGLES en la miga de pan (se muestra el slug de la URL):\n` +
        nuevos.map(s => `  - ${s}  ->  "${s.replace(/[-_]+/g, ' ').replace(/^./, c => c.toUpperCase())}"`).join('\n') +
        `\n\nAgrega cada una a routeKeyMap en src/dashboard.tsx con su clave de i18n.`,
    ).toEqual([])
  })

  it('toda clave del mapa existe en los tres idiomas', () => {
    const src = leer('src/dashboard.tsx')
    const bloque = src.slice(src.indexOf('const routeKeyMap'))
    const cuerpo = bloque.slice(0, bloque.indexOf('\n}'))
    const refs = [...cuerpo.matchAll(/'([\w]+):([\w.]+)'/g)].map(m => ({ ns: m[1], clave: m[2] }))
    expect(refs.length).toBeGreaterThan(20)

    const faltantes: string[] = []
    for (const idioma of ['es', 'en', 'fr']) {
      for (const { ns, clave } of refs) {
        const archivo = path.join(raiz, `src/locales/${idioma}/${ns}.json`)
        if (!fs.existsSync(archivo)) {
          faltantes.push(`${idioma}/${ns}.json (no existe)`)
          continue
        }
        // 🔴 `\uFEFF` como ESCAPE, no como carácter literal. Escrito literal el BOM es
        // invisible en el editor —parece un espacio raro— y el linter lo rechaza con
        // "Irregular whitespace not allowed", un error que no dice qué carácter es ni
        // dónde empieza. Los .json de i18n llevan BOM y hay que quitarlo para poder
        // parsearlos.
        const json = JSON.parse(fs.readFileSync(archivo, 'utf8').replace(/^\uFEFF/, ''))
        const valor = clave.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown>)?.[k], json)
        if (typeof valor !== 'string' || !valor.trim()) faltantes.push(`${idioma}: ${ns}.${clave}`)
      }
    }
    expect(faltantes, `Claves de i18n usadas por la miga de pan que no existen:\n  ${faltantes.join('\n  ')}`).toEqual([])
  })
})
