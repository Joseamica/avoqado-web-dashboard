import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import commonEs from '@/locales/es/common.json'
import loyaltyEs from '@/locales/es/loyalty.json'
import type { LoyaltyPromotion } from '@/types/customer'
import { LoyaltyPromotionDialog, borradorNuevo, erroresDelBorrador, type Borrador } from '../components/LoyaltyPromotionDialog'

// Funciones normales y no `vi.fn()`: la config trae `mockReset: true` y borraría su implementación antes de cada prueba.
const pedidos = vi.hoisted(() => ({ productos: 0, categorias: 0 }))
vi.mock('@/services/menu.service', () => ({
  getProducts: async () => {
    pedidos.productos++
    return []
  },
  getMenuCategories: async () => {
    pedidos.categorias++
    return []
  },
}))

const HOY = '2026-11-12'
const ambos = { sellos: true, puntos: true }

type Props = { promo?: LoyaltyPromotion | null; onSave: (body: unknown) => Promise<unknown>; hoy?: string; programa?: { sellos: boolean; puntos: boolean } }

async function pintar(props: Props) {
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng: 'es',
    ns: ['loyalty', 'common'],
    defaultNS: 'loyalty',
    resources: { es: { loyalty: loyaltyEs, common: commonEs } },
    interpolation: { escapeValue: false },
  })
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const arbol = (p: Props) => (
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <LoyaltyPromotionDialog
          open
          onClose={() => {}}
          promo={p.promo ?? null}
          programa={p.programa ?? ambos}
          hoy={p.hoy ?? HOY}
          venueId="cvenue000000000000000000"
          saving={false}
          onSave={p.onSave}
        />
      </QueryClientProvider>
    </I18nextProvider>
  )
  const r = render(arbol(props))
  return { rerender: (p: Props) => r.rerender(arbol(p)) }
}
/** Nunca termina: el envío sigue «en vuelo» durante toda la prueba. */
const enVuelo = () => new Promise(() => {})

const valido = (cambios: Partial<Borrador> = {}): Borrador => ({
  ...borradorNuevo(HOY),
  name: 'Buen Fin',
  endDate: '2026-11-17',
  ...cambios,
})

describe('erroresDelBorrador', () => {
  it('uno válido no tiene errores', () => {
    expect(erroresDelBorrador(valido(), ambos, HOY, false)).toEqual({})
  })

  it('los rangos son los del servidor', () => {
    expect(erroresDelBorrador(valido({ multiplier: 11 }), ambos, HOY, false).multiplier).toBeDefined()
    expect(erroresDelBorrador(valido({ multiplier: 1 }), ambos, HOY, false).multiplier).toBeDefined()
    expect(erroresDelBorrador(valido({ multiplier: 2.5 }), ambos, HOY, false).multiplier).toBeDefined()
    expect(erroresDelBorrador(valido({ multiplier: 10 }), ambos, HOY, false)).toEqual({})
    const suma = (c: Partial<Borrador>) => erroresDelBorrador(valido({ kind: 'ADD', multiplier: undefined, ...c }), ambos, HOY, false)
    expect(suma({ extraStamps: 10 }).extraStamps).toBeDefined()
    expect(suma({ extraStamps: 9 })).toEqual({})
    expect(suma({ extraPoints: 10_001 }).extraPoints).toBeDefined()
    expect(suma({ extraPoints: 10_000 })).toEqual({})
    expect(suma({}).extra).toBeDefined()
    expect(erroresDelBorrador(valido({ minSpend: 10_000_000 }), ambos, HOY, false).minSpend).toBeDefined()
    expect(erroresDelBorrador(valido({ minSpend: 1.005 }), ambos, HOY, false).minSpend).toBeDefined()
    expect(erroresDelBorrador(valido({ minSpend: 9_999_999.99 }), ambos, HOY, false)).toEqual({})
  })

  it('una suma sólo pide lo que el negocio tiene prendido', () => {
    const soloPuntos = { sellos: false, puntos: true }
    expect(erroresDelBorrador(valido({ kind: 'ADD', multiplier: undefined, extraStamps: 3 }), soloPuntos, HOY, false).extra).toBeDefined()
  })

  it('fechas: desde hoy, el fin no antes del inicio, y el fin o «Sin fin»', () => {
    expect(erroresDelBorrador(valido({ startDate: '2026-11-11' }), ambos, HOY, false).startDate).toBeDefined()
    expect(erroresDelBorrador(valido({ endDate: '2026-11-12', startDate: '2026-11-13' }), ambos, HOY, false).endDate).toBeDefined()
    expect(erroresDelBorrador(valido({ endDate: '' }), ambos, HOY, false).endDate).toBeDefined()
    expect(erroresDelBorrador(valido({ endDate: '', sinFin: true }), ambos, HOY, false)).toEqual({})
  })

  it('horas: las dos o ninguna; productos o categorías: al menos uno', () => {
    expect(erroresDelBorrador(valido({ timeFrom: '16:00' }), ambos, HOY, false).hours).toBeDefined()
    expect(erroresDelBorrador(valido({ timeFrom: '16:00', timeUntil: '18:00' }), ambos, HOY, false)).toEqual({})
    expect(erroresDelBorrador(valido({ alcance: 'PRODUCTS' }), ambos, HOY, false).products).toBeDefined()
    expect(erroresDelBorrador(valido({ alcance: 'CATEGORIES' }), ambos, HOY, false).categories).toBeDefined()
  })

  it('una activa sólo revisa la fecha de fin, y no la deja en el pasado', () => {
    const activa = valido({ name: '', startDate: '2026-11-01', endDate: '2026-11-11' })
    expect(Object.keys(erroresDelBorrador(activa, ambos, HOY, true))).toEqual(['endDate'])
  })
})

describe('LoyaltyPromotionDialog', () => {
  it('el diálogo no deja crear sin nombre ni fecha', async () => {
    const onSave = vi.fn(enVuelo)
    await pintar({ onSave })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Ponle un nombre (hasta 80 letras).')).toBeInTheDocument()
    expect(screen.getByText('Elige desde cuándo.')).toBeInTheDocument()
  }, 15_000) // primera prueba del archivo: paga la importación en frío

  it('crea con el cuerpo que espera el servidor, y la vista previa sale del borrador', async () => {
    const onSave = vi.fn(enVuelo)
    await pintar({ onSave })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: '  Buen Fin sello doble ' } })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '2026-11-13' } })
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-17' } })
    expect(screen.getByTestId('loyalty-promo-preview')).toHaveTextContent(
      'Del 13 al 17 de nov., cada visita da 2 sellos en vez de 1 y el doble de puntos.',
    )
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(onSave).toHaveBeenCalledWith({
      name: 'Buen Fin sello doble',
      kind: 'MULTIPLY',
      multiplier: 2,
      extraStamps: null,
      extraPoints: null,
      startDate: '2026-11-13',
      endDate: '2026-11-17',
      daysOfWeek: [],
      timeFrom: null,
      timeUntil: null,
      productIds: [],
      categoryIds: [],
      minSpend: null,
      limit: 'NONE',
    })
  })

  it('una activa manda SÓLO la fecha de fin (el servidor rechaza cualquier otra llave)', async () => {
    const onSave = vi.fn(enVuelo)
    const activa: LoyaltyPromotion = {
      id: 'cpromo00000000000000000000',
      name: 'Buen Fin',
      kind: 'MULTIPLY',
      multiplier: 2,
      extraStamps: null,
      extraPoints: null,
      status: 'ACTIVE',
      startsAt: '2026-11-10T06:00:00.000Z',
      endsAt: '2026-11-18T05:59:59.999Z',
      endedAt: null,
      startDate: '2026-11-10',
      endDate: '2026-11-17',
      daysOfWeek: [],
      timeFrom: null,
      timeUntil: null,
      productIds: [],
      categoryIds: [],
      products: [],
      categories: [],
      minSpend: null,
      limit: 'NONE',
      createdAt: '2026-11-09T18:00:00.000Z',
      updatedAt: '2026-11-09T18:00:00.000Z',
    }
    await pintar({ promo: activa, onSave })
    expect(screen.getByLabelText('Nombre')).toBeDisabled()
    fireEvent.change(screen.getByLabelText('Hasta'), { target: { value: '2026-11-20' } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith({ endDate: '2026-11-20' })
  })

  it('editar una programada de suma con los sellos apagados conserva sus sellos extra guardados', async () => {
    const onSave = vi.fn(enVuelo)
    const programada: LoyaltyPromotion = {
      id: 'cpromo00000000000000000001',
      name: 'Suma',
      kind: 'ADD',
      multiplier: null,
      extraStamps: 2,
      extraPoints: 50,
      status: 'SCHEDULED',
      startsAt: '2026-11-20T06:00:00.000Z',
      endsAt: null,
      endedAt: null,
      startDate: '2026-11-20',
      endDate: null,
      daysOfWeek: [],
      timeFrom: null,
      timeUntil: null,
      productIds: [],
      categoryIds: [],
      products: [],
      categories: [],
      minSpend: null,
      limit: 'NONE',
      createdAt: '2026-11-09T18:00:00.000Z',
      updatedAt: '2026-11-09T18:00:00.000Z',
    }
    await pintar({ promo: programada, onSave, programa: { sellos: false, puntos: true } })
    fireEvent.click(screen.getByRole('button', { name: 'Guardar' }))
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ extraStamps: 2, extraPoints: 50 }))
  })

  it('el gasto mínimo aclara que es sobre la venta sin propina', async () => {
    await pintar({ onSave: vi.fn(enVuelo) })
    fireEvent.click(screen.getByText('Más opciones'))
    expect(screen.getByText(/sin contar la propina/)).toBeInTheDocument()
  })

  it('dos clics en el mismo instante en «Crear» mandan UNA promo', async () => {
    const onSave = vi.fn(enVuelo)
    await pintar({ onSave })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Buen Fin' } })
    fireEvent.click(screen.getByLabelText('Sin fin'))
    const crear = screen.getByRole('button', { name: 'Crear' })
    act(() => {
      crear.click()
      crear.click()
    })
    expect(onSave).toHaveBeenCalledTimes(1)
  })

  it('«Más opciones» no pide el catálogo: productos sólo con «Estos productos», categorías sólo con «Estas categorías»', async () => {
    pedidos.productos = 0
    pedidos.categorias = 0
    await pintar({ onSave: vi.fn(enVuelo) })
    fireEvent.click(screen.getByRole('button', { name: /Más opciones/ }))
    await screen.findByText('Sólo si la venta lleva')
    await new Promise(r => setTimeout(r, 20))
    expect(pedidos).toEqual({ productos: 0, categorias: 0 })
    fireEvent.click(screen.getByLabelText('Estos productos'))
    await waitFor(() => expect(pedidos.productos).toBe(1))
    expect(pedidos.categorias).toBe(0)
    fireEvent.click(screen.getByLabelText('Estas categorías'))
    await waitFor(() => expect(pedidos.categorias).toBe(1))
  })

  it('un redibujo con otro «hoy» (pasó la medianoche) no borra lo escrito', async () => {
    const onSave = vi.fn(enVuelo)
    const { rerender } = await pintar({ onSave })
    fireEvent.change(screen.getByLabelText('Nombre'), { target: { value: 'Buen Fin' } })
    rerender({ onSave, hoy: '2026-11-13' })
    expect(screen.getByLabelText('Nombre')).toHaveValue('Buen Fin')
  })
})
