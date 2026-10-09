import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
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

  it('Espacio pone la mano para mover el plano, pero no le roba la tecla a un botón con el foco', async () => {
    render(
      <>
        <button type="button">Guardar</button>
        <FloorCanvas {...props()} />
      </>,
    )
    const canvas = screen.getByTestId('floor-canvas')
    // Sobre un botón al que se llegó con el TECLADO (Tab): la barra lo sigue accionando y no aparece la mano.
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.tab()
    expect(guardar).toHaveFocus()
    expect(fireEvent.keyDown(guardar, { code: 'Space' })).toBe(true)
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

  it('Espacio no le roba el clic a un botón con el foco aunque el puntero esté sobre el plano', async () => {
    render(
      <>
        <button type="button">Guardar</button>
        <FloorCanvas {...props()} />
      </>,
    )
    const canvas = screen.getByTestId('floor-canvas')
    fireEvent.pointerEnter(canvas)
    fireEvent.pointerMove(canvas)
    const guardar = screen.getByRole('button', { name: 'Guardar' })
    await userEvent.tab() // foco por teclado (:focus-visible)
    expect(guardar).toHaveFocus()
    expect(fireEvent.keyDown(guardar, { code: 'Space' })).toBe(true)
    expect(canvas.getAttribute('class')).not.toContain('cursor-grab')
  })

  it('Safari: el pellizco del trackpad (gesturechange) acerca', () => {
    render(<FloorCanvas {...props()} />)
    const canvas = screen.getByTestId('floor-canvas')
    fireEvent(canvas, Object.assign(new Event('gesturestart', { cancelable: true }), { scale: 1 }))
    fireEvent(canvas, Object.assign(new Event('gesturechange', { cancelable: true }), { scale: 2, clientX: 0, clientY: 0 }))
    expect(Number(canvas.getAttribute('viewBox')?.split(' ')[2])).toBeCloseTo(22, 5)
  })

  it('explica el punto ámbar con una leyenda, sólo si alguna mesa del área tiene cuenta abierta', () => {
    const { rerender } = render(<FloorCanvas {...props()} />)
    expect(screen.queryByTestId('floor-canvas-open-legend')).not.toBeInTheDocument()
    rerender(<FloorCanvas {...props({ tables: [{ ...table, hasOpenOrder: true }] })} />)
    expect(screen.getByTestId('floor-canvas-open-legend')).toHaveTextContent('canvas.openOrderLegend')
    // Con una herramienta en la mano, la instrucción tiene el lugar (a 1280 px la leyenda la recortaba).
    rerender(<FloorCanvas {...props({ tables: [{ ...table, hasOpenOrder: true }], tool: 'table:SQUARE' })} />)
    expect(screen.queryByTestId('floor-canvas-open-legend')).not.toBeInTheDocument()
  })

  // Pasada en vivo (9-oct): con «Cuadrada» en la mano el puntero era sólo una cruz; la mesa se ponía a ciegas.
  it('con una pieza de la paleta en la mano enseña dónde caería bajo el puntero; sin herramienta, no', () => {
    const { rerender } = render(<FloorCanvas {...props({ tool: 'table:ROUND' })} />)
    const canvas = screen.getByTestId('floor-canvas')
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 })
    const preview = screen.getByTestId('floor-place-preview')
    // jsdom no tiene getScreenCTM: el puntero cae en (0, 0) y la mesa redonda de 4 (4 × 4) se mete al lienzo.
    expect(preview.querySelector('circle')).toHaveAttribute('cx', '2')
    rerender(<FloorCanvas {...props({ tool: 'BAR_COUNTER' })} />)
    expect(screen.getByTestId('floor-place-preview').querySelector('rect')).toHaveAttribute('width', '8')
    fireEvent.pointerLeave(canvas)
    expect(screen.queryByTestId('floor-place-preview')).not.toBeInTheDocument()
    fireEvent.pointerMove(canvas, { clientX: 10, clientY: 10 })
    rerender(<FloorCanvas {...props({ tool: 'select' })} />)
    expect(screen.queryByTestId('floor-place-preview')).not.toBeInTheDocument()
  })

  it('el lienzo tiene nombre accesible', () => {
    render(<FloorCanvas {...props()} />)
    expect(screen.getByRole('img', { name: 'canvas.label' })).toBe(screen.getByTestId('floor-canvas'))
  })
  it('I3: un botón que quedó con el foco por el RATÓN (sin :focus-visible) no se queda con Espacio: es la mano', async () => {
    const user = userEvent.setup()
    render(
      <>
        <button type="button">Menú</button>
        <FloorCanvas {...props()} />
      </>,
    )
    const menu = screen.getByRole('button', { name: 'Menú' })
    await user.click(menu) // p. ej. Radix regresa el foco al disparador tras cerrar un menú con el ratón
    expect(menu).toHaveFocus()
    expect(fireEvent.keyDown(menu, { code: 'Space' })).toBe(false)
    expect(screen.getByTestId('floor-canvas').getAttribute('class')).toContain('cursor-grab')
    fireEvent.keyUp(menu, { code: 'Space' })
  })

  // m2 de 15-D: «¿Salir sin guardar?» y «Nueva área» se abren encima del editor (fuera de su diálogo). Con el foco en uno de
  // sus botones por el ratón, el lienzo tomaba Espacio para la mano y el botón no se pulsaba.
  it('D7: Espacio es del botón de un diálogo encimado aunque tenga el foco por el ratón; en el diálogo del lienzo sigue siendo la mano', async () => {
    const user = userEvent.setup()
    render(
      <>
        <div role="dialog">
          <button type="button">Acercar</button>
          <FloorCanvas {...props()} />
        </div>
        <div role="alertdialog">
          <button type="button">Seguir editando</button>
        </div>
      </>,
    )
    const canvas = screen.getByTestId('floor-canvas')
    const seguir = screen.getByRole('button', { name: 'Seguir editando' })
    await user.click(seguir)
    expect(fireEvent.keyDown(seguir, { code: 'Space' })).toBe(true)
    expect(canvas.getAttribute('class')).not.toContain('cursor-grab')
    fireEvent.keyUp(seguir, { code: 'Space' })
    // El mismo caso dentro del diálogo del propio lienzo (el editor): sigue siendo la mano (I3).
    const acercar = screen.getByRole('button', { name: 'Acercar' })
    await user.click(acercar)
    expect(fireEvent.keyDown(acercar, { code: 'Space' })).toBe(false)
    expect(canvas.getAttribute('class')).toContain('cursor-grab')
    fireEvent.keyUp(acercar, { code: 'Space' })
  })

  // m4: el menú «···» del área y el selector de área (Radix) se dibujan FUERA del diálogo del editor.
  it('m4: Espacio es de la opción de un menú o una lista encimados aunque tenga el foco por el ratón', async () => {
    const user = userEvent.setup()
    render(
      <>
        <div role="dialog">
          <FloorCanvas {...props()} />
        </div>
        <div role="menu">
          <div role="menuitem" tabIndex={-1}>
            Cambiar nombre
          </div>
        </div>
        <div role="listbox">
          <div role="option" aria-selected="false" tabIndex={-1}>
            Terraza
          </div>
        </div>
      </>,
    )
    const canvas = screen.getByTestId('floor-canvas')
    for (const item of [screen.getByRole('menuitem'), screen.getByRole('option')]) {
      await user.click(item)
      expect(item).toHaveFocus()
      expect(fireEvent.keyDown(item, { code: 'Space' })).toBe(true)
      expect(canvas.getAttribute('class')).not.toContain('cursor-grab')
      fireEvent.keyUp(item, { code: 'Space' })
    }
  })
})
