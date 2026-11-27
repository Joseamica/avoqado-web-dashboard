/**
 * «Mapa de lugares»: la vista previa enseña lo que verá la clienta y el editor explica cómo apagar casillas.
 */
import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import en from '@/locales/en/menu.json'
import es from '@/locales/es/menu.json'

import { ClassLayoutEditor, type LayoutConfig, type LayoutSpot } from '../ClassLayoutEditor'
import { ClassLayoutPreview } from '../ClassLayoutPreview'

// Guarda el texto por defecto de cada llave para comprobar que el editor trae el mismo que el español.
const porDefecto = vi.hoisted(() => new Map<string, string | undefined>())
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: { defaultValue?: string }) => {
      porDefecto.set(k, o?.defaultValue)
      return k
    },
  }),
}))

// El ejemplo es el «5» de un dado: el centro y las esquinas quedan, se apaga la casilla de en medio de cada orilla.
const AYUDA_ES =
  'Toca una casilla para quitarla y que el mapa quede como tu salón (por ejemplo, 3 × 3 con la casilla de en medio de cada orilla apagada, como un dado).'
const AYUDA_EN =
  'Tap a cell to remove it so the map matches your room (for example, a 3 × 3 with the middle cell of each edge switched off, like a die).'

const ON = new Set(['0-0', '0-2', '1-1', '2-0', '2-2'])

function dado(showInstructor = false): LayoutConfig {
  const spots: LayoutSpot[] = []
  let n = 1
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const enabled = ON.has(`${r}-${c}`)
      spots.push(
        enabled
          ? { id: String(n), row: r, col: c, label: String(n++), enabled }
          : { id: `disabled-${r}-${c}`, row: r, col: c, label: '', enabled },
      )
    }
  }
  return { iconType: 'mat', rows: 3, cols: 3, showInstructor, spots }
}

describe('ClassLayoutPreview', () => {
  it('enseña los lugares 1 a 5 en orden y 4 huecos, sin franja del frente', () => {
    render(<ClassLayoutPreview layout={dado()} />)
    expect(screen.getByText('layout.previewTitle')).toBeTruthy()
    const numeros = screen.getAllByTestId('lugar').map(el => el.textContent)
    expect(numeros).toEqual(['1', '2', '3', '4', '5'])
    expect(screen.getAllByTestId('hueco')).toHaveLength(4)
    expect(screen.queryByText('layout.previewFront')).toBeNull()
  })

  it('con showInstructor pone la franja del frente', () => {
    render(<ClassLayoutPreview layout={dado(true)} />)
    expect(screen.getByText('layout.previewFront')).toBeTruthy()
  })

  it('no tiene casillas que se toquen', () => {
    const { container } = render(<ClassLayoutPreview layout={dado()} />)
    expect(within(container).queryAllByRole('button')).toHaveLength(0)
  })
})

describe('ClassLayoutEditor — ayuda', () => {
  it('con el mapa prendido muestra cómo apagar casillas y la vista previa', () => {
    render(<ClassLayoutEditor value={dado()} onChange={() => {}} />)
    expect(screen.getByText('layout.toggleHint')).toBeTruthy()
    expect(screen.getByText('layout.previewTitle')).toBeTruthy()
  })

  it('la ayuda describe bien el ejemplo del dado, en español, en inglés y en el texto por defecto', () => {
    render(<ClassLayoutEditor value={dado()} onChange={() => {}} />)
    expect(es.layout.toggleHint).toBe(AYUDA_ES)
    expect(en.layout.toggleHint).toBe(AYUDA_EN)
    expect(porDefecto.get('layout.toggleHint')).toBe(AYUDA_ES)
  })
})
