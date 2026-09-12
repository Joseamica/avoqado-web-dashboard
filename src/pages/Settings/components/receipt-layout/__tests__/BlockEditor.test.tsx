import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { BlockEditor } from '@/pages/Settings/components/receipt-layout/BlockEditor'
import type { ReceiptBlock } from '@/services/receiptLayout.service'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.char ? `${k}:${o.char}` : k) }),
}))

const render1 = (block: ReceiptBlock, readOnly = false) => {
  const onChange = vi.fn()
  render(<BlockEditor block={block} onChange={onChange} readOnly={readOnly} />)
  return onChange
}

describe('BlockEditor', () => {
  it('un bloque sin opciones lo DICE: un panel vacío parece roto', () => {
    render1({ type: 'staff' })
    expect(screen.getByTestId('block-editor-staff-no-options')).toBeInTheDocument()
  })

  it('un tipo desconocido no revienta la pantalla', () => {
    render1({ type: 'bloqueDelFuturo' })
    expect(screen.getByTestId('block-editor-unknown')).toBeInTheDocument()
  })

  it('cambiar una opción avisa con el bloque COMPLETO, no sólo con el campo', async () => {
    const onChange = render1({ type: 'logo', size: 'M', align: 'center' })
    await userEvent.click(screen.getByTestId('block-size-logo-L'))
    expect(onChange).toHaveBeenCalledWith({ type: 'logo', size: 'L', align: 'center' })
  })

  it('sólo se ofrecen las opciones que el SERVIDOR acepta para ese tipo', () => {
    render1({ type: 'fiscal', align: 'center' })
    expect(screen.getByTestId('block-align-fiscal')).toBeInTheDocument()
    // `fiscal` no admite énfasis en el Zod del servidor: ofrecerlo daría un 400 al guardar.
    expect(screen.queryByTestId('block-emphasis-fiscal')).toBeNull()
  })

  it('🔴 el contador de caracteres se VE: el servidor rechaza en 49 con un 400', () => {
    render1({ type: 'qr', caption: 'Escanea para tu recibo' })
    expect(screen.getByText('22/48')).toBeInTheDocument()
  })

  it('🔴 pasarse de 48 se marca EN EL CAMPO, antes de guardar', () => {
    render1({ type: 'qr', caption: 'x'.repeat(49) })
    expect(screen.getByTestId('block-field-caption-qr-problem')).toHaveTextContent('tooLong')
    expect(screen.getByTestId('block-field-caption-qr')).toHaveAttribute('aria-invalid', 'true')
  })

  it('🔴 un emoji se marca en el campo y DICE cuál es', () => {
    render1({ type: 'qr', caption: 'Gracias 🙏' })
    expect(screen.getByTestId('block-field-caption-qr-problem')).toHaveTextContent('notPrintable.nonLatin1:🙏')
  })

  it('un texto correcto no marca nada', () => {
    render1({ type: 'qr', caption: 'Gracias por tu compra' })
    expect(screen.queryByTestId('block-field-caption-qr-problem')).toBeNull()
  })

  it('🔴 el TOTAL no se puede apagar, y el panel lo DICE en vez de esconderlo', () => {
    render1({ type: 'totals', showSubtotal: true, showTax: true, showDiscount: true, showTip: true })
    expect(screen.getByTestId('editor-always-prints')).toHaveTextContent('alwaysTotal')
    expect(screen.getByTestId('block-switch-showSubtotal')).toBeInTheDocument()
    // No hay interruptor del total: ofrecerlo y que el servidor lo ignore sería peor.
    expect(screen.queryByTestId('block-switch-showTotal')).toBeNull()
  })

  it('🔴 la autorización del cobro sale siempre, y el panel explica por qué', () => {
    render1({ type: 'payment', showChange: true, showCardLastFour: true })
    expect(screen.getByTestId('editor-always-prints')).toHaveTextContent('alwaysAuth')
  })

  it('un interruptor apagado se lee apagado (y `false` no se confunde con ausente)', () => {
    render1({ type: 'reference', showTransactionId: true, showAppVersion: false })
    expect(screen.getByTestId('block-switch-showAppVersion')).toHaveAttribute('aria-checked', 'false')
    expect(screen.getByTestId('block-switch-showTransactionId')).toHaveAttribute('aria-checked', 'true')
  })

  it('el texto libre admite hasta 6 renglones y no ofrece el séptimo', async () => {
    render1({ type: 'text', lines: ['a', 'b', 'c', 'd', 'e', 'f'], align: 'center', emphasis: 'normal' })
    expect(screen.queryByTestId('block-text-add-line')).toBeNull()
  })

  it('🔴 en sólo lectura no hay un control que prometa una edición', () => {
    render1({ type: 'text', lines: ['hola'], align: 'center', emphasis: 'normal' }, true)
    expect(screen.queryByTestId('block-text-add-line')).toBeNull()
    expect(screen.getByTestId('block-field-text-line-0')).toHaveAttribute('readonly')
    expect(screen.getByTestId('block-align-text-center')).toBeDisabled()
  })
})
