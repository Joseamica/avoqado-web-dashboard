import { useQuery } from '@tanstack/react-query'
import { AlertTriangle } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Skeleton } from '@/components/ui/skeleton'
import { useAccess } from '@/hooks/use-access'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { cn } from '@/lib/utils'
import { TerminalAreaTicketEditor } from '@/pages/Settings/components/areaTickets/TerminalAreaTicketEditor'
import { getAreaTicketOverview } from '@/services/areaTickets.service'
import { esDisenoDeFabrica, superficieDeLaPantalla } from '../customer-display/model'
import { useCustomerDisplay, usePasosDelCobro } from '../customer-display/queries'
import { papelCorto, papelDelAparato, type AreaDeLaFicha } from '../papelDelAparato'
import { DeviceMenusEditor } from './DeviceMenusEditor'
import type { SeccionDeLaFicha } from './useIrALaSeccion'

export interface DeviceMenusDeLaFicha {
  menus: Array<{ id: string; name: string }>
  needsAppUpdate: boolean
}

/** Lo que el bloque lee de la ficha (`TpvData` de `TpvId.tsx`). Un SERVIDOR viejo no manda los campos de vales ni de menú. */
export interface FichaDelBloque {
  id: string
  name: string
  type?: string
  canIssueAreaTickets?: boolean
  canCheckoutAreaTickets?: boolean
  canDeliverAreaTickets?: boolean
  defaultWorkspace?: string
  fulfillmentArea?: AreaDeLaFicha | null
  areaTicketsEnabled?: boolean
  deviceMenus?: DeviceMenusDeLaFicha
}

const PASOS = [
  ['showTipScreen', 'customerDisplay:steps.tip'],
  ['showReviewScreen', 'customerDisplay:steps.review'],
  ['showReceiptScreen', 'customerDisplay:steps.receipt'],
] as const

const TEXTO_DE_AVISO = 'text-warning-foreground dark:text-warning'

/**
 * Aparatos claros, Paso 2 (9-nov-2026): arriba de la ficha, «Qué hace este aparato» en orden fijo, cada renglón con su valor
 * y, con permiso, «Cambiar» ahí mismo. Reemplaza los cuadros del Paso 1 y conserva sus verdades: «Emite» = la regla de
 * ANDROID; con «Emitir» y «Cobrar» sólo emite (D5); el aviso ámbar de «Emitir» sin efecto; la comanda en texto y nunca
 * prometida con «Preparar después de pagar». Papel y menú se editan en una ventana encima; cobro y pantalla del cliente ya se
 * editan en la misma ficha, así que «Cambiar» lleva a su sección (`onGoTo`).
 */
export function DeviceSetupBlock({
  venueId,
  tpv,
  fullBasePath,
  onGoTo,
}: {
  venueId: string
  tpv: FichaDelBloque
  fullBasePath: string
  onGoTo: (s: SeccionDeLaFicha) => void
}) {
  const { t } = useTranslation('tpv')
  const { can } = useAccess()
  const superficie = superficieDeLaPantalla(tpv.type)
  const papel = papelDelAparato(tpv)

  return (
    <Card data-tour="device-setup-block">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">{t('device.setup.title')}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="divide-y divide-border">
          <RenglonDelPapel venueId={venueId} tpv={tpv} fullBasePath={fullBasePath} />
          {tpv.deviceMenus && <RenglonDelMenu tpv={tpv} deviceMenus={tpv.deviceMenus} fullBasePath={fullBasePath} />}
          {superficie !== 'ninguna' && <RenglonDelCobro tpv={tpv} noCobra={papel?.noCobra ?? false} onGoTo={onGoTo} />}
          {superficie === 'diseno' && can('customer-display:read') && <RenglonDeLaPantalla venueId={venueId} tpv={tpv} onGoTo={onGoTo} />}
        </dl>
        <p className="mt-2 text-xs text-muted-foreground">{t('device.setup.appliesOnReconnect')}</p>
      </CardContent>
    </Card>
  )
}

function Renglon({ label, tour, action, children }: { label: string; tour: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-start sm:gap-4" data-tour={tour}>
      <dt className="text-sm text-muted-foreground sm:w-40 sm:shrink-0">{label}</dt>
      <dd className="min-w-0 flex-1 space-y-1 text-sm">{children}</dd>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

function BotonCambiar({ onClick, tour }: { onClick: () => void; tour: string }) {
  const { t } = useTranslation('tpv')
  return (
    <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={onClick} data-tour={tour}>
      {t('device.setup.change')}
    </Button>
  )
}

function Aviso({ children }: { children: ReactNode }) {
  return (
    <p className={cn('flex items-start gap-1.5 text-xs', TEXTO_DE_AVISO)}>
      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {children}
    </p>
  )
}

function RenglonDelPapel({ venueId, tpv, fullBasePath }: { venueId: string; tpv: FichaDelBloque; fullBasePath: string }) {
  const { t } = useTranslation('tpv')
  const { can } = useAccess()
  const [editando, setEditando] = useState(false)
  const vales = can('area-tickets:configure')
  const corto = papelCorto({ ...tpv, type: tpv.type ?? '' }, tpv.areaTicketsEnabled)
  const papel = papelDelAparato(tpv)
  const area = papel?.tipo === 'emite' ? papel.area : null
  // Codex r3 #2 (Paso 1): con «Preparar después de pagar» la comanda no sale al emitir: no se promete «Manda comanda».
  const comandaCierta = area && !(area.sendsComanda && area.fulfillmentMode === 'PREPARE_ON_PAID')
  const puedeCambiar = tpv.areaTicketsEnabled === true && vales && corto.clave !== 'terminalDeCobro'

  return (
    <Renglon
      label={t('device.setup.what')}
      tour="device-setup-papel"
      action={puedeCambiar && <BotonCambiar onClick={() => setEditando(true)} tour="device-setup-papel-change" />}
    >
      <p className="font-medium">{t(`device.papel.${corto.clave}`, corto.area ? { area: corto.area } : undefined)}</p>
      {corto.aviso && (
        <Aviso>{t(corto.clave === 'sinElegir' ? `device.setup.entregarSinEfecto.${corto.aviso}` : `device.role.emitirSinEfecto.${corto.aviso}`)}</Aviso>
      )}
      {area && comandaCierta && (
        <p className="text-muted-foreground" data-tour="device-setup-comanda">
          {t(area.sendsComanda ? 'device.role.comandaOn' : 'device.role.comandaOff')} ·{' '}
          {t(area.sendsComanda ? 'device.role.comandaOnDetail' : 'device.role.comandaOffDetail')}
          {vales && (
            <>
              {' · '}
              <Link to={`${fullBasePath}/settings/area-tickets#areas`} className="font-medium text-foreground underline underline-offset-4">
                {t('device.setup.changeInAreas')}
              </Link>
            </>
          )}
        </p>
      )}
      {editando && <EditorDelPapel venueId={venueId} tpv={tpv} onClose={() => setEditando(false)} />}
    </Renglon>
  )
}

/** Se monta sólo abierto: el overview de vales se pide al abrir, nunca antes. */
function EditorDelPapel({ venueId, tpv, onClose }: { venueId: string; tpv: FichaDelBloque; onClose: () => void }) {
  const { t } = useTranslation('tpv')
  const overview = useQuery({ queryKey: ['area-ticket-overview', venueId], queryFn: () => getAreaTicketOverview(venueId) })
  const terminal = overview.data?.terminals.find(x => x.id === tpv.id)

  return (
    <FullScreenModal open onClose={onClose} title={t('device.setup.papelEditorTitle', { name: tpv.name })} contentClassName="bg-muted/30">
      <div className="mx-auto max-w-3xl p-4 sm:p-6">
        <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-6" data-tour="device-setup-papel-editor">
          {overview.isLoading ? (
            <Skeleton className="h-24 w-full" />
          ) : !overview.data ? (
            <div role="alert" className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>{t('device.setup.loadError')}</span>
              <Button type="button" variant="outline" size="sm" onClick={() => void overview.refetch()} disabled={overview.isFetching}>
                {t('device.setup.retry')}
              </Button>
            </div>
          ) : !terminal ? (
            <p className="text-sm text-muted-foreground">{t('device.setup.notInOverview')}</p>
          ) : (
            <TerminalAreaTicketEditor
              venueId={venueId}
              terminal={terminal}
              areas={overview.data.areas}
              profiles={overview.data.scaleProfiles}
              showScale={overview.data.effective.scales}
            />
          )}
          <p className="text-xs text-muted-foreground">{t('device.setup.appliesOnReconnect')}</p>
        </div>
      </div>
    </FullScreenModal>
  )
}

function RenglonDelMenu({ tpv, deviceMenus, fullBasePath }: { tpv: FichaDelBloque; deviceMenus: DeviceMenusDeLaFicha; fullBasePath: string }) {
  const { t } = useTranslation('tpv')
  const { can } = useAccess()
  const plan = useTierFeatureAccess('DEVICE_MENUS')
  const [editando, setEditando] = useState(false)
  // 🔴 Hasta que el plan se resuelve, el acceso es provisional (fail-open): sin botón, ni para el teclado (Codex r2 #2).
  const puedeCambiar = can('tpv:update') && plan.isResolved && plan.hasAccess
  const tier = plan.requiredTier.charAt(0) + plan.requiredTier.slice(1).toLowerCase()

  return (
    <Renglon
      label={t('device.setup.menu')}
      tour="device-setup-menu"
      action={
        puedeCambiar ? (
          <BotonCambiar onClick={() => setEditando(true)} tour="device-setup-menu-change" />
        ) : plan.isResolved && !plan.hasAccess ? (
          <Link to={`${fullBasePath}/devices?tab=menus`} className="text-xs font-medium text-foreground underline underline-offset-4">
            {t('device.setup.menuPlanInvite', { tier })}
          </Link>
        ) : undefined
      }
    >
      <p className="font-medium">{deviceMenus.menus.length ? deviceMenus.menus.map(m => m.name).join(', ') : t('device.role.allMenus')}</p>
      {deviceMenus.needsAppUpdate && <p className="text-xs text-muted-foreground">{t('device.role.menuNeedsUpdate')}</p>}
      {editando && puedeCambiar && (
        <FullScreenModal
          open
          onClose={() => setEditando(false)}
          title={t('device.setup.menuEditorTitle', { name: tpv.name })}
          contentClassName="bg-muted/30"
        >
          <div className="mx-auto max-w-3xl p-4 sm:p-6">
            <div className="space-y-4 rounded-2xl border border-border/50 bg-card p-6" data-tour="device-setup-menu-editor">
              <DeviceMenusEditor terminalId={tpv.id} menus={deviceMenus.menus} canEdit deviceName={tpv.name} />
              <p className="text-xs text-muted-foreground">{t('device.setup.appliesOnReconnect')}</p>
            </div>
          </div>
        </FullScreenModal>
      )}
    </Renglon>
  )
}

function RenglonDelCobro({ tpv, noCobra, onGoTo }: { tpv: FichaDelBloque; noCobra: boolean; onGoTo: (s: SeccionDeLaFicha) => void }) {
  const { t } = useTranslation(['tpv', 'customerDisplay'])
  const { can } = useAccess()
  const puedeVer = can('tpv-settings:read')
  // La misma consulta (y caché) que `CheckoutStepsSection`: no pide nada de más.
  const pasos = usePasosDelCobro(tpv.id, puedeVer)
  const ajustes = pasos.data
  const prendidos = ajustes ? PASOS.filter(([clave]) => ajustes[clave]).map(([, etiqueta]) => t(etiqueta)) : null

  return (
    <Renglon
      label={t('device.setup.checkout')}
      tour="device-setup-cobro"
      action={can('tpv-settings:update') && <BotonCambiar onClick={() => onGoTo('checkout-steps')} tour="device-setup-cobro-change" />}
    >
      <div className={cn('space-y-1', noCobra && 'opacity-60')} data-testid={noCobra ? 'device-setup-cobro-dimmed' : undefined}>
        {!puedeVer ? (
          <p className="text-muted-foreground">{t('customerDisplay:steps.noReadPermission')}</p>
        ) : pasos.isLoading ? (
          <Skeleton className="h-5 w-40" />
        ) : !prendidos ? (
          <p className="text-muted-foreground">{t('device.setup.loadError')}</p>
        ) : (
          <p className="font-medium">{prendidos.length ? prendidos.join(' · ') : t('device.setup.stepsNone')}</p>
        )}
      </div>
      {noCobra && <p className="text-xs text-muted-foreground">{t('customerDisplay:steps.notCharging')}</p>}
    </Renglon>
  )
}

function RenglonDeLaPantalla({ venueId, tpv, onGoTo }: { venueId: string; tpv: FichaDelBloque; onGoTo: (s: SeccionDeLaFicha) => void }) {
  const { t } = useTranslation(['tpv', 'customerDisplay'])
  const { can } = useAccess()
  // La misma consulta (y caché) que la tarjeta de la pantalla del cliente.
  const pantalla = useCustomerDisplay(venueId, tpv.id, true)

  return (
    <Renglon
      label={t('device.setup.display')}
      tour="device-setup-pantalla"
      action={can('customer-display:update') && <BotonCambiar onClick={() => onGoTo('customer-display')} tour="device-setup-pantalla-change" />}
    >
      {pantalla.isLoading ? (
        <Skeleton className="h-5 w-32" />
      ) : !pantalla.data ? (
        <p className="text-muted-foreground">{t('device.setup.loadError')}</p>
      ) : (
        <p className="font-medium">{t(esDisenoDeFabrica(pantalla.data.design) ? 'customerDisplay:card.designFactory' : 'customerDisplay:card.designOwn')}</p>
      )}
    </Renglon>
  )
}
