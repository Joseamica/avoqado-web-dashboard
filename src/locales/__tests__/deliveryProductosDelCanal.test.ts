/** D1 · productos por canal de delivery: textos que el diseño fija, en los dos idiomas. */
import { describe, expect, it } from 'vitest'
import es from '@/locales/es/delivery.json'
import en from '@/locales/en/delivery.json'

describe('textos de productos por canal (D1)', () => {
  it('el botón del canal nombra los productos, como el título de la pantalla que abre', () => {
    expect(es.live.settingsAction).toBe('Horario, precios, productos e impresión')
    expect(en.live.settingsAction).toBe('Hours, pricing, products and printing')
  })

  it('guardar sólo la casilla «Vender en» y fallar no dice que el producto se guardó', () => {
    expect(es.venderEn.noSePudoAgregar).toBe('No se pudo agregar a {{canal}}: inténtalo desde Delivery')
    expect(es.venderEn.noSePudoQuitar).toBe('No se pudo quitar de {{canal}}: inténtalo desde Delivery')
    expect(en.venderEn.noSePudoAgregar).toBe("Couldn't add it to {{canal}}: try again from Delivery")
    expect(en.venderEn.noSePudoQuitar).toBe("Couldn't remove it from {{canal}}: try again from Delivery")
  })

  it('el aviso de siempre (el producto sí se guardó) no cambia', () => {
    expect(es.venderEn.falloAgregar).toBe('El producto se guardó, pero no se pudo agregar a {{canal}}: inténtalo desde Delivery')
    expect(es.venderEn.falloQuitar).toBe('El producto se guardó, pero no se pudo quitar de {{canal}}: inténtalo desde Delivery')
  })
})
