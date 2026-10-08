import { useTranslation } from 'react-i18next'
import { WifiOff } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * El aviso de «Sin conexión» de un envío EN PAUSA (E6a-fix2 C5, E6a-fix3): sin red, TanStack deja la mutación en espera y la
 * manda sola al volver la red. Dice qué pasa si se cancela; con `onCancelar` (formularios en línea, sin diálogo que cerrar) trae
 * su propio botón para quitar el envío de la cola.
 */
export function AvisoSinConexion({ texto, onCancelar, dataTour }: { texto: string; onCancelar?: () => void; dataTour?: string }) {
  const { t } = useTranslation('staffPay')
  return (
    <p role="status" className="flex flex-wrap items-start gap-2 rounded-lg border border-amber-500/40 p-3 text-sm" data-tour={dataTour}>
      <WifiOff className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <span className="min-w-0 flex-1">{texto}</span>
      {onCancelar && (
        <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onCancelar}>
          {t('offline.cancelSend')}
        </Button>
      )}
    </p>
  )
}
