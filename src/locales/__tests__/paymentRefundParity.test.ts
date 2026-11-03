import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/payment.json'
import en from '@/locales/en/payment.json'
import fuente from '@/pages/Payment/IssueRefundSheet.tsx?raw'

const leaves = (value: unknown, prefix = ''): string[] => value && typeof value === 'object'
  ? Object.entries(value).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key)) : [prefix]
const at = (source: unknown, path: string): unknown => path.split('.').reduce<unknown>((node, key) =>
  node && typeof node === 'object' ? (node as Record<string, unknown>)[key] : undefined, source)

describe('traducciones de Pagos › Devolver', () => {
  it('es y en tienen las mismas llaves refund y ningún texto vacío', () => {
    expect(at(es, 'refund')).toBeDefined()
    expect(leaves(at(en, 'refund')).sort()).toEqual(leaves(at(es, 'refund')).sort())
    for (const source of [es, en]) for (const key of leaves(at(source, 'refund')))
      expect(at(source, `refund.${key}`), key).toEqual(expect.stringMatching(/\S/))
  })

  it('cada clave refund usada por la hoja o sus subcomponentes existe en ambos idiomas', () => {
    const claves = [...fuente.matchAll(/t\('(refund\.[^']+)'/g)].map(m => m[1])
    expect(claves.length).toBeGreaterThan(40)
    for (const source of [es, en]) for (const key of claves) expect(at(source, key), key).toBeTypeOf('string')
  })

  it('los defaultValue literales en español permanecen idénticos en es', () => {
    const literales = [...fuente.matchAll(/t\('(refund\.[^']+)',\s*\{\s*defaultValue:\s*'([^']*)'/g)]
    expect(literales.length).toBeGreaterThan(35)
    for (const [, key, literal] of literales) expect(at(es, key), key).toBe(literal)
  })

  it.each([
    ['refund.confirmTitle', 'Reembolso de {{amount}}', { amount: '$125.50' }, ['$125.50']],
    ['refund.items.partialRefunded', '{{refunded}} de {{total}} ya se reembolsó', { refunded: 1, total: 3 }, ['1', '3']],
    ['refund.restock.note', 'Los artículos se reabastecerán en el lugar de compra original: {{venue}}', { venue: 'Boutique Centro' }, ['Boutique Centro']],
    ['refund.items.tipIncluded', 'Incluye {{amount}} de propina', { amount: '$25.50' }, ['$25.50']],
  ] as const)('%s conserva su plantilla e interpola con i18next real', async (key, plantilla, opciones, valores) => {
    expect(at(es, key)).toBe(plantilla)
    for (const [lng, source] of [['es', es], ['en', en]] as const) {
      const i18n = i18next.createInstance()
      await i18n.init({ lng, resources: { [lng]: { payment: source } }, interpolation: { escapeValue: false } })
      const texto = i18n.t(key, { ns: 'payment', ...opciones })
      for (const valor of valores) expect(texto).toContain(valor)
      expect(texto).not.toMatch(/{{|refund\./)
    }
  })
})
