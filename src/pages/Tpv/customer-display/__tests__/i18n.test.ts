/**
 * Paridad es/en del namespace `customerDisplay` y sus llaves DINÁMICAS (prefijos que el código completa y el lint no ve).
 * fr no se soporta (founder, 28-sep-2026). Patrón: shopify/__tests__/i18n.test.ts.
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'
import { CLAVE_DEL_HISTORIAL } from '../estado'
import { MOMENTOS, MOTIVOS_DE_IMAGEN, MUESTRAS_DE_COLOR, NOTAS_DE_DESTINO } from '../model'

const LOCALES = path.resolve(__dirname, '../../../../locales')
const bundle = (lng: string) =>
  JSON.parse(fs.readFileSync(path.join(LOCALES, lng, 'customerDisplay.json'), 'utf-8')) as Record<string, unknown>
const aplanar = (o: Record<string, unknown>, p = ''): string[] =>
  Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? aplanar(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
  )
const valor = (o: unknown, ruta: string) => ruta.split('.').reduce((n: any, k) => n?.[k], o)

const DINAMICAS: string[] = [
  ...Object.values(CLAVE_DEL_HISTORIAL),
  ...MOMENTOS.map(m => `preview.moments.${m}`),
  ...MUESTRAS_DE_COLOR.map(m => `editor.colors.${m.clave}`),
  ...MOTIVOS_DE_IMAGEN.map(m => `editor.logoErrors.${m}`),
  ...NOTAS_DE_DESTINO.map(n => `copy.${n}`),
]
const PLURALES: string[] = ['status.imagesPending', 'status.imagesFailed', 'copy.submit']

describe('i18n customerDisplay', () => {
  it('es y en tienen exactamente las mismas llaves', () => expect(aplanar(bundle('en')).sort()).toEqual(aplanar(bundle('es')).sort()))
  it('cada llave dinámica existe en los dos idiomas', () => {
    for (const lng of ['es', 'en']) for (const k of DINAMICAS) expect(valor(bundle(lng), k), `${lng}:${k}`).toEqual(expect.any(String))
  })
  it('los plurales tienen _one y _other', () => {
    for (const lng of ['es', 'en'])
      for (const k of PLURALES)
        for (const s of ['_one', '_other']) expect(valor(bundle(lng), `${k}${s}`), `${lng}:${k}${s}`).toEqual(expect.any(String))
  })
  it('no queda ningún texto vacío', () => {
    for (const lng of ['es', 'en'])
      for (const k of aplanar(bundle(lng))) expect(String(valor(bundle(lng), k)).trim(), `${lng}:${k}`).not.toBe('')
  })
})
