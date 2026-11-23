import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatementSection } from './StatementSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'en' },
  }),
}))

const fmt = (n: number) => `$${n.toFixed(2)}`
const comercio = (unprojectedNet: number) => ({
  merchantAccountId: 'a',
  displayName: 'A',
  provider: 'P',
  affiliation: null,
  collectedOnCard: 100,
  platformFee: 3,
  netToReceive: 97,
  transactionCount: 1,
  unprojectedNet,
})

describe('StatementSection · aviso de dinero sin fecha (D17, carril C2)', () => {
  it('sale desde un centavo, no sólo arriba de $1', () => {
    render(<StatementSection buckets={[]} merchants={[comercio(0.75)]} calendar={[]} venueTimezone="America/Mexico_City" formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-unprojected')).toHaveTextContent('$0.75')
  })

  it('sin dinero sin fecha no sale', () => {
    render(<StatementSection buckets={[]} merchants={[comercio(0)]} calendar={[]} venueTimezone="America/Mexico_City" formatCurrency={fmt} />)
    expect(screen.queryByTestId('statement-unprojected')).not.toBeInTheDocument()
  })
})
