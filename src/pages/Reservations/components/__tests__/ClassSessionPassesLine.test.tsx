import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

import { ClassSessionPassesLine } from '../ClassSessionPassesLine'

describe('ClassSessionPassesLine', () => {
  it('con pases pinta «Pases: X de Y»', () => {
    render(<ClassSessionPassesLine passes={{ taken: 2, cap: 3, sessionCap: null }} />)
    expect(screen.getByText('classSession.passes:{"taken":2,"cap":3}')).toBeInTheDocument()
  })

  // sin conexión / clase no ligada / cancelada (null) o server viejo (undefined): nada
  it('sin pases no pinta nada', () => {
    const { container } = render(
      <>
        <ClassSessionPassesLine passes={null} />
        <ClassSessionPassesLine passes={undefined} />
      </>,
    )
    expect(container).toBeEmptyDOMElement()
  })
})
