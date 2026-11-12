import { fireEvent, render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import commonEs from '@/locales/es/common.json'
import loyaltyEs from '@/locales/es/loyalty.json'
import type { LoyaltyPromotion } from '@/types/customer'
import { LoyaltyPromotionDialog, borradorNuevo, erroresDelBorrador, type Borrador } from '../components/LoyaltyPromotionDialog'

// Funciones normales y no `vi.fn()`: la config trae `mockReset: true` y borraría su implementación antes de cada prueba.
vi.mock('@/services/menu.service', () => ({
  getProducts: async () => [],
  getMenuCategories: async () => [],
}))

const HOY = '2026-11-12'
const ambos = { sellos: true, puntos: true }

async function pintar(props: { promo?: LoyaltyPromotion | null; onSave: (body: unknown) => void }) {
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng: 'es',
    ns: ['loyalty', 'common'],
    defaultNS: 'loyalty',
    resources: { es: { loyalty: loyaltyEs, common: commonEs } },
    interpolation: { escapeValue: false },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <LoyaltyPromotionDialog
          open
          onClose={() => {}}
          promo={props.promo ?? null}
          programa={ambos}
          hoy={HOY}
          venueId="cvenue000000000000000000"
          saving={false}
          onSave={props.onSave}
        />
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

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
    const onSave = vi.fn()
    await pintar({ onSave })
    fireEvent.change(screen.getByLabelText('Desde'), { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Crear' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('Ponle un nombre (hasta 80 letras).')).toBeInTheDocument()
    expect(screen.getByText('Elige desde cuándo.')).toBeInTheDocument()
  })

  it('crea con el cuerpo que espera el servidor, y la vista previa sale del borrador', async () => {
    const onSave = vi.fn()
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
    const onSave = vi.fn()
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
})
