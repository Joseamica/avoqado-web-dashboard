import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => (o?.count !== undefined ? `${k}:${o.count}` : o?.name !== undefined ? `${k}:${o.name}` : k),
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/services/productGroups.service', () => ({ listOptionLibrary: vi.fn() }))

import { limpiarOpciones, sincronizarFilas } from '../../combinations'
import { VARIANTES_INICIALES, VariantsSection, type ValorVariantes } from '../VariantsSection'

function Arnes({ inicial = VARIANTES_INICIALES }: { inicial?: ValorVariantes }) {
  const [v, setV] = useState(inicial)
  return (
    <QueryClientProvider client={new QueryClient()}>
      <VariantsSection venueId="v1" nombrePadre="Playera" value={v} onChange={setV} />
      <output data-testid="estado">{JSON.stringify(v.filas.map(f => [f.values.join('/'), f.price ?? null, f.incluida]))}</output>
    </QueryClientProvider>
  )
}
const estado = () => JSON.parse(screen.getByTestId('estado').textContent!)

describe('VariantsSection', () => {
  it('teclear una opción con valores separados por coma genera una fila por valor con su nombre', () => {
    render(<Arnes />)
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
    fireEvent.change(screen.getByLabelText('opciones.valores'), { target: { value: 'S, M,' } })
    expect(estado()).toEqual([['S', null, true], ['M', null, true]])
    expect(screen.getByText('Playera · S')).toBeInTheDocument()
    expect(screen.getByText('Playera · M')).toBeInTheDocument()
  })

  it('🔴 con 8,000 combinaciones no pinta la tabla y dice cuántas son', () => {
    const muchos = (n: number) => Array.from({ length: n }, (_, i) => `v${i}`)
    render(<Arnes inicial={{ ...VARIANTES_INICIALES, opciones: [{ name: 'A', values: muchos(40) }, { name: 'B', values: muchos(20) }, { name: 'C', values: muchos(10) }] }} />)
    expect(screen.getByText('validacion.demasiadasCombinaciones:8000')).toBeInTheDocument()
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('«Aplicar a todas» pone el precio en las filas incluidas y respeta las desmarcadas', () => {
    render(<Arnes />)
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
    fireEvent.change(screen.getByLabelText('opciones.valores'), { target: { value: 'S, M,' } })
    fireEvent.click(screen.getByLabelText('tabla.incluir:Playera · M'))
    fireEvent.change(screen.getByLabelText('tabla.precioTodas'), { target: { value: '199' } })
    fireEvent.click(screen.getByRole('button', { name: 'tabla.aplicarTodas' }))
    expect(estado()).toEqual([['S', 199, true], ['M', null, false]])
  })

  it('un precio se puede borrar por completo (vacío ⇒ sin precio, nunca 0)', () => {
    render(<Arnes />)
    fireEvent.change(screen.getByLabelText('opciones.nombre'), { target: { value: 'Talla' } })
    fireEvent.change(screen.getByLabelText('opciones.valores'), { target: { value: 'S,' } })
    const precio = screen.getByLabelText('tabla.precio:Playera · S')
    fireEvent.change(precio, { target: { value: '150' } })
    fireEvent.change(precio, { target: { value: '' } })
    expect(estado()).toEqual([['S', null, true]])
  })

  it('Enter en el nombre de la opción no envía el formulario que lo contiene', async () => {
    const enviar = vi.fn((e: { preventDefault: () => void }) => e.preventDefault())
    render(
      <form onSubmit={enviar}>
        <Arnes />
        <button type="submit">enviar</button>
      </form>,
    )
    const nombre = screen.getByLabelText('opciones.nombre')
    await userEvent.type(nombre, 'Talla{Enter}')
    expect(nombre).toHaveValue('Talla')
    expect(enviar).not.toHaveBeenCalled()
  })

  describe('🔴 desde una tabla válida, crecer por la interfaz hasta pasar de 250 no truena', () => {
    const muchos = (p: string, n: number) => Array.from({ length: n }, (_, i) => `${p}${i}`)
    const opciones = [{ name: 'A', values: muchos('a', 20) }, { name: 'B', values: muchos('b', 10) }]
    const valido: ValorVariantes = { ...VARIANTES_INICIALES, opciones, filas: sincronizarFilas(limpiarOpciones(opciones), []) }

    // Pinta cientos de renglones en jsdom: ~1-2 s sola, >5 s con la suite completa en una máquina cargada.
    it('una tercera opción que lleva el total a 600 avisa y esconde la tabla', { timeout: 20_000 }, () => {
      render(<Arnes inicial={valido} />)
      expect(estado()).toHaveLength(200)
      expect(screen.getByRole('table')).toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'opciones.agregar' }))
      expect(() => {
        fireEvent.change(screen.getAllByLabelText('opciones.nombre')[2], { target: { value: 'C' } })
        fireEvent.change(screen.getAllByLabelText('opciones.valores')[2], { target: { value: 'x, y, z,' } })
      }).not.toThrow()
      expect(screen.getByText('validacion.demasiadasCombinaciones:600')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
    })

    // Pinta cientos de renglones en jsdom: ~1-2 s sola, >5 s con la suite completa en una máquina cargada.
    it('agregar valores a una opción pasa de 250 (260), avisa y, al quitar uno, la tabla vuelve con 250', { timeout: 20_000 }, () => {
      render(<Arnes inicial={valido} />)
      expect(() => fireEvent.change(screen.getAllByLabelText('opciones.valores')[0], { target: { value: 'x1, x2, x3, x4, x5, x6,' } })).not.toThrow()
      expect(screen.getByText('validacion.demasiadasCombinaciones:260')).toBeInTheDocument()
      expect(screen.queryByRole('table')).not.toBeInTheDocument()
      fireEvent.click(screen.getByRole('button', { name: 'opciones.quitarValor:x6' }))
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(estado()).toHaveLength(250)
    })
  })
})
