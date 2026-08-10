import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

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
})
