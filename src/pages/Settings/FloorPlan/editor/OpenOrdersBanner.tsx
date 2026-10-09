import { useTranslation } from 'react-i18next'
import { TriangleAlert, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface OpenOrdersBannerProps {
  /** Números que el servidor nombró (422 `TABLES_WITH_OPEN_ORDERS`). */
  numbers: string[]
  /** Se pueden regresar desde el plano guardado (si ya están en el borrador, no hay botón). */
  canRestore: boolean
  onRestore: () => void
  onDismiss: () => void
}

/**
 * H2: el plano no se guardó porque quitaba mesas que tienen una cuenta abierta. Ya no están en el lienzo, así que no
 * hay qué «señalar»: el aviso se queda a la vista (no se va solo como un toast) y ofrece regresarlas tal como estaban.
 */
export function OpenOrdersBanner({ numbers, canRestore, onRestore, onDismiss }: OpenOrdersBannerProps) {
  const { t } = useTranslation('floorPlan')
  const count = numbers.length
  const list = numbers.join(', ')
  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-muted px-4 py-3"
      data-testid="floor-plan-open-orders"
      data-tour="floor-plan-open-orders"
    >
      <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden />
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">{t('openOrders.title', { count, numbers: list })}</p>
        <p className="text-sm text-foreground/80">{t('openOrders.body', { count })}</p>
      </div>
      {canRestore && (
        <Button type="button" size="sm" className="h-9 shrink-0 cursor-pointer" onClick={onRestore} data-testid="floor-plan-restore-tables" data-tour="floor-plan-restore-tables">
          <Undo2 className="mr-2 h-4 w-4" />
          {t('openOrders.restore', { count })}
        </Button>
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-9 w-9 shrink-0 cursor-pointer"
        aria-label={t('openOrders.dismiss')}
        onClick={onDismiss}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}
