import { useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'

/**
 * C3 (ola final, I-1): ventas que se sacaron de la factura global (nota de extracción timbrada) y cuya factura del cliente no salió. Sin
 * esto sólo se ven en su renglón de la lista (que filtra por mes) o en el MCP: el negocio podría tener una venta fuera de la global y
 * sin factura sin enterarse. Ámbar —es algo que revisar, no un error de la pantalla— y sólo si hay alguna. `enProceso` (aparte, no está
 * contada en `total`) son las que ya van en camino.
 */
export function ExtraccionesPendientesAviso({ total, enProceso }: { total: number; enProceso: number }) {
  const { t } = useTranslation('cfdi')
  if (!(total > 0)) return null

  return (
    <div
      role="status"
      data-testid="aviso-extracciones-pendientes"
      className="mb-4 flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-300"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p>
        {t('list.extraccionesPendientes.aviso', { count: total })}
        {enProceso > 0 && <> {t('list.extraccionesPendientes.enProceso', { count: enProceso })}</>}
      </p>
    </div>
  )
}
