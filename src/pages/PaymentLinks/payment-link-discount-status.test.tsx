import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { PaymentLinkDiscountStatus } from './PaymentLinkDiscountStatus'

vi.mock('react-i18next', () => {
  const labels: Record<string, string> = {
    'discountStatus.VENCIDO': 'Descuento vencido',
    'discountStatus.remove': 'Quitar descuento',
    'discountStatus.replace': 'Poner otro',
    'discountStatus.archive': 'Archivar',
  }
  return { useTranslation: () => ({ t: (k: string) => labels[k] ?? k, i18n: { language: 'es' } }) }
})

afterEach(cleanup)
const pct = { name: 'Mayo', type: 'PERCENTAGE' as const, value: 15, origen: 'CATALOGO' as const, discountId: 'd1' }
const fns = () => ({ onRemove: vi.fn(), onReplace: vi.fn(), onArchive: vi.fn() })

describe('PaymentLinkDiscountStatus', () => {
  it('OK muestra −15 % sin acciones', () => {
    render(<PaymentLinkDiscountStatus link={{ discount: pct, discountStatus: 'OK' }} canUpdate {...fns()} />)
    expect(screen.getByText('−15 %')).toBeTruthy()
    expect(screen.queryByText('Quitar descuento')).toBeNull()
  })

  it('OK en pesos muestra −$150.00', () => {
    render(<PaymentLinkDiscountStatus link={{ discount: { ...pct, type: 'FIXED_AMOUNT', value: 150 }, discountStatus: 'OK' }} canUpdate {...fns()} />)
    expect(screen.getByText(/^−\$150\.00$/)).toBeTruthy()
  })

  it('VENCIDO avisa y ofrece las tres acciones', () => {
    const f = fns()
    render(<PaymentLinkDiscountStatus link={{ discount: pct, discountStatus: 'VENCIDO' }} canUpdate {...f} />)
    expect(screen.getByText('⚠ Descuento vencido')).toBeTruthy()
    fireEvent.click(screen.getByText('Quitar descuento'))
    fireEvent.click(screen.getByText('Poner otro'))
    fireEvent.click(screen.getByText('Archivar'))
    expect(f.onRemove).toHaveBeenCalledTimes(1)
    expect(f.onReplace).toHaveBeenCalledTimes(1)
    expect(f.onArchive).toHaveBeenCalledTimes(1)
  })

  it('sin permiso de editar sólo se ve el aviso', () => {
    render(<PaymentLinkDiscountStatus link={{ discount: pct, discountStatus: 'VENCIDO' }} canUpdate={false} {...fns()} />)
    expect(screen.getByText('⚠ Descuento vencido')).toBeTruthy()
    expect(screen.queryByText('Archivar')).toBeNull()
  })

  it('sin descuento no pinta nada', () => {
    const { container } = render(<PaymentLinkDiscountStatus link={{ discount: null, discountStatus: null }} canUpdate {...fns()} />)
    expect(container.innerHTML).toBe('')
  })
})
