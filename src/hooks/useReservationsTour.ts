import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'

/**
 * Interactive tour for the Reservations module overview.
 *
 * ⚠️ COHERENCIA: Si modificas la UI del módulo de Reservaciones (calendario,
 * lista, settings, widget de reservas en línea), actualiza este tour en
 * paralelo. Los selectores `data-tour="reservations-*"` y
 * `data-tour="reservation-settings-*"` (ya existentes en
 * `ReservationSettings.tsx`) deben seguir apuntando a los elementos que
 * cada paso describe.
 *
 * Selectores requeridos en el DOM:
 *   - `data-tour="reservations-overview-table"` — tabla principal del overview
 *   - `data-tour="reservations-new-btn"` — botón "Crear" en el header
 *   - `data-tour="sidebar-reservations"` — item de Reservaciones en el sidebar
 *     principal (provisto por `nav-main.tsx`); usado para mostrar los
 *     sub-items (calendario, reservas en línea).
 */

export function useReservationsTour() {
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
      steps: [
        {
          popover: {
            title: t('tour.welcome.title', { defaultValue: '📅 Reservaciones' }),
            description: t('tour.welcome.description', {
              defaultValue:
                'Tu centro de reservas. Aquí gestionas el calendario, lista de espera, depósitos y un widget de reservas en línea para tu sitio web.',
            }),
          },
        },
        {
          element: '[data-tour="reservations-overview-table"]',
          popover: {
            title: t('tour.list.title', { defaultValue: 'Reservas del día' }),
            description: t('tour.list.description', {
              defaultValue:
                'Cada reservación con hora, comensales, mesa asignada y estado. Confírmalas, cámbialas de mesa o márcalas como no-show desde aquí.',
            }),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="reservations-new-btn"]',
          popover: {
            title: t('tour.create.title', { defaultValue: 'Crear reservación manual' }),
            description: t('tour.create.description', {
              defaultValue:
                'Cuando un cliente llama por teléfono o llega sin reserva, regístralo aquí. Define hora, comensales, mesa y deposit (si aplica).',
            }),
            side: 'bottom',
            align: 'end',
          },
        },
        {
          element: '[data-tour="sidebar-reservations"]',
          popover: {
            title: t('tour.sidebar.title', { defaultValue: 'Más herramientas en el sidebar' }),
            description: t('tour.sidebar.description', {
              defaultValue:
                'Desde aquí accedes al calendario (vista día/semana/mes), lista de espera y al widget de reservas en línea para tu sitio web.',
            }),
            side: 'right',
            align: 'start',
            ...buildFinalStepFooter({
              tourName: 'reservations-onboarding',
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
    driverRef.current.drive()
  }, [buildDriver])

  useAtomicTourListener('reservations-onboarding', start)

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
      driverRef.current = null
      document.body.classList.remove('tour-active')
    }
  }, [])

  return { start }
}
