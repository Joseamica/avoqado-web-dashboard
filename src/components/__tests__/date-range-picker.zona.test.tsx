// D1 (28-oct): con la computadora en otra zona que el negocio, el selector pintaba y mandaba días corridos.
// La pantalla le pasa INSTANTES del día del negocio y espera recibir lo mismo; el calendario trabaja con días.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { Settings } from 'luxon'
import { DateRangePicker } from '../date-range-picker'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }),
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ activeVenue: { timezone: 'America/Mexico_City' } }),
}))

// Lo que la pantalla tiene guardado: del 1-oct 00:00 al 7-oct 23:59:59.999, hora de México.
const DESDE = new Date('2026-10-01T06:00:00.000Z')
const HASTA = new Date('2026-10-08T05:59:59.999Z')
const zonaOriginal = process.env.TZ

// Un navegador no cambia de zona a media sesión; aquí sí. Luxon guarda sus formateadores de Intl con la zona con que
// nacieron, y sin vaciarlos el mes saldría en la zona de la prueba anterior («1 sep» en Tokio tras Madrid).
const enLaZona = (zona: string | undefined) => {
  if (zona === undefined) delete process.env.TZ
  else process.env.TZ = zona
  Settings.resetCaches()
}

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  enLaZona(zonaOriginal)
})

// Un día del calendario (rejilla 0 = septiembre, 1 = octubre), sin los días de otros meses que también pinta.
const diaDelCalendario = (rejilla: number, n: number) =>
  within(screen.getAllByRole('grid')[rejilla])
    .getAllByRole('gridcell', { name: String(n) })
    .find(b => !b.className.includes('day-outside')) as HTMLElement

describe.each(['Europe/Madrid', 'Asia/Tokyo', 'America/Los_Angeles'])('con la computadora en %s y el negocio en México', zona => {
  it('el botón dice los días del negocio', () => {
    enLaZona(zona)
    render(<DateRangePicker initialDateFrom={DESDE} initialDateTo={HASTA} showCompare={false} />)
    expect(screen.getByRole('button', { name: /1 oct\.? 26 – 7 oct\.? 26/ })).toBeInTheDocument()
  })

  it('escribir otro día final y aplicar manda ese día entero, en la hora del negocio', () => {
    enLaZona(zona)
    const onUpdate = vi.fn()
    render(<DateRangePicker initialDateFrom={DESDE} initialDateTo={HASTA} showCompare={false} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /oct/ }))

    const [, diaFinal] = screen.getAllByPlaceholderText('date.D')
    fireEvent.change(diaFinal, { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'apply' }))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const { range } = onUpdate.mock.calls[0][0]
    expect(range.from.toISOString()).toBe('2026-10-01T06:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-10T05:59:59.999Z')
  })

  it('elegir un solo día en el calendario y aplicar manda ese día entero (antes «Aplicar» no hacía nada)', () => {
    enLaZona(zona)
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date('2026-10-15T18:00:00.000Z')) // el calendario abre en septiembre y octubre
    const onUpdate = vi.fn()
    render(<DateRangePicker initialDateFrom={DESDE} initialDateTo={HASTA} showCompare={false} onUpdate={onUpdate} />)
    fireEvent.click(screen.getByRole('button', { name: /oct/ }))

    // El recorrido que encontró Codex: 30 sep → 1 oct → 1 oct deja elegido sólo el 1 de octubre.
    fireEvent.click(diaDelCalendario(0, 30))
    fireEvent.click(diaDelCalendario(1, 1))
    fireEvent.click(diaDelCalendario(1, 1))
    fireEvent.click(screen.getByRole('button', { name: 'apply' }))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    const { range } = onUpdate.mock.calls[0][0]
    expect(range.from.toISOString()).toBe('2026-10-01T06:00:00.000Z')
    expect(range.to.toISOString()).toBe('2026-10-02T05:59:59.999Z')
  })
})
