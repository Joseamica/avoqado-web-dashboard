import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Config, DriveStep } from 'driver.js'
import reservationService from '@/services/reservation.service'
import { SETTINGS_PATH, renderSettings, savedSettings } from './reservationSettingsHarness'

// Sólo se captura la configuración que el tour le da a driver.js; los pasos y la página son los de verdad.
const tour = vi.hoisted(() => ({ config: null as Config | null }))
vi.mock('driver.js', () => ({
  driver: (config: Config) => {
    tour.config = config
    return { drive: () => undefined, destroy: () => undefined }
  },
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))
vi.mock('@/components/ui/select', () => import('./reservationSettingsSelectShim'))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/test' }),
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, isLoading: false }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/services/reservation.service', () => ({ default: { getSettings: vi.fn(), updateSettings: vi.fn() } }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [] } }))
vi.mock('@/services/googleCalendar.service', () => ({ default: { listConnections: async () => ({ connections: [] }) } }))
vi.mock('@/pages/GoogleCalendar/components/GoogleCalendarConnectionCard', () => ({ GoogleCalendarConnectionCard: () => null }))
vi.mock('../components/GoogleCalendarDeadLetterBanner', () => ({ GoogleCalendarDeadLetterBanner: () => null }))
vi.mock('../components/GoogleCalendarPrivacySection', () => ({ GoogleCalendarPrivacySection: () => null }))
vi.mock('../components/ReservationStaffConfiguration', () => ({
  ReservationStaffConfiguration: () => <section data-tour="reservation-settings-staffing" />,
}))

const getSettings = vi.mocked(reservationService.getSettings)

/** Resuelve el destino de un paso como lo hace driver.js al mostrarlo. */
function resolve(step: DriveStep): Element | null {
  const { element } = step
  if (typeof element === 'function') return element()
  if (typeof element === 'string') return document.querySelector(element)
  return element ?? null
}

beforeEach(() => {
  tour.config = null
  getSettings.mockResolvedValue(savedSettings())
})

describe('Tour de Configuración de Reservaciones en pestañas (D680)', () => {
  it('cada paso señala algo que existe, VISIBLE, y deja la dirección en la pestaña de ese paso', async () => {
    const user = userEvent.setup()
    // Empieza en Citas: el primer paso de General tiene que regresarla.
    renderSettings([`${SETTINGS_PATH}#citas`])
    await screen.findByText('settings.title')
    await user.click(screen.getByRole('button', { name: 'settings.settingsTour.start' }))

    const steps = tour.config?.steps ?? []
    const conDestino = steps.filter(step => step.element !== undefined)
    expect(conDestino.length).toBeGreaterThan(5)

    const recorrido: string[] = []
    for (const step of conDestino) {
      let el: Element | null = null
      act(() => {
        el = resolve(step)
      })
      expect(el, `paso «${step.popover?.title}» sin destino`).toBeInstanceOf(HTMLElement)
      const node = el as unknown as HTMLElement
      const tourId = node.getAttribute('data-tour') ?? ''
      const tabPanel = node.closest<HTMLElement>('[data-settings-tab]')
      if (tabPanel) {
        const tab = tabPanel.dataset.settingsTab
        expect(tabPanel, `«${tourId}» quedó en una pestaña oculta`).not.toHaveAttribute('hidden')
        expect(tabPanel).toHaveAttribute('data-state', 'active')
        expect(screen.getByTestId('location').textContent).toBe(`${SETTINGS_PATH}#${tab}`)
        recorrido.push(`${tab}:${tourId}`)
      }
      expect(node).toBeVisible()
    }

    // Los dos cobros tienen paso propio, cada uno en su pestaña; el destino viejo ya no existe.
    expect(recorrido).toContain('clases:reservation-settings-payments-classes')
    expect(recorrido).toContain('citas:reservation-settings-payments-appointments')
    expect(recorrido.some(paso => paso.endsWith(':reservation-settings-payments'))).toBe(false)
    // Recorre General → Clases → Citas sin regresar.
    const orden = recorrido.map(paso => paso.split(':')[0])
    expect(orden).toEqual([...orden].sort((a, b) => ['general', 'clases', 'citas'].indexOf(a) - ['general', 'clases', 'citas'].indexOf(b)))
  })
})
