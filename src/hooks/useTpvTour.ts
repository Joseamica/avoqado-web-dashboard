import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener } from '@/hooks/useAtomicTourListener'
import { buildFinalStepFooter } from '@/lib/atomic-tour-final-step'
import { getTourStepIndex, setTourStepIndex } from '@/lib/tour-progress'

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
      onHighlightStarted: (_el, _step, opts) => {
        setTourStepIndex('tpv-onboarding', opts.state.activeIndex ?? 0)
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
            title: t('tour.list.title', { defaultValue: 'Tus dispositivos' }),
            description: t('tour.list.description', {
              defaultValue:
                'Aquí ves cada terminal, celular, tablet y computadora: si está en línea, su sistema, batería, versión de la app y lo que cobró hoy. Toca uno para ver su detalle; el botón «⋯» tiene las acciones.',
            }),
            side: 'top',
            align: 'start',
          },
        },
        {
          element: '[data-tour="tpv-new-btn"]',
          popover: {
            title: t('tour.add.title', { defaultValue: 'Agregar dispositivo' }),
            description: t('tour.add.description', {
              defaultValue:
                'Desde aquí compras una terminal de cobro. Los celulares, tablets y computadoras no se registran: basta con iniciar sesión en la app Avoqado y aparecen solos en esta lista.',
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
    driverRef.current.drive(getTourStepIndex('tpv-onboarding'))
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
