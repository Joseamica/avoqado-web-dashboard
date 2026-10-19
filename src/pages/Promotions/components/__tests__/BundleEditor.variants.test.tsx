import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.name !== undefined ? `${k}:${o.name}:${o.count}` : k),
    i18n: { language: 'es' },
  }),
}))
// El sustituto nativo de Select, pero con los encabezados visibles: cada grupo es un <optgroup> y su encabezado una
// <option disabled value="encabezado:…">, para poder decir bajo qué encabezado quedó cada producto.
vi.mock('@/components/ui/select', async () => {
  const { createElement } = await import('react')
  return {
    ...(await import('@/test/nativeSelectShim')),
    SelectGroup: ({ children }: { children?: ReactNode }) => createElement('optgroup', null, children),
    SelectLabel: ({ children }: { children?: ReactNode }) =>
      createElement('option', { disabled: true, value: `encabezado:${children}` }, children),
  }
})
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venue: { slug: 'demo', timezone: 'America/Mexico_City' } }) }))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    setImageForCrop: () => {},
    setCrop: () => {},
    setZoom: () => {},
    onCropComplete: () => {},
    handleFileUpload: () => {},
    handleCropConfirm: () => {},
    handleFileRemove: () => {},
    initializeWithExistingUrl: () => {},
  }),
}))
vi.mock('@/services/promotion.service', () => ({ default: { createPromotion: vi.fn(), updatePromotion: vi.fn() } }))
const datos = vi.hoisted(() => ({ products: [] as Array<Record<string, unknown>> }))
vi.mock('../../hooks/useDiscountFormData', () => ({
  useDiscountFormData: () => ({
    products: datos.products,
    productOptions: datos.products.map(p => ({ value: p.id, label: p.name })),
    dayOptions: [],
  }),
}))

import { BundleEditor } from '../BundleEditor'

const variante = (id: string, talla: string, pos: number) => ({
  id,
  name: `Playera · ${talla}`,
  productGroupId: 'g1',
  productGroupName: 'Playera',
  variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
})

function abrir(products: Array<Record<string, unknown>>) {
  datos.products = products
  render(
    <QueryClientProvider client={new QueryClient()}>
      <BundleEditor open onClose={() => {}} venueId="ven1" editPromotion={null} onSaved={() => {}} />
    </QueryClientProvider>,
  )
}
const valoresDe = (s: HTMLSelectElement) =>
  within(s)
    .getAllByRole('option')
    .map(o => (o as HTMLOptionElement).value)
    .filter(v => !v.startsWith('encabezado:'))
/** El encabezado bajo el que quedó una opción (null si no está en un grupo). */
const encabezadoDe = (s: HTMLSelectElement, valor: string) =>
  s.querySelector(`option[value="${valor}"]`)?.closest('optgroup')?.querySelector('option[disabled]')?.textContent ?? null
// El primer <select> es el modo de precio; los demás son el producto de cada opción.
const productosElegidos = () => (screen.getAllByRole('combobox', { name: 'select' }) as HTMLSelectElement[]).slice(1)
const valores = () => productosElegidos().map(s => s.value)

describe('Combo: «Agregar toda una familia»', () => {
  it('llena la opción vacía y agrega una opción por cada variante que falta', async () => {
    const user = userEvent.setup()
    abrir([{ id: 'a', name: 'Agua' }, variante('v1', 'S', 0), variante('v2', 'M', 1), variante('v3', 'L', 2)])
    // Con familias, el selector de cada opción agrupa: «toda la familia» NO es una opción (una opción es UN producto).
    expect(valoresDe(productosElegidos()[0])).toEqual(['', 'a', 'v1', 'v2', 'v3'])
    await user.click(screen.getByRole('button', { name: /selector\.agregarFamilia/ }))
    expect(await screen.findByRole('button', { name: 'selector.todaLaFamilia:Playera:3' })).toHaveAttribute(
      'data-tour',
      'bundle-family-0-0',
    )
    await user.click(await screen.findByRole('button', { name: 'selector.todaLaFamilia:Playera:3' }))
    expect(valores()).toEqual(['v1', 'v2', 'v3'])
  })

  it('salta las variantes que el grupo ya tiene', async () => {
    const user = userEvent.setup()
    abrir([variante('v1', 'S', 0), variante('v2', 'M', 1)])
    await user.selectOptions(productosElegidos()[0], 'v2')
    await user.click(screen.getByRole('button', { name: /selector\.agregarFamilia/ }))
    await user.click(await screen.findByRole('button', { name: 'selector.todaLaFamilia:Playera:2' }))
    expect(valores()).toEqual(['v2', 'v1'])
  })

  it('con familias, los productos sueltos van primero bajo su propio encabezado', () => {
    abrir([variante('v1', 'S', 0), variante('v2', 'M', 1), { id: 'z', name: 'Zapato' }])
    expect(valoresDe(productosElegidos()[0])).toEqual(['', 'z', 'v1', 'v2'])
    expect(encabezadoDe(productosElegidos()[0], 'z')).toBe('selector.sueltos')
    expect(encabezadoDe(productosElegidos()[0], 'v1')).toBe('Playera')
  })

  it('🔴 sin familias no aparece el botón y el selector lista los productos como hoy', () => {
    abrir([
      { id: 'b', name: 'Café' },
      { id: 'a', name: 'Agua' },
    ])
    expect(screen.queryByRole('button', { name: /selector\.agregarFamilia/ })).not.toBeInTheDocument()
    expect(valoresDe(productosElegidos()[0])).toEqual(['', 'b', 'a'])
    expect(productosElegidos()[0].querySelector('optgroup')).toBeNull()
  })
})
