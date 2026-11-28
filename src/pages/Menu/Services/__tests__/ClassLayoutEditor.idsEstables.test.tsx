/**
 * hz:nube0000:na7eb164: redibujar el mapa no le cambia la casilla a una reserva. Las reservas guardan el `id`
 * de la casilla; el número a la vista se puede recorrer, el `id` no.
 */
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ClassLayoutEditor, type LayoutConfig, type LayoutSpot } from '../ClassLayoutEditor'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

// Un mapa 3 × 3 recién dibujado: ids y números del 1 al 9, como lo genera el editor.
const dado = (): LayoutConfig => ({
  iconType: 'mat',
  rows: 3,
  cols: 3,
  spots: Array.from({ length: 9 }, (_, i) => ({ id: String(i + 1), row: Math.floor(i / 3), col: i % 3, label: String(i + 1), enabled: true })),
})
const en = (spots: LayoutSpot[], row: number, col: number) => spots.find(s => s.row === row && s.col === col)!

function editar(layout: LayoutConfig) {
  const onChange = vi.fn()
  const utils = render(<ClassLayoutEditor value={layout} onChange={onChange} />)
  const casilla = (row: number, col: number) => {
    // Cada casilla es un botón en orden de fila; el índice es fila × columnas + columna.
    const botones = utils.container.querySelectorAll('[data-spot-cell]')
    return botones[row * layout.cols + col] as HTMLElement
  }
  return { onChange, casilla, ...utils }
}

describe('Mapa de lugares: ids estables', () => {
  it('apagar una casilla anterior NO mueve la casilla de quien reservó el lugar 5', () => {
    const { onChange, casilla } = editar(dado())
    fireEvent.click(casilla(0, 1)) // apaga la de en medio de la orilla de arriba
    const spots: LayoutSpot[] = onChange.mock.calls[0][0].spots
    // La casilla (1,1) era el id «5»: sigue siendo «5» y su número a la vista ahora es «4».
    expect(en(spots, 1, 1)).toMatchObject({ id: '5', label: '4', enabled: true })
    // Y ninguna otra casilla tomó el id «5».
    expect(spots.filter(s => s.id === '5')).toHaveLength(1)
    // La apagada guarda su id por si se vuelve a prender, sin número.
    expect(en(spots, 0, 1)).toMatchObject({ id: '2', label: '', enabled: false })
  })

  it('los ids nunca se repiten, aunque se prenda una casilla de un mapa viejo («disabled-…»)', () => {
    const viejo = dado()
    viejo.spots[1] = { ...viejo.spots[1], id: 'disabled-0-1', label: '', enabled: false }
    const { onChange, casilla } = editar(viejo)
    fireEvent.click(casilla(0, 1))
    const spots: LayoutSpot[] = onChange.mock.calls[0][0].spots
    expect(en(spots, 0, 1)).toMatchObject({ id: 'r0c1', enabled: true })
    expect(new Set(spots.map(s => s.id)).size).toBe(spots.length)
  })
})
