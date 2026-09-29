/**
 * Paridad de traducciones es ↔ en para `billing`.
 *
 * fr queda excluido a propósito: el francés dejó de soportarse (founder, 2026-09-28).
 * Que a fr le falten llaves no es un defecto — no se agregan ni se borran llaves de fr.
 */
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/billing.json'
import en from '@/locales/en/billing.json'

const leaves = (value: unknown, prefix = ''): string[] =>
  value && typeof value === 'object' && !Array.isArray(value)
    ? Object.entries(value as Record<string, unknown>).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key))
    : [prefix]
const at = (source: unknown, path: string) => path.split('.').reduce((node: any, key) => node?.[key], source)

describe('billing translations', () => {
  it('es and en carry exactly the same keys', () => {
    expect(leaves(en).sort()).toEqual(leaves(es).sort())
  })

  it('no plan text is empty in es or en', () => {
    for (const source of [es, en])
      for (const key of leaves(source).filter(item => item.startsWith('plan.'))) {
        const value = at(source, key)
        expect(typeof value === 'string' ? value.trim().length : 1).toBeGreaterThan(0)
      }
  })
})
