/**
 * Piezas comunes de las pruebas de Configuración de Reservaciones en pestañas (D680). Cada archivo de
 * prueba declara sus propios `vi.mock` (se elevan por archivo); aquí sólo viven los datos y el montaje.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import type { DaySchedule, ReservationSettings as ReservationSettingsData } from '@/types/reservation'
import ReservationSettings from '../ReservationSettings'

export const SETTINGS_PATH = '/venues/test/reservations/settings'

const day = (enabled: boolean): DaySchedule => ({ enabled, ranges: enabled ? [{ open: '09:00', close: '18:00' }] : [] })

/** Ajustes guardados DISTINTOS de los de fábrica del formulario: un cambio colado se nota. */
export function savedSettings(overrides: { defaultDurationMin?: number } = {}): ReservationSettingsData {
  return {
    scheduling: {
      slotIntervalMin: 30,
      defaultDurationMin: overrides.defaultDurationMin ?? 90,
      autoConfirm: false,
      maxAdvanceDays: 30,
      minNoticeMin: 120,
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
    payments: { appointmentUpfrontDefault: 'optional', classUpfrontDefault: 'at_venue' },
    publicBooking: {
      enabled: true,
      showStaffPicker: true,
      requirePhone: false,
      requireEmail: true,
      requireAccount: true,
      requireCustomerApproval: true,
    },
    cancellation: {
      allowCustomerCancel: false,
      minHoursBeforeStart: 24,
      forfeitDeposit: true,
      noShowFeePercent: null,
      allowCustomerReschedule: false,
      creditRefundMode: 'ALWAYS',
      creditFreeRefundHoursBefore: 48,
      creditLateRefundPercent: 50,
      creditNoShowRefund: true,
    },
    waitlist: { enabled: true, maxSize: 25, priorityMode: 'broadcast', notifyWindowMin: 45 },
    reminders: { enabled: true, channels: ['WHATSAPP', 'EMAIL'], minutesBefore: [60, 1440] },
    googleCalendar: { eventDetailLevel: 'SERVICE' },
    operatingHours: {
      monday: day(true),
      tuesday: day(true),
      wednesday: day(true),
      thursday: day(true),
      friday: day(true),
      saturday: day(false),
      sunday: day(false),
    },
    canChargeOnline: true,
  } as ReservationSettingsData
}

/** La dirección completa (ruta + `?…` + `#…`) y un «atrás» del navegador. */
function LocationProbe() {
  const location = useLocation()
  const navigate = useNavigate()
  return (
    <>
      <output data-testid="location">{`${location.pathname}${location.search}${location.hash}`}</output>
      <button type="button" onClick={() => navigate(-1)}>
        atrás
      </button>
    </>
  )
}

export function renderSettings(initialEntries: string[] = [SETTINGS_PATH]) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={initialEntries} initialIndex={initialEntries.length - 1}>
        <Routes>
          <Route
            path={SETTINGS_PATH}
            element={
              <>
                <ReservationSettings />
                <LocationProbe />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** El panel de una pestaña (montado siempre; oculto si no es la activa). */
export function panel(tab: 'general' | 'clases' | 'citas'): HTMLElement {
  const el = document.querySelector<HTMLElement>(`[data-settings-tab="${tab}"]`)
  if (!el) throw new Error(`No existe el panel ${tab}`)
  return el
}
