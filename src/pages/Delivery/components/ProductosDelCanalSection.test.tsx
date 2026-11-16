// src/pages/Delivery/components/ProductosDelCanalSection.test.tsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import es from '@/locales/es/delivery.json'
import en from '@/locales/en/delivery.json'
import type { ProductoDelCanal } from '../productosDelCanal'

// t devuelve la llave tal cual (convención del repo).
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { ProductosDelCanalSection } from './ProductosDelCanalSection'

const p = (id: string, name: string, categoria: string | null, extra: Partial<ProductoDelCanal> = {}): ProductoDelCanal => ({
  id,
  sku: `C-${id}`,
  name,
  price: 50,
  active: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  categoryId: categoria ?? '',
  category: categoria ? { name: categoria } : null,
  ...extra,
})

function renderSeccion(over: Partial<Parameters<typeof ProductosDelCanalSection>[0]> = {}) {
  const props = {
    provider: 'UBER_EATS' as const,
    canal: 'Uber Eats',
    productos: [p('p1', 'Latte', 'Bebidas'), p('p2', 'Té', 'Bebidas'), p('p3', 'Galleta', null)],
    cargando: false,
    error: false,
    onReintentar: vi.fn(),
    lista: ['p1'] as string[] | null,
    onListaChange: vi.fn(),
    precios: {},
    onPreciosChange: vi.fn(),
    nuevos: [],
    yaNoExisten: { ids: [], codigos: [] },
    onQuitarQueYaNoExisten: vi.fn(),
    onYaRevisados: vi.fn(),
    revisando: false,
    ...over,
  }
  render(<ProductosDelCanalSection {...props} />)
  return props
}

describe('ProductosDelCanalSection', () => {
  it('los textos que el founder fijó van tal cual', () => {
    expect(es.settings.productos.listaVacia).toBe('Un canal necesita al menos un producto; pausa el canal si no quieres vender ahí')
    expect(es.settings.conflicto).toBe('Alguien cambió este canal mientras lo editabas. Recarga y vuelve a guardar.')
    expect(en.settings.productos.listaVacia).toBeTruthy()
    expect(en.settings.conflicto).toBeTruthy()
  })

  it('agrupa por categoría con «Sin categoría» al final', () => {
    renderSeccion()
    const titulos = screen.getAllByTestId('grupo-titulo').map(n => n.textContent)
    expect(titulos[0]).toContain('Bebidas')
    expect(titulos[1]).toContain('settings.productos.sinCategoria')
  })

  it('busca por nombre sin acentos y por código', () => {
    renderSeccion()
    const buscar = screen.getByLabelText('settings.productos.buscar')
    fireEvent.change(buscar, { target: { value: 'te' } })
    expect(screen.getByRole('checkbox', { name: 'Té' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Galleta' })).not.toBeInTheDocument()

    fireEvent.change(buscar, { target: { value: 'C-p3' } })
    expect(screen.getByRole('checkbox', { name: 'Galleta' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Latte' })).not.toBeInTheDocument()
  })

  it('«Todos» de una categoría marca sólo los que se ven con el filtro', () => {
    const props = renderSeccion({ lista: ['p3'] })
    fireEvent.change(screen.getByLabelText('settings.productos.buscar'), { target: { value: 'latte' } })
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'settings.productos.todosDe' })[0])
    expect(props.onListaChange).toHaveBeenCalledWith(['p3', 'p1'])
  })

  it('«Todos» con todos los visibles marcados los quita', () => {
    const props = renderSeccion({ lista: ['p1', 'p2', 'p3'] })
    fireEvent.click(screen.getAllByRole('checkbox', { name: 'settings.productos.todosDe' })[0])
    expect(props.onListaChange).toHaveBeenCalledWith(['p3'])
  })

  it('con más de 300 productos las categorías arrancan cerradas y se abren con un toque', () => {
    const muchos = Array.from({ length: 301 }, (_, i) => p(`p${i}`, `Producto ${i}`, 'Bebidas'))
    renderSeccion({ productos: muchos, lista: [] })
    expect(screen.queryByRole('checkbox', { name: 'Producto 7' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByTestId('grupo-titulo'))
    expect(screen.getByRole('checkbox', { name: 'Producto 7' })).toBeInTheDocument()
  })

  it('«Revisarlos» deja a la vista sólo los nuevos y «Ver todos» regresa', () => {
    const nuevo = p('p2', 'Té', 'Bebidas', { createdAt: '2026-07-01T00:00:00.000Z' })
    renderSeccion({ nuevos: [nuevo] })
    fireEvent.click(screen.getByText('settings.productos.revisarlos'))
    expect(screen.getByRole('checkbox', { name: 'Té' })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Latte' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByText('settings.productos.verTodos'))
    expect(screen.getByRole('checkbox', { name: 'Latte' })).toBeInTheDocument()
  })

  it('«Ya los revisé» se apaga mientras se guarda', () => {
    renderSeccion({ nuevos: [p('p2', 'Té', 'Bebidas')], revisando: true })
    expect((screen.getByText('settings.productos.yaLosRevise').closest('button') as HTMLButtonElement).disabled).toBe(true)
  })

  it('el aviso de lo que ya no existe cuenta ids y códigos, y dice que los códigos se quitan solos', () => {
    const props = renderSeccion({ yaNoExisten: { ids: ['pX'], codigos: ['VIEJO'] } })
    expect(screen.getByText('settings.productos.yaNoExisten')).toBeInTheDocument()
    expect(screen.getByText('settings.productos.yaNoExistenCodigos')).toBeInTheDocument()
    fireEvent.click(screen.getByText('settings.productos.quitarlos'))
    expect(props.onQuitarQueYaNoExisten).toHaveBeenCalled()
  })

  it('sin lista: dice que publica todo el catálogo y no pinta casillas', () => {
    renderSeccion({ lista: null })
    expect(screen.getByText('settings.productos.todoElCatalogo')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: 'Latte' })).not.toBeInTheDocument()
  })

  it('cargando, error y lista se distinguen', () => {
    renderSeccion({ cargando: true })
    expect(screen.getByText('settings.productos.cargando')).toBeInTheDocument()
  })

  it('si el catálogo no carga lo dice y deja reintentar (no finge «0 productos»)', () => {
    const props = renderSeccion({ error: true, productos: [] })
    expect(screen.queryByText('settings.productos.todoElCatalogo')).not.toBeInTheDocument()
    fireEvent.click(screen.getByText('settings.productos.reintentar'))
    expect(props.onReintentar).toHaveBeenCalled()
  })

  it('el precio vacío llega como `undefined` (el campo se puede vaciar)', () => {
    const props = renderSeccion({ precios: { p1: 70 } })
    fireEvent.change(screen.getByLabelText('settings.productos.precioDe'), { target: { value: '' } })
    expect(props.onPreciosChange).toHaveBeenCalledWith({ p1: undefined })
  })
})
