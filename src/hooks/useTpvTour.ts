import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'

/**
 * Interactive tour for the TPV (point-of-sale terminal) page.
 *
 * ⚠️ COHERENCIA: Si modificas la UI del TPV page (lista de terminales, botón
 * de registrar nuevo, configuración de TPV), actualiza este tour en paralelo.
 * Los selectores `data-tour="tpv-*"` deben seguir apuntando a los elementos
 * que cada paso describe. Si añades una columna o un wizard step nuevo,
 * agrega/quita su step aquí también.
 *
 * Selectores requeridos en el DOM:
 *   - `data-tour="tpv-list"` — contenedor de la lista/tabla de TPVs
 *   - `data-tour="tpv-new-btn"` — botón "Registrar terminal"
 */

export function useTpvTour() {
  const { t } = useTranslation('tpv')
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
            title: t('tour.welcome.title', { defaultValue: '📱 Tus terminales (TPV)' }),
            description: t('tour.welcome.description', {
              defaultValue:
                'Aquí registras y administras los dispositivos PAX/Android donde tu equipo cobra. Cada terminal queda vinculada a tu venue y puede tener su propia configuración.',
            }),
          },
        },
        {
          element: '[data-tour="tpv-list"]',
          popover: {
            title: t('tour.list.title', { defaultValue: 'Tus terminales activas' }),
            description: t('tour.list.description', {
              defaultValue:
                'Verás aquí cada dispositivo: número de serie, último uso, estado (online/offline) y meseros activos. Click en una terminal para ver detalle y configuración.',
            }),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="tpv-new-btn"]',
          popover: {
            title: t('tour.add.title', { defaultValue: 'Registrar terminal nueva' }),
            description: t('tour.add.description', {
              defaultValue:
                'Para añadir un dispositivo: instala la app Avoqado TPV en el equipo, escanea el QR que aparece aquí, y la terminal queda emparejada al venue.',
            }),
            side: 'bottom',
            align: 'end',
            ...buildFinalStepFooter({
              tourName: 'tpv-onboarding',
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

  useAtomicTourListener('tpv-onboarding', start)

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
      driverRef.current = null
      document.body.classList.remove('tour-active')
    }
  }, [])

  return { start }
}
