import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { DondeSeUsaField } from '../components/DondeSeUsaField'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const both = { appliesToDevices: true, appliesToOnline: true }

describe('DondeSeUsaField', () => {
  it('no deja apagar la última casilla', () => {
    const onChange = vi.fn()
    render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={onChange} tieneHorario={false} />)
    const devices = screen.getByRole('checkbox', { name: /aparatos/ })
    expect(devices.hasAttribute('disabled') || devices.getAttribute('data-disabled') !== null).toBe(true)
    fireEvent.click(devices)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('apaga una casilla cuando la otra sigue marcada', () => {
    const onChange = vi.fn()
    render(<DondeSeUsaField value={both} onChange={onChange} tieneHorario={false} />)
    fireEvent.click(screen.getByRole('checkbox', { name: /tiendaEnLinea/ }))
    expect(onChange).toHaveBeenCalledWith({ appliesToDevices: true, appliesToOnline: false })
  })

  it('con horario avisa al apagar la tienda en línea', () => {
    render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={vi.fn()} tieneHorario />)
    expect(screen.getByText('menus.dondeSeUsa.avisoHorario')).toBeDefined()
  })

  it('sin horario no avisa', () => {
    render(<DondeSeUsaField value={{ appliesToDevices: true, appliesToOnline: false }} onChange={vi.fn()} tieneHorario={false} />)
    expect(screen.queryByText('menus.dondeSeUsa.avisoHorario')).toBeNull()
  })
})
