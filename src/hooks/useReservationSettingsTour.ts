import { driver, type Driver, type DriveStep } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { flushSync } from 'react-dom'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'
import { getTourStepIndex, setTourStepIndex } from '@/lib/tour-progress'
import { TOUR_TARGET_TAB, type SettingsTab } from '@/pages/Reservations/reservation-settings-tabs'

/**
 * Interactive tour for the Reservation Settings page.
 *
 * ⚠️ COHERENCIA: cada paso apunta a una sección de
 * `src/pages/Reservations/ReservationSettings.tsx`. Si renombras o eliminas
 * uno de los `data-tour="reservation-settings-*"` selectors, actualiza este
 * tour y `TOUR_TARGET_TAB` (`reservation-settings-tabs.ts`). D680: la página va
 * en pestañas; antes de cada paso el tour cambia la dirección a la pestaña del
 * destino (con `flushSync`, para que driver.js mida la sección ya visible).
 *
 *   - reservation-settings-save                   → Botón «Guardar cambios» (arriba, fuera de las pestañas)
 *   - reservation-settings-public-booking         → General · «Reservaciones Online»
 *   - reservation-settings-scheduling             → General · «Programación» (lo que aplica a clases y citas)
 *   - reservation-settings-deposits               → General · «Depósitos»
 *   - reservation-settings-cancellation           → General · «Cancelación»
 *   - reservation-settings-credit-refund          → General · «Reembolso de créditos al cancelar»
 *   - reservation-settings-waitlist               → General · «Lista de espera»
 *   - reservation-settings-reminders              → General · «Recordatorios»
 *   - reservation-settings-payments-classes       → Clases · «Cobro de las clases»
 *   - reservation-settings-appointment-scheduling → Citas · «Horarios de las citas»
 *   - reservation-settings-payments-appointments  → Citas · «Cobro de las citas»
 */
const SECTION_STEPS: { id: string; key: string }[] = [
  { id: 'reservation-settings-public-booking', key: 'publicBooking' },
  { id: 'reservation-settings-scheduling', key: 'scheduling' },
  { id: 'reservation-settings-deposits', key: 'deposits' },
  { id: 'reservation-settings-cancellation', key: 'cancellation' },
  { id: 'reservation-settings-credit-refund', key: 'creditRefund' },
  { id: 'reservation-settings-waitlist', key: 'waitlist' },
  { id: 'reservation-settings-reminders', key: 'reminders' },
  { id: 'reservation-settings-payments-classes', key: 'paymentsClasses' },
  { id: 'reservation-settings-appointment-scheduling', key: 'appointmentScheduling' },
  { id: 'reservation-settings-payments-appointments', key: 'paymentsAppointments' },
]

export function useReservationSettingsTour(setSettingsTab: (tab: SettingsTab) => void) {
  const { t } = useTranslation('reservations')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
    const sectionSteps: DriveStep[] = SECTION_STEPS.map(({ id, key }, index) => ({
      // Función y no selector: driver.js la llama al mostrar el paso, y la sección tiene que estar
      // en su pestaña ACTIVA en ese momento (las otras están montadas pero ocultas).
      element: () => {
        flushSync(() => setSettingsTab(TOUR_TARGET_TAB[id]))
        return document.querySelector(`[data-tour="${id}"]`) as Element
      },
      popover: {
        title: t(`settings.settingsTour.${key}.title`),
        description: t(`settings.settingsTour.${key}.description`),
        side: 'top',
        align: 'start',
        ...(index === SECTION_STEPS.length - 1
          ? buildFinalStepFooter({
              tourName: 'reservation-settings-onboarding',
              cancelLabel: t('tour.cancel', { defaultValue: 'Cancelar' }),
              doneLabel: t('tour.done', { defaultValue: '¡Listo!' }),
              homeLabel: t('tour.backToHome', { defaultValue: 'Volver a inicio' }),
            })
          : {}),
      },
    }))

    const d: Driver = driver({
      popoverClass: 'avoqado-tour-popover',
      showProgress: true,
      allowClose: true,
      animate: true,
      overlayOpacity: 0.65,
      stagePadding: 6,
      stageRadius: 8,
      nextBtnText: t('tour.next', { defaultValue: 'Siguiente →' }),
      prevBtnText: t('tour.prev', { defaultValue: '← Anterior' }),
      doneBtnText: t('tour.done', { defaultValue: '¡Listo!' }),
      progressText: t('tour.progress', { defaultValue: 'Paso {{current}} de {{total}}' }),
      onDestroyed: () => {
        document.body.classList.remove('tour-active')
      },
      onHighlightStarted: (_el, _step, opts) => {
        setTourStepIndex('reservation-settings-onboarding', opts.state.activeIndex ?? 0)
      },
      steps: [
        {
          popover: {
            title: t('settings.settingsTour.welcome.title'),
            description: t('settings.settingsTour.welcome.description'),
          },
        },
        {
          element: '[data-tour="reservation-settings-save"]',
          popover: {
            title: t('settings.settingsTour.save.title'),
            description: t('settings.settingsTour.save.description'),
            side: 'bottom',
            align: 'end',
          },
        },
        ...sectionSteps,
      ],
    })
    return d
  }, [t, setSettingsTab])

  const start = useCallback(() => {
    document.body.classList.add('tour-active')
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    driverRef.current.drive(getTourStepIndex('reservation-settings-onboarding'))
  }, [buildDriver])

  useAtomicTourListener('reservation-settings-onboarding', start)

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
      driverRef.current = null
      document.body.classList.remove('tour-active')
    }
  }, [])

  return { start }
}
