import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import reservationService from '@/services/reservation.service'
import { SETTINGS_PATH, panel, renderSettings, savedSettings } from './reservationSettingsHarness'

const venue = vi.hoisted(() => ({ fullBasePath: '/venues/test' }))
const grants = vi.hoisted(() => ({ list: [] as string[] }))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
}))
vi.mock('@/components/ui/select', () => import('./reservationSettingsSelectShim'))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: venue.fullBasePath }),
}))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (permission: string) => grants.list.includes(permission), isLoading: false }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/services/reservation.service', () => ({ default: { getSettings: vi.fn(), updateSettings: vi.fn() } }))
vi.mock('@/services/ecommerceMerchant.service', () => ({ ecommerceMerchantAPI: { listByVenue: async () => [] } }))
vi.mock('@/services/googleCalendar.service', () => ({ default: { listConnections: async () => ({ connections: [] }) } }))
vi.mock('@/pages/GoogleCalendar/components/GoogleCalendarConnectionCard', () => ({ GoogleCalendarConnectionCard: () => null }))
vi.mock('../components/GoogleCalendarDeadLetterBanner', () => ({ GoogleCalendarDeadLetterBanner: () => null }))
vi.mock('../components/GoogleCalendarPrivacySection', () => ({ GoogleCalendarPrivacySection: () => null }))
// Profesionistas con borrador local, como el de verdad: si la pestaña lo desmonta, el borrador se pierde.
vi.mock('../components/ReservationStaffConfiguration', () => ({
  ReservationStaffConfiguration: () => {
    const [draft, setDraft] = useState('')
    return (
      <section data-tour="reservation-settings-staffing">
        <input aria-label="borrador de horario" value={draft} onChange={e => setDraft(e.target.value)} />
      </section>
    )
  },
}))

const getSettings = vi.mocked(reservationService.getSettings)
const updateSettings = vi.mocked(reservationService.updateSettings)

const location = () => screen.getByTestId('location').textContent
const tab = (name: RegExp) => screen.getByRole('tab', { name })
const select = (label: string) => screen.getByRole('combobox', { name: label })

beforeEach(() => {
  venue.fullBasePath = '/venues/test'
  grants.list = ['menu:read', 'creditPacks:read']
  getSettings.mockResolvedValue(savedSettings())
  updateSettings.mockResolvedValue(savedSettings())
})

describe('Configuración de Reservaciones en pestañas (D680)', () => {
  it('cuerpo idéntico: cambiar un campo de General y el cobro de clases manda lo cargado con sólo esos dos cambios', async () => {
    const user = userEvent.setup()
    renderSettings()
    await screen.findByText('settings.title')

    await user.selectOptions(select('settings.scheduling.minNotice'), '240')
    await user.click(tab(/settings\.tabs\.classes/))
    await user.selectOptions(select('settings.payments.classUpfrontDefault'), 'required')
    await user.click(screen.getByRole('button', { name: 'actions.saveChanges' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    const saved = savedSettings()
    expect(updateSettings).toHaveBeenCalledWith('venue-1', {
      scheduling: {
        slotIntervalMin: 30,
        defaultDurationMin: 90,
        autoConfirm: false,
        maxAdvanceDays: 30,
        minNoticeMin: 240,
        noShowGraceMin: 10,
        nightlyOutreachEnabled: true,
        capacityMode: 'per_staff',
        pacingMaxPerSlot: 3,
        onlineCapacityPercent: 75,
      },
      deposits: {
        enabled: true,
        mode: 'deposit',
        fixedAmount: 100,
        percentageOfTotal: null,
        requiredForPartySizeGte: 4,
        paymentWindowHrs: null,
      },
      payments: { appointmentUpfrontDefault: 'optional', classUpfrontDefault: 'required' },
      publicBooking: {
        enabled: true,
        requirePhone: false,
        requireEmail: true,
        requireAccount: true,
        requireCustomerApproval: true,
        showStaffPicker: true,
      },
      cancellation: {
        allowCustomerCancel: false,
        minHoursBeforeStart: 24,
        forfeitDeposit: true,
        noShowFeePercent: null,
        creditRefundMode: 'ALWAYS',
        creditFreeRefundHoursBefore: 48,
        creditLateRefundPercent: 50,
        creditNoShowRefund: true,
        allowCustomerReschedule: false,
      },
      waitlist: { enabled: true, maxSize: 25, priorityMode: 'broadcast', notifyWindowMin: 45 },
      reminders: { enabled: true, channels: ['WHATSAPP', 'EMAIL'], minutesBefore: [1440, 60] },
      googleCalendar: { eventDetailLevel: 'SERVICE' },
      operatingHours: saved.operatingHours,
    })
  })

  it('la pestaña sigue a la dirección: abre en #citas, tocar una pestaña conserva ?x=1 y «atrás» la regresa', async () => {
    const user = userEvent.setup()
    renderSettings([`${SETTINGS_PATH}#general`, `${SETTINGS_PATH}?x=1#citas`])
    await screen.findByText('settings.title')

    expect(panel('citas')).not.toHaveAttribute('hidden')
    expect(panel('general')).toHaveAttribute('hidden')

    await user.click(tab(/settings\.tabs\.classes/))
    expect(location()).toBe(`${SETTINGS_PATH}?x=1#clases`)
    expect(panel('clases')).not.toHaveAttribute('hidden')
    expect(panel('citas')).toHaveAttribute('hidden')

    // Tocar pestañas reemplaza la entrada: «atrás» regresa a la anterior (General) y la pestaña la sigue.
    await user.click(screen.getByRole('button', { name: 'atrás' }))
    expect(location()).toBe(`${SETTINGS_PATH}#general`)
    expect(panel('general')).not.toHaveAttribute('hidden')
    expect(panel('clases')).toHaveAttribute('hidden')
  })

  it('una dirección desconocida abre General', async () => {
    renderSettings([`${SETTINGS_PATH}#otra`])
    await screen.findByText('settings.title')
    expect(panel('general')).not.toHaveAttribute('hidden')
  })

  it('el borrador de Profesionistas sobrevive al cambiar de pestaña', async () => {
    const user = userEvent.setup()
    renderSettings([`${SETTINGS_PATH}#citas`])
    await screen.findByText('settings.title')

    await user.type(screen.getByRole('textbox', { name: 'borrador de horario' }), 'Lunes 9 a 14')
    await user.click(tab(/settings\.tabs\.general/))
    await user.click(tab(/settings\.tabs\.appointments/))

    expect(screen.getByRole('textbox', { name: 'borrador de horario' })).toHaveValue('Lunes 9 a 14')
  })

  it('un error en otra pestaña no guarda, cambia a esa pestaña y se ve junto a su campo', async () => {
    // 10 min: el SERVIDOR lo acepta (mínimo 5) y el formulario lo rechaza (mínimo 15).
    getSettings.mockResolvedValue(savedSettings({ defaultDurationMin: 10 }))
    const user = userEvent.setup()
    renderSettings([`${SETTINGS_PATH}#citas`])
    await screen.findByText('settings.title')

    await user.selectOptions(select('settings.scheduling.capacityMode'), 'pacing')
    await user.click(screen.getByRole('button', { name: 'actions.saveChanges' }))

    await waitFor(() => expect(location()).toBe(`${SETTINGS_PATH}#general`))
    expect(updateSettings).not.toHaveBeenCalled()
    expect(panel('general')).not.toHaveAttribute('hidden')
    const duration = select('settings.scheduling.defaultDuration')
    expect(within(duration.parentElement!).getByText('settings.validation.invalidOption')).toBeVisible()
  })

  it('intervalo, duración y máximo por horario están en General (el motor de horarios los usa para todo producto sin sesión)', async () => {
    renderSettings([`${SETTINGS_PATH}#general`])
    await screen.findByText('settings.title')

    for (const label of ['settings.scheduling.slotInterval', 'settings.scheduling.defaultDuration', 'settings.pacing.maxPerSlot']) {
      expect(within(panel('general')).getByRole('combobox', { name: label })).toBeVisible()
    }
    expect(within(panel('citas')).queryByRole('combobox', { name: 'settings.scheduling.slotInterval', hidden: true })).toBeNull()
  })

  it('una fila escondida con un valor inválido no bloquea en silencio: se muestra con su error', async () => {
    // Lista de espera APAGADA con 600 lugares: el SERVIDOR acepta hasta 5000; el formulario, hasta 500.
    getSettings.mockResolvedValue(savedSettings({ waitlist: { enabled: false, maxSize: 600 } }))
    const user = userEvent.setup()
    renderSettings([`${SETTINGS_PATH}#clases`])
    await screen.findByText('settings.title')
    expect(screen.queryByRole('combobox', { name: 'settings.waitlist.maxSize', hidden: true })).toBeNull()

    await user.selectOptions(select('settings.payments.classUpfrontDefault'), 'required')
    await user.click(screen.getByRole('button', { name: 'actions.saveChanges' }))

    await waitFor(() => expect(location()).toBe(`${SETTINGS_PATH}#general`))
    expect(updateSettings).not.toHaveBeenCalled()
    const maxSize = select('settings.waitlist.maxSize')
    expect(within(maxSize.parentElement!).getByText('settings.validation.invalidOption')).toBeVisible()
  })

  it('un canal de recordatorio que la pantalla no conoce (PUSH, guardado por API) se descarta al tocar un canal y el guardado pasa', async () => {
    getSettings.mockResolvedValue(savedSettings({ reminders: { enabled: false, channels: ['PUSH'] } }))
    const user = userEvent.setup()
    renderSettings([`${SETTINGS_PATH}#clases`])
    await screen.findByText('settings.title')

    await user.selectOptions(select('settings.payments.classUpfrontDefault'), 'required')
    await user.click(screen.getByRole('button', { name: 'actions.saveChanges' }))
    await waitFor(() => expect(location()).toBe(`${SETTINGS_PATH}#general`))
    expect(updateSettings).not.toHaveBeenCalled()
    const canales = screen.getByRole('group', { name: 'settings.reminders.channels' })
    expect(within(canales.parentElement!).getByText('settings.validation.invalidOption')).toBeVisible()

    await user.click(within(canales).getByRole('button', { name: 'Email' }))
    await user.click(screen.getByRole('button', { name: 'actions.saveChanges' }))

    await waitFor(() => expect(updateSettings).toHaveBeenCalledTimes(1))
    expect(updateSettings.mock.calls[0][1].reminders).toEqual({ enabled: false, channels: ['EMAIL'], minutesBefore: [1440, 60] })
  })

  it('la pestaña con cambios sin guardar lleva su punto', async () => {
    const user = userEvent.setup()
    renderSettings([`${SETTINGS_PATH}#clases`])
    await screen.findByText('settings.title')

    expect(within(tab(/settings\.tabs\.classes/)).queryByRole('img', { name: 'settings.tabs.unsaved' })).toBeNull()
    await user.selectOptions(select('settings.payments.classUpfrontDefault'), 'required')
    await user.click(tab(/settings\.tabs\.general/))

    expect(within(tab(/settings\.tabs\.classes/)).getByRole('img', { name: 'settings.tabs.unsaved' })).toBeInTheDocument()
    expect(within(tab(/settings\.tabs\.general/)).queryByRole('img', { name: 'settings.tabs.unsaved' })).toBeNull()
  })

  describe('atajo «Tus clases y tus paquetes»', () => {
    it('con permiso de ver el menú, lleva a las clases y a los paquetes del panel', async () => {
      renderSettings([`${SETTINGS_PATH}#clases`])
      await screen.findByText('settings.title')

      expect(screen.getByRole('link', { name: 'settings.classShortcut.classes' })).toHaveAttribute(
        'href',
        '/venues/test/menumaker/services',
      )
      expect(screen.getByRole('link', { name: 'settings.classShortcut.packs' })).toHaveAttribute(
        'href',
        '/venues/test/menumaker/credit-packs',
      )
    })

    it('sin permiso de paquetes (creditPacks:read, el que pide el SERVIDOR) no ofrece «Ver mis paquetes»', async () => {
      grants.list = ['menu:read']
      renderSettings([`${SETTINGS_PATH}#clases`])
      await screen.findByText('settings.title')

      expect(screen.getByRole('link', { name: 'settings.classShortcut.classes' })).toBeInTheDocument()
      expect(screen.queryByRole('link', { name: 'settings.classShortcut.packs' })).toBeNull()
    })

    it('sin permiso de ver el menú no aparece', async () => {
      grants.list = []
      renderSettings([`${SETTINGS_PATH}#clases`])
      await screen.findByText('settings.title')

      expect(screen.queryByRole('link', { name: 'settings.classShortcut.classes' })).toBeNull()
      expect(screen.queryByText('settings.classShortcut.title')).toBeNull()
    })

    it('en marca blanca usa la ruta /wl/…', async () => {
      venue.fullBasePath = '/wl/venues/test'
      renderSettings([`${SETTINGS_PATH}#clases`])
      await screen.findByText('settings.title')

      expect(screen.getByRole('link', { name: 'settings.classShortcut.classes' })).toHaveAttribute(
        'href',
        '/wl/venues/test/menumaker/services',
      )
      expect(screen.getByRole('link', { name: 'settings.classShortcut.packs' })).toHaveAttribute(
        'href',
        '/wl/venues/test/menumaker/credit-packs',
      )
    })
  })
})
