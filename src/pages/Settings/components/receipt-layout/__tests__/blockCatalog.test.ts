/**
 * El catálogo del dashboard es un ESPEJO del `discriminatedUnion` del servidor. Son repos
 * distintos: un tipo que sobre o falte no lo caza ningún typecheck — el dueño vería un bloque
 * que el servidor rechaza al guardar, o no vería uno que sí puede usar.
 */
import { describe, expect, it } from 'vitest'

import { BLOCK_CATALOG, BLOCK_DEFAULTS, LOCK_BADGE, LOCK_TOOLTIP_KEY, MANDATORY_TYPES } from '../blockCatalog'

/** Copiado de `avoqado-server/src/services/shared/receiptLayout/schema.ts` (18 tipos). */
const TIPOS_DEL_SERVIDOR = [
  'logo',
  'businessName',
  'fiscal',
  'address',
  'phone',
  'text',
  'orderInfo',
  'staff',
  'items',
  'totals',
  'payment',
  'amountInWords',
  'areaDelivery',
  'qr',
  'fiscalNotice',
  'reference',
  'separator',
  'signature',
]

describe('blockCatalog', () => {
  it('🔴 cubre EXACTAMENTE los tipos del servidor: ni uno de más, ni uno de menos', () => {
    expect(Object.keys(BLOCK_CATALOG).sort()).toEqual([...TIPOS_DEL_SERVIDOR].sort())
  })

  it('🔴 los obligatorios son los siete del spec, y el conjunto está CERRADO', () => {
    expect([...MANDATORY_TYPES].sort()).toEqual(
      ['areaDelivery', 'fiscal', 'items', 'orderInfo', 'payment', 'signature', 'totals'].sort(),
    )
  })

  it('🔴 las tres clases de candado tienen tooltip y letra DISTINTOS', () => {
    // Decir «lo exige la ley» de un candado operativo sería mentirle al dueño (P3-2 de Codex).
    const tooltips = Object.values(LOCK_TOOLTIP_KEY)
    expect(new Set(tooltips).size).toBe(3)
    expect(new Set(Object.values(LOCK_BADGE)).size).toBe(3)
    expect(LOCK_BADGE).toEqual({ legal: 'L', operativo: 'O', plataforma: 'P' })
  })

  it('los topes por tipo coinciden con los del servidor (text 8, separator 10, el resto 1)', () => {
    expect(BLOCK_CATALOG.text.max).toBe(8)
    expect(BLOCK_CATALOG.separator.max).toBe(10)
    const otros = Object.entries(BLOCK_CATALOG).filter(([t]) => t !== 'text' && t !== 'separator')
    expect(otros.every(([, m]) => m.max === 1)).toBe(true)
  })

  it('cada tipo tiene sus valores por default: agregar un bloque nunca manda campos vacíos', () => {
    expect(Object.keys(BLOCK_DEFAULTS).sort()).toEqual([...TIPOS_DEL_SERVIDOR].sort())
  })

  it('cada tipo tiene icono y textos; ninguna clave de i18n queda vacía', () => {
    for (const [type, meta] of Object.entries(BLOCK_CATALOG)) {
      expect(meta.icon, type).toBeTruthy()
      expect(meta.labelKey, type).toMatch(/^blocks\./)
      expect(meta.descriptionKey, type).toMatch(/^blocks\./)
    }
  })
})
