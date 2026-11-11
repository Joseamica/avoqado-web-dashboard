import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key} ${JSON.stringify(o)}` : key) }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => `D(${d})` }) }))

import { CashReconciliationSummary } from './CashReconciliationSummary'

describe('CashReconciliationSummary', () => {
  it('does not render for a legacy/default-off shift with no reconciliation data', () => {
    const { container } = render(<CashReconciliationSummary cashDeclared={null} cashDifference={null} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('preserves an exact zero as a balanced drawer', () => {
    render(<CashReconciliationSummary cashDeclared={0} cashDifference={0} />)
    expect(screen.getByText('detail.cashReconciliation.balanced')).toBeInTheDocument()
    expect(screen.getByText('detail.cashReconciliation.countedCash')).toBeInTheDocument()
  })

  it('renders a negative difference as a shortage', () => {
    render(<CashReconciliationSummary cashDeclared={900} cashDifference={-100} />)
    expect(screen.getByText('detail.cashReconciliation.shortage')).toBeInTheDocument()
  })

  it('renders a positive difference as an overage', () => {
    render(<CashReconciliationSummary cashDeclared={1100} cashDifference={100} />)
    expect(screen.getByText('detail.cashReconciliation.overage')).toBeInTheDocument()
  })

  describe('corregir conteo', () => {
    const base = { cashDeclared: 900, cashDifference: -100 }
    const corr = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ id: `c${i}`, createdAt: `2026-11-0${i + 1}`, staffName: `Ana${i}`, countedBefore: 100 + i, reason: `motivo${i}` }))

    it('botón activo llama onCorrect', () => {
      const onCorrect = vi.fn()
      render(<CashReconciliationSummary {...base} canCorrect countCorrection={{ allowed: true, blockedReason: null }} onCorrect={onCorrect} />)
      fireEvent.click(screen.getByRole('button', { name: 'detail.correctCount.button' }))
      expect(onCorrect).toHaveBeenCalled()
    })

    it('bloqueado: deshabilitado con su razón', () => {
      render(<CashReconciliationSummary {...base} canCorrect countCorrection={{ allowed: false, blockedReason: 'NO_LINKED_DRAWER' }} />)
      expect(screen.getByRole('button', { name: 'detail.correctCount.button' })).toBeDisabled()
      expect(screen.getByText('detail.correctCount.blocked.NO_LINKED_DRAWER')).toBeInTheDocument()
    })

    it('50 correcciones (TOO_MANY): deshabilitado con su razón', () => {
      render(<CashReconciliationSummary {...base} canCorrect countCorrection={{ allowed: false, blockedReason: 'TOO_MANY' }} />)
      expect(screen.getByRole('button', { name: 'detail.correctCount.button' })).toBeDisabled()
      expect(screen.getByText('detail.correctCount.blocked.TOO_MANY')).toBeInTheDocument()
    })

    it('sin canCorrect o sin conteo no hay botón', () => {
      const { rerender } = render(<CashReconciliationSummary {...base} countCorrection={{ allowed: true, blockedReason: null }} />)
      expect(screen.queryByRole('button')).toBeNull()
      rerender(<CashReconciliationSummary cashDeclared={null} cashDifference={-100} canCorrect countCorrection={{ allowed: true, blockedReason: null }} />)
      expect(screen.queryByRole('button', { name: 'detail.correctCount.button' })).toBeNull()
    })

    it('con 5 correcciones muestra 3 y despliega el resto en orden', () => {
      render(<CashReconciliationSummary {...base} countCorrections={corr(5)} />)
      expect(screen.getByText(/Ana2/)).toBeInTheDocument()
      expect(screen.queryByText(/Ana3/)).toBeNull()
      fireEvent.click(screen.getByRole('button', { name: /detail.correctCount.showOlder/ }))
      const names = screen.getAllByText(/Ana\d/).map(e => e.textContent)
      expect(names).toHaveLength(5)
      expect(names[4]).toMatch(/Ana4/)
      expect(screen.getByText(/motivo4/)).toBeInTheDocument()
      expect(screen.getAllByText(/detail.correctCount.before/)).toHaveLength(5)
    })
  })
})
