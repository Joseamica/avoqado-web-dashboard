import i18next from 'i18next'
import { beforeAll, describe, expect, it } from 'vitest'

import esMenu from '@/locales/es/menu.json'
import enMenu from '@/locales/en/menu.json'

import { rechazoAlBorrarCategoria } from '../rechazoAlBorrar'

/**
 * Encargo 08cc59 (15-nov): «Eliminar categoría» rechazado cerraba la ventana sin decir nada. El aviso dice por qué con lo
 * que manda el SERVIDOR (`code` + `details`), en el idioma del panel; un código desconocido usa su texto, y sin respuesta
 * el genérico (nunca la jerga de axios).
 */
const i18n = i18next.createInstance()
beforeAll(async () => {
  await i18n.init({
    lng: 'es',
    resources: { es: { menu: esMenu }, en: { menu: enMenu } },
    defaultNS: 'menu',
    interpolation: { escapeValue: false },
  })
})
const t = (...args: Parameters<typeof i18n.t>) => i18n.t(...args)
const rechazo = (data: unknown, status = 400) => ({ response: { status, data } })

describe('aviso al no poder eliminar una categoría', () => {
  it('con productos: cuántos, cuántos pausados, cuáles y qué hacer', () => {
    const error = rechazo({
      message: 'texto del servidor',
      code: 'CATEGORY_HAS_PRODUCTS',
      details: { productos: 7, pausados: 2, ejemplos: ['Brownie', 'Flan', 'Gelatina', 'Pay', 'Pastel'] },
    })
    expect(rechazoAlBorrarCategoria(error, 'Postres', t as never)).toBe(
      'No se puede eliminar «Postres»: todavía tiene 7 productos (2 pausados): Brownie, Flan, Gelatina, Pay, Pastel y 2 más. ' +
        'Los pausados también cuentan. Muévelos a otra categoría o elimínalos y vuelve a intentarlo.',
    )
  })

  it('un solo producto pausado, en singular', () => {
    const error = rechazo({ code: 'CATEGORY_HAS_PRODUCTS', details: { productos: 1, pausados: 1, ejemplos: ['Flan'] } })
    expect(rechazoAlBorrarCategoria(error, 'Postres', t as never)).toBe(
      'No se puede eliminar «Postres»: todavía tiene 1 producto (pausado): Flan. Los pausados también cuentan. ' +
        'Muévelo a otra categoría o elimínalo y vuelve a intentarlo.',
    )
  })

  it('productos sin pausados: no menciona pausados', () => {
    const error = rechazo({ code: 'CATEGORY_HAS_PRODUCTS', details: { productos: 2, pausados: 0, ejemplos: ['Flan', 'Pay'] } })
    expect(rechazoAlBorrarCategoria(error, 'Postres', t as never)).toBe(
      'No se puede eliminar «Postres»: todavía tiene 2 productos: Flan, Pay. Muévelos a otra categoría o elimínalos y vuelve a intentarlo.',
    )
  })

  it('subcategorías que bloquean: las nombra', () => {
    const error = rechazo({ code: 'CATEGORY_HAS_SUBCATEGORIES', details: { subcategorias: ['Pays', 'Helados'] } })
    expect(rechazoAlBorrarCategoria(error, 'Postres', t as never)).toBe(
      'No se puede eliminar «Postres»: tiene 2 subcategorías activas o con productos: Pays, Helados. Elimínalas primero y vuelve a intentarlo.',
    )
  })

  it('en inglés con el panel en inglés', async () => {
    await i18n.changeLanguage('en')
    const error = rechazo({ code: 'CATEGORY_HAS_PRODUCTS', details: { productos: 3, pausados: 3, ejemplos: ['A', 'B', 'C'] } })
    expect(rechazoAlBorrarCategoria(error, 'Desserts', t as never)).toBe(
      "«Desserts» can't be deleted: it still has 3 products (all paused): A, B, C. Paused products count too. " +
        'Move them to another category or delete them, then try again.',
    )
    await i18n.changeLanguage('es')
  })

  it('código desconocido: el texto del servidor tal cual', () => {
    expect(rechazoAlBorrarCategoria(rechazo({ message: 'Categoría no encontrada' }, 404), 'Postres', t as never)).toBe(
      'Categoría no encontrada',
    )
  })

  it('sin respuesta del servidor (red): el genérico, nunca «Network Error»', () => {
    expect(rechazoAlBorrarCategoria(new Error('Network Error'), 'Postres', t as never)).toBe(
      'No se pudo eliminar la categoría. Inténtalo de nuevo.',
    )
  })
})
