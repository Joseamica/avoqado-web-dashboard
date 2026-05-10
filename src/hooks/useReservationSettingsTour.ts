import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'
import { getTourStepIndex, setTourStepIndex } from '@/lib/tour-progress'

/**
 * Interactive tour for the Reservation Settings page.
 *
 * ⚠️ COHERENCIA: cada paso apunta a una sección de
 * `src/pages/Reservations/ReservationSettings.tsx`. Si renombras o eliminas
 * uno de los `data-tour="reservation-settings-*"` selectors, actualiza este
 * tour. Los selectores existentes:
 *
 *   - reservation-settings-save        → Botón "Guardar Cambios" sticky
 *   - reservation-settings-scheduling  → Sección "Programación" (citas)
 *   - reservation-settings-pacing      → Sección "Ritmo" (citas)
 *   - reservation-settings-deposits    → Sección "Depósitos"
 *   - reservation-settings-payments    → Sección "Pagos por tipo"
 *   - reservation-settings-public-booking → "Reservaciones Online"
 *   - reservation-settings-cancellation → "Cancelación"
 *   - reservation-settings-credit-refund → "Reembolsos en créditos" (clases)
 *   - reservation-settings-waitlist    → "Lista de espera"
 *   - reservation-settings-reminders   → "Recordatorios"
 */
export function useReservationSettingsTour() {
  const { t } = useTranslation('reservations')
  const driverRef = useRef<Driver | null>(null)

  const buildDriver = useCallback((): Driver => {
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
        {
          element: '[data-tour="reservation-settings-scheduling"]',
          popover: {
            title: t('settings.settingsTour.scheduling.title'),
            description: t('settings.settingsTour.scheduling.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-pacing"]',
          popover: {
            title: t('settings.settingsTour.pacing.title'),
            description: t('settings.settingsTour.pacing.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-deposits"]',
          popover: {
            title: t('settings.settingsTour.deposits.title'),
            description: t('settings.settingsTour.deposits.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-payments"]',
          popover: {
            title: t('settings.settingsTour.payments.title'),
            description: t('settings.settingsTour.payments.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-public-booking"]',
          popover: {
            title: t('settings.settingsTour.publicBooking.title'),
            description: t('settings.settingsTour.publicBooking.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-cancellation"]',
          popover: {
            title: t('settings.settingsTour.cancellation.title'),
            description: t('settings.settingsTour.cancellation.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-credit-refund"]',
          popover: {
            title: t('settings.settingsTour.creditRefund.title'),
            description: t('settings.settingsTour.creditRefund.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-waitlist"]',
          popover: {
            title: t('settings.settingsTour.waitlist.title'),
            description: t('settings.settingsTour.waitlist.description'),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservation-settings-reminders"]',
          popover: {
            title: t('settings.settingsTour.reminders.title'),
            description: t('settings.settingsTour.reminders.description'),
            side: 'top',
            align: 'start',
            ...buildFinalStepFooter({
              tourName: 'reservation-settings-onboarding',
              cancelLabel: t('tour.cancel', { defaultValue: 'Cancelar' }),
              doneLabel: t('tour.done', { defaultValue: '¡Listo!' }),
              homeLabel: t('tour.backToHome', { defaultValue: 'Volver a inicio' }),
            }),
          },
        },
      ],
    })
    return d
  }, [t])

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
