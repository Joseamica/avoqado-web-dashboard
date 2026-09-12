/**
 * El PAPEL. Pinta las líneas que YA acomodó el intérprete del servidor, sin volver a alinear
 * nada: si el dashboard reacomodara, la vista previa podría divergir del papel real y dejaría
 * de servir para lo único que existe.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReceiptPaper } from '@/pages/Settings/components/receipt-layout/ReceiptPaper'
import type { LogicalLine } from '@/services/receiptLayout.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const texto = (text: string, over: Partial<Extract<LogicalLine, { kind: 'text' }>> = {}): LogicalLine => ({
  kind: 'text',
  text,
  align: 'left',
  bold: false,
  double: false,
  ...over,
})

describe('ReceiptPaper', () => {
  it('🔴 pinta el texto tal cual: los ESPACIOS son las columnas y no se colapsan', () => {
    // Las 22 espacios de en medio SON el alineado a la derecha que calculó el intérprete.
    // Testing Library colapsa el espacio por default, así que hay que desactivar el
    // normalizador: con el de serie, un papel que tirara los espacios pasaría la prueba.
    const linea = 'Orden #:                      42'
    const { container } = render(<ReceiptPaper lines={[texto(linea)]} width={32} />)
    expect(screen.getByText(linea, { normalizer: s => s })).toBeInTheDocument()
    expect((container.querySelector('[data-line="text"]') as HTMLElement).className).toContain('whitespace-pre')
  })

  it('🔴 una línea double se marca como tal: gasta DOS columnas por carácter', () => {
    render(<ReceiptPaper lines={[texto('TESTARUDO', { double: true, align: 'center' })]} width={48} />)
    expect(screen.getByText('TESTARUDO')).toHaveAttribute('data-double', 'true')
  })

  it('🔴 el ancho lógico de una double es la MITAD: pintarla igual mentiría sobre el corte', () => {
    const { container } = render(<ReceiptPaper lines={[texto('X', { double: true })]} width={48} />)
    const linea = container.querySelector('[data-line="text"]') as HTMLElement
    expect(linea.style.width).toBe('24ch')
  })

  it('el ancho del papel es EXACTAMENTE el del ticket, en columnas', () => {
    const { container } = render(<ReceiptPaper lines={[texto('x')]} width={32} />)
    expect(container.querySelector('[data-paper]')).toHaveAttribute('data-width', '32')
  })

  it('un feed de 2 deja DOS renglones vacíos, no uno ni tres', () => {
    const { container } = render(<ReceiptPaper lines={[{ kind: 'feed', lines: 2 }]} width={48} />)
    expect(container.querySelectorAll('[data-line="feed"]')).toHaveLength(2)
  })

  it('🔴 el corte se pinta como troquel, y es lo ÚLTIMO', () => {
    const { container } = render(<ReceiptPaper lines={[texto('fin'), { kind: 'cut' }]} width={48} />)
    const lineas = container.querySelectorAll('[data-line]')
    expect(lineas[lineas.length - 1]).toHaveAttribute('data-line', 'cut')
  })

  it('el logo y el isotipo se distinguen: uno es hueco, el otro es la marca', () => {
    render(
      <ReceiptPaper
        lines={[
          { kind: 'image', ref: 'logo', widthPct: 60 },
          { kind: 'image', ref: 'avoqadoMark', widthPct: 15 },
        ]}
        width={48}
      />,
    )
    expect(screen.getByTestId('paper-logo-placeholder')).toBeInTheDocument()
    expect(screen.getByTestId('paper-avoqado-mark')).toBeInTheDocument()
  })

  it('un papel sin líneas no queda en blanco mudo: dice qué falta', () => {
    render(<ReceiptPaper lines={[]} width={48} />)
    expect(screen.getByTestId('paper-empty')).toBeInTheDocument()
  })

  it('🔴 negritas y alineación salen del SERVIDOR, no se deciden aquí', () => {
    const { container } = render(
      <ReceiptPaper lines={[texto('TOTAL:', { bold: true, align: 'right' })]} width={48} />,
    )
    const linea = container.querySelector('[data-line="text"]') as HTMLElement
    expect(linea.className).toContain('font-bold')
    expect(linea.className).toContain('text-right')
  })

  it('el QR y el código de barras se pintan como marcadores, no como el código real', () => {
    const { container } = render(
      <ReceiptPaper lines={[{ kind: 'qr', data: 'https://x' }, { kind: 'barcode', data: '123' }]} width={48} />,
    )
    expect(container.querySelector('[data-line="qr"]')).toBeInTheDocument()
    expect(container.querySelector('[data-line="barcode"]')).toBeInTheDocument()
  })
})
