import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FloorCanvas, type FloorCanvasProps } from '../FloorCanvas'
import type { DraftArea, DraftTable } from '../../model/types'

// i18n autocontenido: devuelve la llave, como el resto de las pruebas del repo.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: { count?: number }) => (o?.count !== undefined ? `${key}:${o.count}` : key), i18n: { language: 'es' } }),
}))

// Arrastrar, recuadro y paredes necesitan `getScreenCTM`, que jsdom no tiene: los cubre Playwright (tarea 13).
// Aquí sólo lo que no depende de coordenadas de pantalla.

const area: DraftArea = { key: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false }
const table: DraftTable = { key: 't1', number: '1', capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'a1', x: 10, y: 10, legacy: null, hasOpenOrder: false }

const props = (extra: Partial<FloorCanvasProps> = {}): FloorCanvasProps => ({
  area,
  tables: [table],
  elements: [],
  selection: [],
  tool: 'select',
  onSelect: () => {},
  onMove: () => {},
  onPlaceTool: () => {},
  onCreateWall: () => {},
  onPlaceTable: () => {},
  onToolDone: () => {},
  ...extra,
})

describe('FloorCanvas', () => {
  it('se dibuja con el área completa a la vista y sus mesas', () => {
    render(<FloorCanvas {...props()} />)
    expect(screen.getByTestId('floor-canvas')).toHaveAttribute('viewBox', '-2 -2 44 29')
    expect(screen.getByTestId('floor-table-1')).toHaveAttribute('data-floor-key', 't1')
  })

  it('acercar y «ver todo» cambian la vista alrededor del centro', () => {
    render(<FloorCanvas {...props()} />)
    const canvas = screen.getByTestId('floor-canvas')
    fireEvent.click(screen.getByRole('button', { name: 'canvas.zoomIn' }))
    expect(canvas).toHaveAttribute('viewBox', '2.4 0.9 35.2 23.2')
    fireEvent.click(screen.getByRole('button', { name: 'canvas.fit' }))
    expect(canvas).toHaveAttribute('viewBox', '-2 -2 44 29')
  })

  it('al cambiar de área vuelve a la vista completa de la nueva', () => {
    const { rerender } = render(<FloorCanvas {...props()} />)
    fireEvent.click(screen.getByRole('button', { name: 'canvas.zoomIn' }))
    rerender(<FloorCanvas {...props({ area: { ...area, key: 'a2', floorShape: 'SQUARE' }, tables: [] })} />)
    expect(screen.getByTestId('floor-canvas')).toHaveAttribute('viewBox', '-2 -2 44 44')
  })

  it('con una herramienta activa enseña cómo usarla', () => {
    const { rerender } = render(<FloorCanvas {...props()} />)
    expect(screen.queryByText('tools.wallHint')).not.toBeInTheDocument()
    rerender(<FloorCanvas {...props({ tool: 'WALL' })} />)
    expect(screen.getByText('tools.wallHint')).toBeInTheDocument()
    rerender(<FloorCanvas {...props({ tool: 'table:ROUND' })} />)
    expect(screen.getByText('tools.placeHint')).toBeInTheDocument()
  })

  it('Espacio pone la mano para mover el plano, pero no le roba la tecla a un botón con el foco', () => {
    render(
      <>
        <button type="button">Guardar</button>
        <FloorCanvas {...props()} />
      </>,
    )
    const canvas = screen.getByTestId('floor-canvas')
    // Sobre un botón: la barra lo sigue accionando (no se cancela) y no aparece la mano.
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'Guardar' }), { code: 'Space' })).toBe(true)
    expect(canvas.getAttribute('class')).not.toContain('cursor-grab')
    // Sin un control con el foco: Espacio es la mano.
    expect(fireEvent.keyDown(document.body, { code: 'Space' })).toBe(false)
    expect(canvas.getAttribute('class')).toContain('cursor-grab')
    fireEvent.keyUp(document.body, { code: 'Space' })
    expect(canvas.getAttribute('class')).not.toContain('cursor-grab')
  })
  it('H1: el zoom vive en una barra DEBAJO del dibujo (no encima de una esquina) y dice el porcentaje', () => {
    render(<FloorCanvas {...props()} />)
    const bar = screen.getByTestId('floor-canvas-bar')
    expect(screen.getByTestId('floor-canvas').contains(bar)).toBe(false)
    expect(bar).toContainElement(screen.getByRole('button', { name: 'canvas.zoomIn' }))
    expect(screen.getByTestId('floor-canvas-zoom')).toHaveTextContent('100%')
    fireEvent.click(screen.getByRole('button', { name: 'canvas.zoomIn' }))
    expect(screen.getByTestId('floor-canvas-zoom')).toHaveTextContent('125%')
  })

  it('H4: avisa de mesas encimadas y al tocar el aviso las selecciona', () => {
    const onSelect = vi.fn()
    render(<FloorCanvas {...props({ tables: [table, { ...table, key: 't2', number: '2', x: 11 }], onSelect })} />)
    fireEvent.click(screen.getByTestId('floor-canvas-overlap'))
    expect(screen.getByTestId('floor-canvas-overlap')).toHaveTextContent('canvas.overlap:2')
    expect(onSelect).toHaveBeenCalledWith(['t1', 't2'])
    expect(screen.getByTestId('floor-table-2').querySelector('rect')?.getAttribute('class')).toContain('stroke-warning')
  })

  it('un clic sin mover sobre una pieza de una selección de varias la deja sola a ella', () => {
    const onSelect = vi.fn()
    const onMove = vi.fn()
    Element.prototype.setPointerCapture = () => {}
    render(<FloorCanvas {...props({ tables: [table, { ...table, key: 't2', number: '2', x: 30 }], selection: ['t1', 't2'], onSelect, onMove })} />)
    fireEvent.pointerDown(screen.getByTestId('floor-table-2'), { button: 0, pointerId: 1 })
    fireEvent.pointerUp(screen.getByTestId('floor-canvas'), { button: 0, pointerId: 1 })
    expect(onSelect).toHaveBeenCalledWith(['t2'])
    expect(onMove).not.toHaveBeenCalled()
  })

  it('Espacio no le roba el clic a un botón con el foco aunque el puntero esté sobre el plano', () => {
    render(
      <>
        <button type="button">Guardar</button>
        <FloorCanvas {...props()} />
      </>,
    )
    const canvas = screen.getByTestId('floor-canvas')
    fireEvent.pointerEnter(canvas)
    fireEvent.pointerMove(canvas)
    expect(fireEvent.keyDown(screen.getByRole('button', { name: 'Guardar' }), { code: 'Space' })).toBe(true)
    expect(canvas.getAttribute('class')).not.toContain('cursor-grab')
  })

  it('Safari: el pellizco del trackpad (gesturechange) acerca', () => {
    render(<FloorCanvas {...props()} />)
    const canvas = screen.getByTestId('floor-canvas')
    fireEvent(canvas, Object.assign(new Event('gesturestart', { cancelable: true }), { scale: 1 }))
    fireEvent(canvas, Object.assign(new Event('gesturechange', { cancelable: true }), { scale: 2, clientX: 0, clientY: 0 }))
    expect(Number(canvas.getAttribute('viewBox')?.split(' ')[2])).toBeCloseTo(22, 5)
  })

  it('el lienzo tiene nombre accesible', () => {
    render(<FloorCanvas {...props()} />)
    expect(screen.getByRole('img', { name: 'canvas.label' })).toBe(screen.getByTestId('floor-canvas'))
  })
})
