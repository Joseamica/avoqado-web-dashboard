import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import reservationService from '@/services/reservation.service'
import { SETTINGS_PATH, renderSettings, savedSettings } from './reservationSettingsHarness'

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

/** El recorrido prometido: cada paso de sección, en orden, con la pestaña donde vive su destino. */
const RECORRIDO: { key: string; id: string; tab: 'general' | 'clases' | 'citas' }[] = [
  { key: 'publicBooking', id: 'reservation-settings-public-booking', tab: 'general' },
  { key: 'scheduling', id: 'reservation-settings-scheduling', tab: 'general' },
  { key: 'deposits', id: 'reservation-settings-deposits', tab: 'general' },
  { key: 'cancellation', id: 'reservation-settings-cancellation', tab: 'general' },
  { key: 'creditRefund', id: 'reservation-settings-credit-refund', tab: 'general' },
  { key: 'waitlist', id: 'reservation-settings-waitlist', tab: 'general' },
  { key: 'reminders', id: 'reservation-settings-reminders', tab: 'general' },
  { key: 'paymentsClasses', id: 'reservation-settings-payments-classes', tab: 'clases' },
  { key: 'appointmentScheduling', id: 'reservation-settings-appointment-scheduling', tab: 'citas' },
  { key: 'paymentsAppointments', id: 'reservation-settings-payments-appointments', tab: 'citas' },
]

const popoverTitle = () => document.querySelector('.driver-popover-title')?.textContent
const next = () => document.querySelector<HTMLButtonElement>('.driver-popover-next-btn')!

beforeEach(() => {
  getSettings.mockResolvedValue(savedSettings())
})

describe('Tour de Configuración de Reservaciones en pestañas (D680)', () => {
  // El motor de driver.js es el de verdad: si «Siguiente» se atora o un paso señala algo oculto
  // después de la bienvenida (p. ej. al pasar de General a Clases), esta prueba truena.
  it('«Siguiente» recorre las tres pestañas y cada paso resalta su sección VISIBLE, con la dirección en su pestaña', async () => {
    const user = userEvent.setup()
    // Empieza en Citas: el primer paso de General tiene que regresarla.
    renderSettings([`${SETTINGS_PATH}#citas`])
    await screen.findByText('settings.title')
    await user.click(screen.getByRole('button', { name: 'settings.settingsTour.start' }))

    await waitFor(() => expect(popoverTitle()).toBe('settings.settingsTour.welcome.title'))
    await user.click(next())
    await waitFor(() => expect(popoverTitle()).toBe('settings.settingsTour.save.title'))

    for (const paso of RECORRIDO) {
      await user.click(next())
      await waitFor(() => expect(popoverTitle()).toBe(`settings.settingsTour.${paso.key}.title`), { timeout: 3000 })
      // driver.js pasa la marca al destino al empezar el paso (la del anterior puede seguir mientras dura su animación).
      const resaltado = document.querySelector<HTMLElement>(`[data-tour="${paso.id}"]`)
      expect(resaltado, `paso ${paso.key}: no existe [data-tour="${paso.id}"]`).not.toBeNull()
      expect(resaltado, `paso ${paso.key} no resaltó su sección`).toHaveClass('driver-active-element')
      const pestaña = resaltado!.closest<HTMLElement>('[data-settings-tab]')
      expect(pestaña).toHaveAttribute('data-settings-tab', paso.tab)
      expect(pestaña, `«${paso.id}» quedó en una pestaña oculta`).not.toHaveAttribute('hidden')
      expect(resaltado).toBeVisible()
      expect(screen.getByTestId('location').textContent).toBe(`${SETTINGS_PATH}#${paso.tab}`)
    }
  })
})
