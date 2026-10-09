import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Hash, TriangleAlert, Undo2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface EditorNoticeProps {
  title: string
  body: string
  icon?: ReactNode
  /** Botón de acción (opcional). */
  action?: { label: string; onClick: () => void; icon?: ReactNode; testId: string; tour: string }
  /** Sin `onDismiss` el aviso no se puede cerrar: se va cuando el problema se arregla. */
  onDismiss?: () => void
  testId: string
  tour: string
}

/**
 * Aviso del editor que se queda a la vista (no se va solo como un toast) hasta que se resuelve o se cierra. Fondo y
 * borde de advertencia del tema; el texto va en el color del texto (nunca gris sobre color).
 */
function EditorNotice({ title, body, icon, action, onDismiss, testId, tour }: EditorNoticeProps) {
  const { t } = useTranslation('floorPlan')
  return (
    <div role="alert" className="flex items-start gap-3 rounded-2xl border border-warning-border bg-warning-muted px-4 py-3" data-testid={testId} data-tour={tour}>
      <span className="mt-0.5 shrink-0 text-warning" aria-hidden>
        {icon ?? <TriangleAlert className="h-5 w-5" />}
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-foreground/80">{body}</p>
      </div>
      {action && (
        <Button type="button" size="sm" className="h-9 shrink-0 cursor-pointer" onClick={action.onClick} data-testid={action.testId} data-tour={action.tour}>
          {action.icon}
          {action.label}
        </Button>
      )}
      {onDismiss && (
        <Button type="button" variant="ghost" size="icon" className="h-9 w-9 shrink-0 cursor-pointer" aria-label={t('openOrders.dismiss')} onClick={onDismiss}>
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  )
}

/**
 * H2: el plano no se guardó porque quitaba mesas que tienen una cuenta abierta. Ya no están en el lienzo, así que no
 * hay qué «señalar»: el aviso se queda y ofrece regresarlas tal como estaban.
 */
export function OpenOrdersNotice({ numbers, canRestore, onRestore, onDismiss }: { numbers: string[]; canRestore: boolean; onRestore: () => void; onDismiss: () => void }) {
  const { t } = useTranslation('floorPlan')
  const count = numbers.length
  return (
    <EditorNotice
      title={t('openOrders.title', { count, numbers: numbers.join(', ') })}
      body={t('openOrders.body', { count })}
      action={
        canRestore
          ? { label: t('openOrders.restore', { count }), onClick: onRestore, icon: <Undo2 className="mr-2 h-4 w-4" />, testId: 'floor-plan-restore-tables', tour: 'floor-plan-restore-tables' }
          : undefined
      }
      onDismiss={onDismiss}
      testId="floor-plan-open-orders"
      tour="floor-plan-open-orders"
    />
  )
}

/**
 * Dos mesas con el mismo número: el servidor rechazaría el plano. Se dice cuál y no se deja guardar hasta cambiarlo.
 * Si una de ellas tiene cuenta abierta (la que se regresó tras un 422), la que hay que cambiar es la otra: «la nueva».
 */
export function DuplicateNumbersNotice({ numbers, newOneTaken, onShow }: { numbers: string[]; newOneTaken: boolean; onShow: () => void }) {
  const { t } = useTranslation('floorPlan')
  const count = numbers.length
  return (
    <EditorNotice
      icon={<Hash className="h-5 w-5" />}
      title={t('duplicates.title', { count, numbers: numbers.join(', ') })}
      body={t(newOneTaken ? 'duplicates.bodyNew' : 'duplicates.body', { count })}
      action={{ label: t(newOneTaken ? 'duplicates.showNew' : 'duplicates.show'), onClick: onShow, testId: 'floor-plan-duplicates-show', tour: 'floor-plan-duplicates-show' }}
      testId="floor-plan-duplicates"
      tour="floor-plan-duplicates"
    />
  )
}
