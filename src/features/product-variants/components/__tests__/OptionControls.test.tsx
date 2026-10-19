import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) =>
      o?.count !== undefined ? `${k}:${o.count}` : o?.name !== undefined ? `${k}:${o.name}` : o?.total !== undefined ? `${k}:${o.total}` : k,
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/services/productGroups.service', () => ({ listOptionLibrary: vi.fn() }))

import * as svc from '@/services/productGroups.service'
import { OptionLibraryPicker } from '../OptionLibraryPicker'
import { OptionValuesInput } from '../OptionValuesInput'

const opcion = (id: string, name: string, values: string[]) => ({
  id, name, valuesTotal: values.length, valuesTruncated: false, values: values.map((value, sortOrder) => ({ id: `${id}-${sortOrder}`, value, sortOrder })),
})
const pagina = (items: ReturnType<typeof opcion>[], total = items.length, page = 1) => ({ items, total, page, pageSize: 25 })

function Valores() {
  const [v, setV] = useState<string[]>([])
  return (
    <>
      <OptionValuesInput aria-label="valores" values={v} onChange={setV} />
      <output data-testid="valores">{JSON.stringify(v)}</output>
    </>
  )
}
const valores = () => JSON.parse(screen.getByTestId('valores').textContent!)

describe('OptionValuesInput', () => {
  it('Enter y coma agregan, pegar «S, M, L» agrega tres y Retroceso en vacío quita el último', () => {
    render(<Valores />)
    const input = screen.getByLabelText('valores')
    fireEvent.change(input, { target: { value: 'XS' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    fireEvent.change(input, { target: { value: 'S, M, L' } })
    expect(valores()).toEqual(['XS', 'S', 'M', 'L'])
    fireEvent.keyDown(input, { key: 'Backspace' })
    expect(valores()).toEqual(['XS', 'S', 'M'])
    fireEvent.click(screen.getByRole('button', { name: 'opciones.quitarValor:S' }))
    expect(valores()).toEqual(['XS', 'M'])
  })
})

describe('OptionLibraryPicker', () => {
  beforeEach(() => {
    vi.mocked(svc.listOptionLibrary).mockReset()
  })
  const montar = (onPick = vi.fn()) => {
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } })}>
        <OptionLibraryPicker venueId="v1" onPick={onPick} />
      </QueryClientProvider>,
    )
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.picker.usar' }))
    return onPick
  }

  it('elegir una opción guardada entrega nombre y valores y cierra la lista', async () => {
    vi.mocked(svc.listOptionLibrary).mockResolvedValue(pagina([opcion('o1', 'Talla', ['S', 'M']), opcion('o2', 'Color', ['Rojo'])]))
    const onPick = montar()
    expect(screen.getByText('biblioteca.picker.cargando')).toBeInTheDocument()
    fireEvent.click(await screen.findByRole('button', { name: /Talla/ }))
    expect(onPick).toHaveBeenCalledWith({ name: 'Talla', values: ['S', 'M'] })
    await waitFor(() => expect(screen.queryByText('Color')).not.toBeInTheDocument())
  })

  it('vacío y error se distinguen; el error ofrece reintentar', async () => {
    vi.mocked(svc.listOptionLibrary).mockRejectedValue(new Error('boom'))
    montar()
    expect(await screen.findByText('biblioteca.picker.error')).toBeInTheDocument()
    vi.mocked(svc.listOptionLibrary).mockResolvedValue(pagina([]))
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.picker.reintentar' }))
    expect(await screen.findByText('biblioteca.picker.vacia')).toBeInTheDocument()
  })

  it('con más páginas muestra «Cargar más» con lo que falta', async () => {
    vi.mocked(svc.listOptionLibrary).mockResolvedValue(pagina([opcion('o1', 'Talla', ['S'])], 30))
    montar()
    expect(await screen.findByRole('button', { name: 'biblioteca.picker.cargarMas:29' })).toBeInTheDocument()
  })

  it('una opción con más valores de los que trae la lista lo dice (no se trunca en silencio)', async () => {
    vi.mocked(svc.listOptionLibrary).mockResolvedValue(
      pagina([{ ...opcion('o1', 'Talla', ['S', 'M']), valuesTotal: 130, valuesTruncated: true }, opcion('o2', 'Color', ['Rojo'])]),
    )
    montar()
    expect(await screen.findByText('biblioteca.picker.truncada:130')).toBeInTheDocument()
    expect(screen.getAllByText(/biblioteca\.picker\.truncada/)).toHaveLength(1) // sólo la que viene truncada
  })

  it('si «Cargar más» falla, la lista ya cargada se queda, con aviso y reintento abajo', async () => {
    vi.mocked(svc.listOptionLibrary).mockResolvedValueOnce(pagina([opcion('o1', 'Talla', ['S'])], 30)).mockRejectedValue(new Error('boom'))
    montar()
    fireEvent.click(await screen.findByRole('button', { name: 'biblioteca.picker.cargarMas:29' }))
    expect(await screen.findByText('biblioteca.picker.errorMas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Talla/ })).toBeInTheDocument()
    expect(screen.queryByText('biblioteca.picker.error')).not.toBeInTheDocument()
    vi.mocked(svc.listOptionLibrary).mockResolvedValue(pagina([opcion('o2', 'Color', ['Rojo'])], 30, 2))
    fireEvent.click(screen.getByRole('button', { name: 'biblioteca.picker.reintentar' }))
    expect(await screen.findByRole('button', { name: /Color/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Talla/ })).toBeInTheDocument()
    expect(screen.queryByText('biblioteca.picker.errorMas')).not.toBeInTheDocument()
  })
})
