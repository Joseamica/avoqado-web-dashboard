import { AlertTriangle, ChefHat, CreditCard, LayoutGrid, TicketCheck } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { useAccess } from '@/hooks/use-access'
import type { PapelDelAparato } from '../papelDelAparato'

export interface DeviceMenusDeLaFicha {
  menus: Array<{ id: string; name: string }>
  needsAppUpdate: boolean
}

/**
 * Aparatos claros, Paso 1 (8-nov-2026): arriba de la ficha, qué hace este aparato (papel, comanda y menú), cada uno con
 * «Cambiar» a la pantalla donde se cambia hoy. Sólo letreros: no mueve nada de lugar. La impresora no va: el SERVIDOR no sabe
 * cuál usa cada PC (en WINDOWS se elige en el POS).
 */
export function DeviceRoleSummary({
  papel,
  deviceMenus,
  fullBasePath,
}: {
  papel: PapelDelAparato | null
  deviceMenus?: DeviceMenusDeLaFicha
  fullBasePath: string
}) {
  const { t } = useTranslation('tpv')
  const { can } = useAccess()
  const vales = can('area-tickets:configure')
  const area = papel?.tipo === 'emite' ? papel.area : null
  // Codex r3 #2: con «Preparar después de pagar» la comanda no sale al emitir y su disparo al pagar no existe en ANDROID: no se
  // promete «Manda comanda». (Medido el 8-nov: ninguna área activa de producción usa ese modo.)
  const comandaCierta = area && !(area.sendsComanda && area.fulfillmentMode === 'PREPARE_ON_PAID')
  if (!papel && !deviceMenus) return null

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3" data-tour="device-role-summary">
      {papel && (
        <Cuadro
          icon={papel.tipo === 'emite' ? <TicketCheck className="h-4 w-4" /> : <CreditCard className="h-4 w-4" />}
          title={t(papel.tipo === 'emite' ? 'device.role.issues' : 'device.role.charges')}
          detail={area ? t('device.role.issuesArea', { area: area.name }) : null}
          warning={papel.emitirSinEfecto ? t(`device.role.emitirSinEfecto.${papel.emitirSinEfecto}`) : undefined}
          href={vales ? `${fullBasePath}/settings/area-tickets#terminals` : undefined}
          tour="device-role-papel"
        />
      )}
      {area && comandaCierta && (
        <Cuadro
          icon={<ChefHat className="h-4 w-4" />}
          title={t(area.sendsComanda ? 'device.role.comandaOn' : 'device.role.comandaOff')}
          detail={t(area.sendsComanda ? 'device.role.comandaOnDetail' : 'device.role.comandaOffDetail')}
          href={vales ? `${fullBasePath}/settings/area-tickets#areas` : undefined}
          tour="device-role-comanda"
        />
      )}
      {deviceMenus && (
        <Cuadro
          icon={<LayoutGrid className="h-4 w-4" />}
          title={t('device.role.menu')}
          detail={deviceMenus.menus.length ? deviceMenus.menus.map(m => m.name).join(', ') : t('device.role.allMenus')}
          note={deviceMenus.needsAppUpdate ? t('device.role.menuNeedsUpdate') : undefined}
          href={`${fullBasePath}/devices?tab=menus`}
          tour="device-role-menu"
        />
      )}
    </div>
  )
}

function Cuadro({
  icon,
  title,
  detail,
  note,
  warning,
  href,
  tour,
}: {
  icon: ReactNode
  title: string
  detail: string | null
  note?: string
  /** Algo prendido que no hace nada (p. ej. «Emitir vales» sin área): se dice en ámbar, sin alarmar. */
  warning?: string
  href?: string
  tour: string
}) {
  const { t } = useTranslation('tpv')
  return (
    <div className="rounded-xl border border-input bg-card p-4" data-tour={tour}>
      <div className="flex items-center gap-2 text-muted-foreground">
        {icon}
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      {detail && <p className="mt-1 text-sm text-muted-foreground">{detail}</p>}
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      {warning && (
        <p className="mt-1.5 flex items-start gap-1.5 text-xs text-warning-foreground dark:text-warning">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {warning}
        </p>
      )}
      {href && (
        <Link to={href} className="mt-2 inline-block text-xs font-medium text-foreground underline underline-offset-4">
          {t('device.role.change')}
        </Link>
      )}
    </div>
  )
}
