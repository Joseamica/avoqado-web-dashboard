/**
 * Ninguna clave del diseñador puede quedarse sin traducir.
 *
 * Es la clase de defecto que sólo se ve MIRANDO la pantalla —y el que ya cosechó este repo:
 * una miga de pan en inglés sobre un dashboard en español, un botón sin `t()`, 26 acentos
 * faltantes—. Aquí se caza antes: la prueba lee las claves DEL CÓDIGO y las busca en los tres
 * idiomas, incluidos los prefijos dinámicos (`t(\`summary.align.${a}\`)`).
 */
import fs from 'fs'
import path from 'path'
import { describe, expect, it } from 'vitest'

const RAIZ = path.resolve(__dirname, '../../../../..')
const IDIOMAS = ['es', 'en', 'fr'] as const

const bundle = (lng: string) =>
  JSON.parse(fs.readFileSync(path.join(RAIZ, 'locales', lng, 'receiptLayout.json'), 'utf-8')) as Record<string, unknown>

const existe = (obj: Record<string, unknown>, clave: string): boolean => {
  let cur: unknown = obj
  for (const parte of clave.split('.')) {
    if (typeof cur !== 'object' || cur === null || !(parte in (cur as Record<string, unknown>))) return false
    cur = (cur as Record<string, unknown>)[parte]
  }
  return typeof cur === 'string'
}

function archivosDelDisenador(): string[] {
  const dir = path.join(RAIZ, 'pages/Settings/components/receipt-layout')
  return [
    ...fs
      .readdirSync(dir)
      .filter(f => /\.tsx?$/.test(f))
      .map(f => path.join(dir, f)),
    path.join(RAIZ, 'pages/Settings/ReceiptLayout.tsx'),
    // El tour vive en `hooks/` pero usa el MISMO namespace: sus claves cuentan igual.
    path.join(RAIZ, 'hooks/useReceiptLayoutTour.ts'),
    // 🔴 El hook de datos pone el aviso de CONFLICTO. Se escapó de esta lista y el dueño veía
    // «receiptLayout.errors.staleTitle» en rojo (/full-testing, 12-sep). Por eso ahora está aquí.
    path.join(RAIZ, 'hooks/useReceiptLayout.ts'),
  ]
}

function clavesDelCodigo(): string[] {
  const claves = new Set<string>()

  for (const f of archivosDelDisenador()) {
    const s = fs.readFileSync(f, 'utf-8')
    for (const m of s.matchAll(/\bt\('([a-zA-Z0-9_.]+)'/g)) claves.add(m[1])
    for (const m of s.matchAll(/(?:labelKey|descriptionKey): '([a-zA-Z0-9_.]+)'/g)) claves.add(m[1])
    for (const m of s.matchAll(/'(locks\.[a-z]+)'/g)) claves.add(m[1])
  }

  // Los prefijos dinámicos, expandidos con los valores REALES que el código puede producir.
  const dinamicas: Record<string, string[]> = {
    'summary.size': ['S', 'M', 'L'],
    'summary.align': ['left', 'center', 'right'],
    'summary.emphasis': ['normal', 'bold', 'double'],
    'summary.style': ['line', 'double', 'blank'],
    'summary.off': [
      'showOrderType',
      'showModifiers',
      'showNotes',
      'showSubtotal',
      'showTax',
      'showDiscount',
      'showTip',
      'showChange',
      'showCardLastFour',
      'showTransactionId',
      'showAppVersion',
    ],
    editor: [
      'showOrderType',
      'showModifiers',
      'showNotes',
      'showSubtotal',
      'showTax',
      'showDiscount',
      'showTip',
      'showChange',
      'showCardLastFour',
      'showTransactionId',
      'showAppVersion',
    ],
    'editor.notPrintable': ['control', 'bidi', 'zeroWidth', 'nonLatin1'],
    samples: ['retail', 'restaurant', 'appointments'],
    'devices.platform': ['TPV_ANDROID', 'TPV_IOS', 'POS_ANDROID', 'POS_IOS', 'POS_DESKTOP'],
  }
  for (const [prefijo, valores] of Object.entries(dinamicas)) for (const v of valores) claves.add(`${prefijo}.${v}`)

  // `t('editor')` y `t('samples')` a secas son los prefijos, no claves: se descartan.
  return [...claves].filter(c => c.includes('.'))
}

describe('i18n del diseñador de tickets', () => {
  const usadas = clavesDelCodigo()

  it('🔴 todo archivo que traduce usa el namespace receiptLayout: con useTranslation() pelón la clave sale CRUDA', () => {
    // Existir en el JSON no basta: el hook de datos tenía `useTranslation()` sin namespace y el aviso
    // de conflicto salía como «receiptLayout.errors.staleTitle» en pantalla (/full-testing, 12-sep).
    const malos = archivosDelDisenador().filter(f => {
      // Sin comentarios: el que explica este mismo defecto cita «useTranslation()» y no es código.
      const s = fs
        .readFileSync(f, 'utf-8')
        .split('\n')
        .filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l))
        .join('\n')
      return /\bt\(['`]/.test(s) && /useTranslation\(\s*\)/.test(s)
    })
    expect(malos.map(f => path.relative(RAIZ, f))).toEqual([])
  })

  it('la extracción encontró claves (si diera 0, todo lo de abajo pasaría en falso)', () => {
    expect(usadas.length).toBeGreaterThan(100)
  })

  it.each(IDIOMAS)('🔴 %s tiene TODAS las claves que el código usa', lng => {
    const b = bundle(lng)
    // Una clave con plural vive como `clave_one` / `clave_other`: cualquiera de las dos la cumple.
    const faltan = usadas.filter(c => !existe(b, c) && !existe(b, `${c}_other`))
    expect(faltan).toEqual([])
  })

  // 🔴 i18next 25 NO lee `_plural` (eso era el formato v3): con él, «2 aparatos» salía en singular
  // o con la clave cruda. Lo cazó el /full-testing del 12-sep MIRANDO la pantalla, porque las
  // pruebas de componente usan un `t` simulado que nunca pluraliza.
  it.each(IDIOMAS)('🔴 %s usa plurales _one/_other, nunca _plural', lng => {
    const crudo = fs.readFileSync(path.join(RAIZ, 'locales', lng, 'receiptLayout.json'), 'utf-8')
    expect(crudo).not.toMatch(/_plural"/)
    const unos = [...crudo.matchAll(/"([a-zA-Z]+)_one"/g)].map(m => m[1])
    const otros = new Set([...crudo.matchAll(/"([a-zA-Z]+)_other"/g)].map(m => m[1]))
    expect(unos.length).toBeGreaterThan(0)
    expect(unos.filter(k => !otros.has(k))).toEqual([])
  })

  it('🔴 los tres idiomas tienen exactamente las MISMAS claves: ninguno se queda atrás', () => {
    const aplanar = (o: Record<string, unknown>, p = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) =>
        typeof v === 'object' && v !== null ? aplanar(v as Record<string, unknown>, `${p}${k}.`) : [`${p}${k}`],
      )
    const [es, en, fr] = IDIOMAS.map(l => aplanar(bundle(l)).sort())
    expect(en).toEqual(es)
    expect(fr).toEqual(es)
  })

  it('🔴 ningún texto quedó vacío ni con un escape sin resolver', () => {
    for (const lng of IDIOMAS) {
      const crudo = fs.readFileSync(path.join(RAIZ, 'locales', lng, 'receiptLayout.json'), 'utf-8')
      // Un `\uXXXX` literal en el JSON se pinta tal cual en pantalla.
      expect(crudo, lng).not.toMatch(/\\\\u[0-9a-fA-F]{4}/)
      const vacias = Object.entries(bundle(lng)).filter(([, v]) => v === '' || v === null)
      expect(vacias, lng).toEqual([])
    }
  })
})
