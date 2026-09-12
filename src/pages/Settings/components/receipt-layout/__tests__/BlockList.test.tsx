import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BlockList } from '@/pages/Settings/components/receipt-layout/BlockList'
import type { ReceiptBlock } from '@/services/receiptLayout.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const bloques: ReceiptBlock[] = [
  { type: 'logo', size: 'M', align: 'center' },
  { type: 'fiscal', align: 'center' },
  { type: 'orderInfo', showOrderType: true },
  { type: 'items', showModifiers: true, showNotes: true },
  { type: 'totals', showSubtotal: true, showTax: true, showDiscount: true, showTip: true },
  { type: 'payment', showChange: true, showCardLastFour: true },
  { type: 'areaDelivery' },
  { type: 'signature' },
]

const props = () => ({ blocks: bloques, onReorder: vi.fn(), onRemove: vi.fn(), onSelect: vi.fn() })

describe('BlockList', () => {
  it('🔴 un bloque obligatorio NO se puede quitar, pero SÍ se ve y dice por qué', () => {
    render(<BlockList {...props()} />)
    // Esconderlo sería peor: el dueño no entendería por qué su ticket trae algo que él no puso.
    expect(screen.getByTestId('block-row-fiscal')).toBeInTheDocument()
    expect(screen.queryByTestId('block-remove-fiscal')).toBeNull()
    expect(screen.getByTestId('block-lock-fiscal')).toHaveAttribute('data-lock', 'legal')
  })

  it('🔴 las tres clases de candado llevan letra distinta: «lo exige la ley» no vale para todo', () => {
    render(<BlockList {...props()} />)
    expect(screen.getByTestId('block-lock-fiscal')).toHaveTextContent('L')
    expect(screen.getByTestId('block-lock-payment')).toHaveTextContent('O')
    expect(screen.getByTestId('block-lock-signature')).toHaveTextContent('P')
  })

  it('🔴 el candado NO se comunica sólo con color: lleva icono, letra y una explicación', () => {
    render(<BlockList {...props()} />)
    const candado = screen.getByTestId('block-lock-fiscal')
    expect(candado.querySelector('svg')).toBeTruthy()
    expect(candado).toHaveAccessibleName('locks.legal')
  })

  it('🔴 la firma no se puede mover de su lugar: su botón de subir está DESHABILITADO, no escondido', () => {
    render(<BlockList {...props()} />)
    // El servidor rechaza con RECEIPT_LAYOUT_SIGNATURE_NOT_LAST. Esconder el botón dejaría al
    // dueño buscándolo; deshabilitarlo con su explicación le dice que ahí no hay nada que hacer.
    expect(screen.getByTestId('block-up-signature')).toBeDisabled()
  })

  it('🔴 el bloque de ENCIMA de la firma tampoco puede bajar: la empujaría de su sitio', () => {
    render(<BlockList {...props()} />)
    expect(screen.getByTestId('block-down-areaDelivery')).toBeDisabled()
  })

  it('el primero no puede subir y el último no puede bajar', () => {
    render(<BlockList {...props()} />)
    expect(screen.getByTestId('block-up-logo')).toBeDisabled()
    expect(screen.getByTestId('block-down-signature')).toBeDisabled()
  })

  it('reordenar avisa con los índices, no con el arreglo entero', async () => {
    const p = props()
    render(<BlockList {...p} />)
    await userEvent.click(screen.getByTestId('block-down-logo'))
    expect(p.onReorder).toHaveBeenCalledWith(0, 1)
  })

  it('un bloque opcional sí se quita, y avisa con su índice', async () => {
    const p = props()
    render(<BlockList {...p} />)
    await userEvent.click(screen.getByTestId('block-remove-logo'))
    expect(p.onRemove).toHaveBeenCalledWith(0)
  })

  it('la fila entera selecciona, pero un control no dispara la selección', async () => {
    const p = props()
    render(<BlockList {...p} />)
    await userEvent.click(screen.getByTestId('block-row-logo'))
    expect(p.onSelect).toHaveBeenCalledWith(0)
    p.onSelect.mockClear()
    await userEvent.click(screen.getByTestId('block-down-logo'))
    expect(p.onSelect).not.toHaveBeenCalled()
  })

  it('🔴 en sólo lectura no queda un solo control que prometa algo que no se puede hacer', () => {
    render(<BlockList {...props()} readOnly />)
    // Se ELIMINAN, no se deshabilitan: un botón apagado sugiere «podrías si…», y sin permiso la
    // respuesta es «no puedes» — eso se dice UNA vez arriba, no en cada renglón.
    expect(screen.queryByTestId('block-remove-logo')).toBeNull()
    expect(screen.queryByTestId('block-down-logo')).toBeNull()
    expect(screen.queryByTestId('block-up-logo')).toBeNull()
    // Los candados SÍ se quedan: explican el ticket, no ofrecen una acción.
    expect(screen.getByTestId('block-lock-fiscal')).toBeInTheDocument()
  })

  it('un tipo que este dashboard no conoce se ve y se puede mover, nunca revienta la pantalla', () => {
    const conDesconocido = [{ type: 'bloqueDelFuturo' } as ReceiptBlock, ...bloques]
    render(<BlockList {...props()} blocks={conDesconocido} />)
    expect(screen.getByTestId('block-row-bloqueDelFuturo')).toBeInTheDocument()
    expect(screen.getByText('blocks.unknown')).toBeInTheDocument()
  })

  it('el renglón resume sus opciones: no hay que abrir cada bloque para saber cómo está', () => {
    render(<BlockList {...props()} />)
    expect(screen.getByTestId('block-row-logo')).toHaveTextContent('summary.size.M')
  })
})
