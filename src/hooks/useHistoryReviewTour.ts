import { driver, type Driver } from 'driver.js'
import 'driver.js/dist/driver.css'
import { useCallback, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomicTourListener, notifyAtomicTourCompleted } from '@/hooks/useAtomicTourListener'

/**
 * Interactive onboarding tour for the Inventory History page.
 * Teaches how to read the audit trail and use filters to investigate
 * specific events (a missing product, a supplier dispute, a monthly close).
 *
 * This is a READ-ONLY tour — no auto-click / state mutations. It's purely
 * explanatory because the page is an audit log.
 *
 * Required `data-tour` attributes (in InventoryHistory.tsx):
 *   - `history-filters`      — Filters row container
 *   - `history-filter-type`  — Type (movement) filter pill
 *   - `history-table`        — The audit log table
 */
export function useHistoryReviewTour() {
  const { t } = useTranslation('inventory')
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
      progressText: t('tour.progress', {
        defaultValue: 'Paso {{current}} de {{total}}',
      }),
      steps: [
        // 1) Welcome
        {
          popover: {
            title: t('tourHistory.welcome.title', {
              defaultValue: '📜 Historial de movimientos',
            }),
            description: t('tourHistory.welcome.description', {
              defaultValue:
                'Aquí queda <b>registrado cada cambio</b> de tu inventario: ventas, compras, ajustes, mermas, robos, devoluciones.<br/><br/>Es tu <b>auditoría</b>: no se puede editar ni borrar. Si algo no cuadra, aquí encuentras la respuesta.',
            }),
          },
        },

        // 2) Highlight the table
        {
          element: '[data-tour="history-table"]',
          popover: {
            title: t('tourHistory.step1.title', {
              defaultValue: 'La tabla',
            }),
            description: t('tourHistory.step1.description', {
              defaultValue:
                'Cada fila es un movimiento. Las columnas más importantes:<br/><br/>• <b>Fecha</b> · cuándo ocurrió<br/>• <b>Nombre</b> · qué artículo o ingrediente<br/>• <b>Proveedor</b> · si hubo uno involucrado<br/>• <b>Coste total</b> · impacto económico del movimiento<br/>• <b>Ajuste</b> · cuántas unidades se sumaron o restaron<br/><br/>Haz clic en cualquier fila para ver el detalle completo.',
            }),
            side: 'top',
            align: 'start',
          },
        },

        // 3) Filters row
        {
          element: '[data-tour="history-filters"]',
          popover: {
            title: t('tourHistory.step2.title', {
              defaultValue: 'Filtros para investigar',
            }),
            description: t('tourHistory.step2.description', {
              defaultValue:
                'Cuando algo no cuadra, filtra para encontrarlo:<br/><br/>• <b>Fecha</b> · "¿Qué pasó el martes pasado?"<br/>• <b>SKU</b> · "¿Qué le pasó a este producto?"<br/>• <b>Proveedor</b> · "¿Qué entró de Lácteos del Valle?"<br/>• <b>Coste total</b> · movimientos grandes<br/>• <b>Tipo</b> · filtra por clase de movimiento',
            }),
            side: 'bottom',
            align: 'start',
          },
        },

        // 4) Type filter — the most powerful
        {
          element: '[data-tour="history-filter-type"]',
          popover: {
            title: t('tourHistory.step3.title', {
              defaultValue: 'Filtro por Tipo — el más útil',
            }),
            description: t('tourHistory.step3.description', {
              defaultValue:
                'Filtra por <b>tipo de movimiento</b> para detectar patrones:<br/><br/>• Ver solo <b>ventas</b> → confirma que el TPV descontó correcto<br/>• Ver solo <b>ajustes manuales</b> → audita decisiones del equipo<br/>• Ver solo <b>mermas / robos / daños</b> → calcula pérdidas del mes<br/>• Ver solo <b>compras recibidas</b> → contabiliza entradas',
            }),
            side: 'bottom',
            align: 'end',
          },
        },

        // 5) Complete
        {
          popover: {
            title: t('tourHistory.complete.title', {
              defaultValue: '🔍 Usos típicos del historial',
            }),
            description: t('tourHistory.complete.description', {
              defaultValue:
                '• <b>Al cierre del día</b>: filtro por fecha = hoy. Revisa movimientos sospechosos.<br/>• <b>Al cierre del mes</b>: filtro por fecha + tipo = Pérdida/Daño/Robo. Calcula mermas.<br/>• <b>Discrepancia en conteo</b>: filtro por SKU. Rastrea cada entrada y salida de ese producto.<br/>• <b>Auditoría de equipo</b>: filtro por tipo = Ajuste manual. Revisa quién hizo qué.',
            }),
            onNextClick: () => {
              notifyAtomicTourCompleted('history')
              d.destroy()
            },
          },
        },
      ],
    })

    return d
  }, [t])

  const start = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = buildDriver()
    driverRef.current.drive()
  }, [buildDriver])

  const stop = useCallback(() => {
    driverRef.current?.destroy()
    driverRef.current = null
  }, [])

  useEffect(() => {
    return () => {
      driverRef.current?.destroy()
    }
  }, [])

  useAtomicTourListener('history', start)

  return { start, stop }
}
