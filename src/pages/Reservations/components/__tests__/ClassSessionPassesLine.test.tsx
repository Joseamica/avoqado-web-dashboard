import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key}:${JSON.stringify(opts)}` : key) }),
}))

import { ClassSessionPassesLine } from '../ClassSessionPassesLine'

describe('ClassSessionPassesLine', () => {
  // R2b-34: en la vista SEMANA (columna de ~119 px) «· Pases 2/3» partía la fila y la sacaba del bloque. Ahora es un
  // indicador compacto e inquebrantable (boleto + «2/3»); el texto completo queda en title y en el nombre accesible.
  it('con pases pinta un indicador compacto (boleto + «X/Y») que no se parte, con el texto completo en title', () => {
    render(<ClassSessionPassesLine passes={{ taken: 2, cap: 3, sessionCap: null }} />)
    const full = 'classSession.passes:{"taken":2,"cap":3}'
    const indicator = screen.getByRole('img', { name: full })
    expect(indicator).toHaveAttribute('title', full)
    expect(indicator).toHaveTextContent(/^2\/3$/)
    expect(indicator).toHaveClass('whitespace-nowrap', 'shrink-0')
    expect(indicator.querySelector('svg')).not.toBeNull()
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
