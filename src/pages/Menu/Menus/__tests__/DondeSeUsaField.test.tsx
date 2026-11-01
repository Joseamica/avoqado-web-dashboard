import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DondeSeUsaField } from '../components/DondeSeUsaField'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const both = { appliesToDevices: true, appliesToOnline: true }

describe('DondeSeUsaField', () => {
  it('no deja apagar la última casilla', () => {
    const onChange = vi.fn()
    render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={onChange} />)
    const devices = screen.getByRole('checkbox', { name: /aparatos/ })
    expect(devices.hasAttribute('disabled') || devices.getAttribute('data-disabled') !== null).toBe(true)
    fireEvent.click(devices)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('la razón de la casilla bloqueada se ve sin pasar el mouse (W4)', () => {
    const { rerender } = render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={vi.fn()} />)
    expect(screen.getByText('menus.dondeSeUsa.alMenosUna')).toBeVisible()
    rerender(<DondeSeUsaField value={both} onChange={vi.fn()} />)
    expect(screen.queryByText('menus.dondeSeUsa.alMenosUna')).not.toBeInTheDocument()
  })

  it('apaga una casilla cuando la otra sigue marcada', () => {
    const onChange = vi.fn()
    render(<DondeSeUsaField value={both} onChange={onChange} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /tiendaEnLinea/ }))
    expect(onChange).toHaveBeenCalledWith({ appliesToDevices: true, appliesToOnline: false })
  })

  it('si la tienda en línea usaba el horario, avisa al apagarla', () => {
    render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={vi.fn()} tiendaUsabaHorario />)
    expect(screen.getByText('menus.dondeSeUsa.avisoHorario')).toBeDefined()
  })

  it('sin horario en la tienda (p. ej. un menú nuevo) no avisa', () => {
    render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={vi.fn()} />)
    expect(screen.queryByText('menus.dondeSeUsa.avisoHorario')).toBeNull()
  })
})
