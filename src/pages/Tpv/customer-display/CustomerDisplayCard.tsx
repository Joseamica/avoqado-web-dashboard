import { AlertTriangle, Copy, Pencil, RefreshCw } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useToast } from '@/hooks/use-toast'
import { isTerminalOnline } from '@/lib/terminal-status'
import { cn } from '@/lib/utils'
import type { CustomerDisplayDesign } from '@/services/customerDisplay.service'
import { DEFAULT_TPV_SETTINGS } from '@/services/tpv-settings.service'
import { textoDelServidor } from '@/utils/apiError'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { CopyDesignDialog } from './CopyDesignDialog'
import { CustomerDisplayEditor } from './CustomerDisplayEditor'
import { CLAVE_DEL_HISTORIAL, estadoDeLaPantalla, haceCuanto, type Historial } from './estado'
import { esDisenoDeFabrica } from './model'
import { useCustomerDisplay, usePasosDelCobro } from './queries'
import { TabletPreview } from './TabletPreview'

/**
 * Texto de aviso suelto sobre la tarjeta (sin fondo de aviso), con los tokens semánticos del editor y de copiar: en claro, el
 * tono oscuro del aviso; en oscuro, el ámbar, porque ahí `warning-foreground` es casi blanco (va SOBRE `bg-warning-muted`).
 */
const TEXTO_DE_AVISO = 'text-warning-foreground dark:text-warning'

const COLOR_DEL_HISTORIAL: Partial<Record<Historial['tipo'], string>> = {
  pendiente: TEXTO_DE_AVISO,
  recibido: TEXTO_DE_AVISO,
  noSoportado: 'text-destructive',
  // El tema todavía no registra un token de éxito para Tailwind (`--success` existe en index.css, pero no `--color-success`
  // en `@theme`, así que `text-success` no genera nada): se queda el verde de la paleta.
  mostrado: 'text-emerald-600 dark:text-emerald-400',
}

export interface CustomerDisplayCardProps {
  venueId: string
  terminalId: string
  deviceName: string
  venueName: string
  /**
   * 🔴 El latido VIGENTE del aparato: el de la página (`TpvId`, cuya consulta se refresca por socket), el mismo que usa el
   * encabezado. La vista de la tarjeta deja de refrescarse al llegar a «Mostrado», así que su `lastHeartbeat` envejece y
   * decía «Sin conexión» junto a un encabezado «En línea» (Codex #3, revisión final I1). Sin esta prop, se usa el de la vista.
   */
  latidoVigente?: string | null
}

/**
 * La tarjeta del diseño (spec §6.1): miniatura, histórico (el acuse del aparato, con la hora del server) y presente (latido
 * y segunda pantalla) por separado, y las dos acciones. El editor y la copia se MONTAN sólo abiertos y se desmontan al
 * cerrar: el editor depende de eso para soltar su navegación retenida, y la copia congela su origen al montarse.
 */
export function CustomerDisplayCard({ venueId, terminalId, deviceName, venueName, latidoVigente }: CustomerDisplayCardProps) {
  const { t, i18n } = useTranslation('customerDisplay')
  const { can } = useAccess()
  const { toast } = useToast()
  const { formatDateTime } = useVenueDateTime()
  const puedeVer = can('customer-display:read')
  const puedeEditar = can('customer-display:update')
  const pantalla = useCustomerDisplay(venueId, terminalId, puedeVer)
  // Los pasos sólo pintan la miniatura y le dicen al editor si son conocidos: sin ver la pantalla, ni se piden.
  const pasos = usePasosDelCobro(terminalId, puedeVer && can('tpv-settings:read'))
  const [editando, setEditando] = useState(false)
  // 🔴 La FOTO del origen al pulsar «Copiar» (Codex #8): el diálogo copia ESTO aunque la consulta se refresque debajo.
  const [copia, setCopia] = useState<{ editToken: string; design: CustomerDisplayDesign } | null>(null)

  // Sin permiso de ver: se explica, SIN consultar (spec §6.1).
  if (!puedeVer) return <p className="text-sm text-muted-foreground">{t('card.noReadPermission')}</p>
  if (pantalla.isLoading) return <Skeleton className="h-36 w-full rounded-xl" />
  // 🔴 Codex #3: el error COMPLETO sólo cuando no hay nada que enseñar. Con datos, una reconsulta fallida deja montados la
  // tarjeta y el editor (con su borrador) y se avisa abajo; TanStack conserva `data` y prende `isError` a la vez.
  if (!pantalla.data) {
    const delServidor = textoDelServidor(pantalla.error)
    return (
      <div role="alert" className="space-y-2 rounded-lg border border-input p-3 text-sm">
        <p>{t('card.loadError')}</p>
        {delServidor && <p className="text-xs text-muted-foreground">{delServidor}</p>}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="cursor-pointer"
          onClick={() => void pantalla.refetch()}
          disabled={pantalla.isFetching}
          data-tour="customer-display-card-retry"
        >
          {t('card.retry')}
        </Button>
      </div>
    )
  }

  const view = pantalla.data
  const estado = estadoDeLaPantalla(view)
  const deFabrica = esDisenoDeFabrica(view.design)
  const ajustes = pasos.data ?? DEFAULT_TPV_SETTINGS
  // Sin poder leer los pasos (sin permiso, error, o un guardado cuya respuesta se perdió), la vista previa usa los de
  // siempre y LO DICE: nunca presenta la propina como conocida (Codex #4).
  const pasosConocidos = pasos.data !== undefined && !pasos.isError
  const { historial } = estado
  const latido = latidoVigente !== undefined ? latidoVigente : estado.latido
  const textoDelHistorial = t(CLAVE_DEL_HISTORIAL[historial.tipo], 'fecha' in historial ? { date: formatDateTime(historial.fecha) } : undefined)
  const agregados = [
    estado.imagenesDescargandose > 0 ? t('status.imagesPending', { count: estado.imagenesDescargandose }) : null,
    estado.imagenesFallidas > 0 ? t('status.imagesFailed', { count: estado.imagenesFallidas }) : null,
  ]
    .filter(Boolean)
    .join(' ')

  const alCopiar = () => {
    if (deFabrica) {
      toast({ title: t('card.copyNeedsDesign') })
      return
    }
    setCopia({ editToken: view.editToken, design: view.design })
  }

  return (
    <div className="space-y-4" data-testid="customer-display-card">
      <div className="grid gap-4 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-center">
        <TabletPreview ficha={view.ficha} momento="espera" nombreDelNegocio={venueName} pasos={ajustes} tamano="miniatura" />
        <div className="min-w-0 space-y-2">
          <Badge variant={deFabrica ? 'outline' : 'secondary'}>{t(deFabrica ? 'card.designFactory' : 'card.designOwn')}</Badge>
          <p className={cn('text-sm', COLOR_DEL_HISTORIAL[historial.tipo] ?? 'text-muted-foreground')}>
            {agregados ? `${textoDelHistorial} ${agregados}` : textoDelHistorial}
          </p>
          {estado.promosPidenActualizar && <p className="text-xs text-muted-foreground">{t('status.promosNeedUpdate')}</p>}
          {estado.avisoDeInstalaciones && (
            <p className={cn('flex items-start gap-1.5 text-xs', TEXTO_DE_AVISO)}>
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {t('status.installationWarning')}
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            {/* 🔴 «Activo» con la MISMA regla del encabezado (`isTerminalOnline`, umbral TERMINAL_ONLINE_THRESHOLD_MS) y con el
                MISMO latido (el vigente de la página): nunca «activo» ni «Sin conexión» contra lo que dice el encabezado. */}
            {latido
              ? t(isTerminalOnline(latido) ? 'status.heartbeat' : 'status.offline', {
                  ago: haceCuanto(latido, getIntlLocale(i18n.language)),
                })
              : t('status.noHeartbeat')}
          </p>
          <p className="text-xs text-muted-foreground">
            {estado.presencia.tipo === 'detectada'
              ? t('status.displayDetected', { date: formatDateTime(estado.presencia.fecha) })
              : t(estado.presencia.tipo === 'ausente' ? 'status.displayAbsent' : 'status.displayUnknown')}
          </p>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {pantalla.isError && (
              <span role="status" className={TEXTO_DE_AVISO}>
                {t('status.refreshError')}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 h-7 cursor-pointer px-2 text-xs text-muted-foreground"
              onClick={() => void pantalla.refetch()}
              disabled={pantalla.isFetching}
              data-tour="customer-display-refresh"
            >
              <RefreshCw className={cn(pantalla.isFetching && 'animate-spin')} aria-hidden="true" />
              {t('status.refresh')}
            </Button>
          </div>
          {puedeEditar ? (
            <div className="flex flex-wrap gap-2 pt-1">
              <Button type="button" size="sm" className="cursor-pointer" onClick={() => setEditando(true)} data-tour="customer-display-edit-btn">
                <Pencil aria-hidden="true" />
                {t('card.edit')}
              </Button>
              <Button type="button" size="sm" variant="outline" className="cursor-pointer" onClick={alCopiar} data-tour="customer-display-copy-btn">
                <Copy aria-hidden="true" />
                {t('card.copy')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t('card.readOnly')}</p>
          )}
        </div>
      </div>

      {editando && (
        <CustomerDisplayEditor
          onClose={() => setEditando(false)}
          venueId={venueId}
          terminalId={terminalId}
          deviceName={deviceName}
          venueName={venueName}
          view={view}
          pasos={ajustes}
          pasosConocidos={pasosConocidos}
        />
      )}
      {copia && (
        <CopyDesignDialog
          onClose={() => setCopia(null)}
          venueId={venueId}
          source={{ terminalId, name: deviceName, editToken: copia.editToken, design: copia.design }}
          // El token de la vista VIVA (no el de la foto): si deja de coincidir, el diálogo sabe que el origen cambió.
          tokenVigente={view.editToken}
          entitlements={view.entitlements}
        />
      )}
    </div>
  )
}
