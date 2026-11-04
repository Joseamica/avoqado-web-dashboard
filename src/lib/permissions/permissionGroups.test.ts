import { describe, expect, it } from 'vitest'
import es from '@/locales/es/settings.json'
import { DASHBOARD_SUPER_CATEGORIES, filterPermissionsBySearch, formatPermissionLabel, permisosQueCoinciden } from './permissionGroups'

/** El traductor del panel, con los textos reales en español. */
function t(key: string, options?: { defaultValue?: string } | string) {
  const valor = key.split('.').reduce<unknown>((o, k) => (o as Record<string, unknown> | undefined)?.[k], es)
  if (typeof valor === 'string') return valor
  return typeof options === 'string' ? options : (options?.defaultValue ?? key)
}

const categorias = (termino: string) =>
  filterPermissionsBySearch(DASHBOARD_SUPER_CATEGORIES, termino, t).flatMap(s => s.categoryKeys as readonly string[])

describe('filterPermissionsBySearch', () => {
  it('encuentra una categoría por el nombre que el dueño lee', () => {
    expect(categorias('tarjetas de regalo')).toContain('GIFT_CARDS')
  })

  it('encuentra un permiso por su texto en español, sin importar acentos ni mayúsculas', () => {
    expect(categorias('PRENDER Y APAGAR')).toContain('GIFT_CARDS')
    expect(categorias('Ajustar, bloquear, reponer')).toContain('GIFT_CARDS')
  })

  it('sigue encontrando por el nombre interno', () => {
    expect(categorias('giftCards:enable')).toEqual(['GIFT_CARDS'])
  })

  it('sin coincidencias no devuelve nada', () => {
    expect(filterPermissionsBySearch(DASHBOARD_SUPER_CATEGORIES, 'zzz-no-existe', t)).toEqual([])
  })

  it('sin término devuelve todo', () => {
    expect(filterPermissionsBySearch(DASHBOARD_SUPER_CATEGORIES, '  ', t)).toBe(DASHBOARD_SUPER_CATEGORIES)
  })
})

describe('permisosQueCoinciden', () => {
  it('si coincide el nombre de la categoría, se ven todos sus permisos', () => {
    expect(permisosQueCoinciden('GIFT_CARDS', 'tarjetas de regalo', t)).toHaveLength(5)
  })

  it('si coincide un permiso, se ve sólo ése', () => {
    expect(permisosQueCoinciden('GIFT_CARDS', 'prender y apagar', t)).toEqual(['giftCards:enable'])
  })

  it('sin término se ven todos', () => {
    expect(permisosQueCoinciden('GIFT_CARDS', '', t)).toHaveLength(5)
  })
})

describe('formatPermissionLabel', () => {
  it('da el texto en español, nunca el nombre interno', () => {
    expect(formatPermissionLabel('giftCards:manage', t)).toBe('Ajustar, bloquear, reponer y cancelar tarjetas de regalo')
  })
})
