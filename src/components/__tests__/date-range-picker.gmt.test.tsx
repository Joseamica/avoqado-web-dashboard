// Carril F (hz:fefa11b6:D15, Codex r3 F): un negocio con la zona guardada como «GMT-6» (altas viejas, no es IANA). Luxon da fechas
// inválidas con esa zona y el selector tronaba («Este mes» lanzaba en `toISOString()` antes de pedir el reporte). La misma salida que el
// SERVIDOR (`zonaDelCalculo`): la Ciudad de México.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { DateRangePicker } from '../date-range-picker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { timezone: 'GMT-6' } }),
}))

afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('DateRangePicker con la zona guardada como «GMT-6»', () => {
  it('🔴 sin fechas iniciales abre en «hoy» de la Ciudad de México, sin fecha inválida', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-23T18:00:00.000Z'))
    render(<DateRangePicker showCompare={false} />)
    expect(screen.getByRole('button', { name: /23 nov\.? 2026/ })).toBeInTheDocument()
    expect(screen.queryByText(/Invalid/i)).not.toBeInTheDocument()
  })

  it('🔴 elegir un periodo rápido y aplicar manda fechas válidas', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-11-23T18:00:00.000Z'))
    const onUpdate = vi.fn()
    render(<DateRangePicker showCompare={false} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /nov/ }))
    fireEvent.click(screen.getAllByRole('button', { name: /thisMonth/ })[0])
    const aplicar = screen.queryByRole('button', { name: 'apply' })
    if (aplicar) fireEvent.click(aplicar)
    const { range } = onUpdate.mock.calls[0]?.[0] ?? { range: null }
    expect(range.from.toISOString()).toBe('2026-11-01T06:00:00.000Z')
  })
})
