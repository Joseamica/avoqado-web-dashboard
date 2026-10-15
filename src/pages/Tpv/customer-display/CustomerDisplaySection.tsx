import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import type { DisplayModeRequest, EffectiveDeviceCapabilities } from '@/services/tpv.service'
import { DisplayModeRequestControl } from '../components/DisplayModeRequestControl'
import { CheckoutStepsSection } from './CheckoutStepsSection'
import { CustomerDisplayCard } from './CustomerDisplayCard'
import { superficieDeLaPantalla } from './model'

export interface CustomerDisplaySectionProps {
  venueId: string
  terminalId: string
  deviceType: string | undefined
  deviceName: string
  venueName: string
  versionCode: number | null
  capabilities: EffectiveDeviceCapabilities
  customerDisplayInverted: boolean
  customerDisplayRequest?: DisplayModeRequest | null
  canUpdateDevice: boolean
}

/**
 * La sección «Pantalla del cliente» de la página del dispositivo (spec §6.1, D4 «sección llamativa»). Junta lo nuevo
 * (diseño y pasos del cobro) con la orientación de pantallas que ya existía, que no cambia. Qué se ve depende del tipo:
 * POS_ANDROID todo; el iPad sólo los pasos; los demás, lo de hoy (sólo la inversión, si su pantalla la admite).
 */
export function CustomerDisplaySection(props: CustomerDisplaySectionProps) {
  const { t } = useTranslation(['customerDisplay', 'tpv'])
  const superficie = superficieDeLaPantalla(props.deviceType)
  const pantalla = props.capabilities.customerDisplay
  // La misma regla que tenía `TpvId` para la inversión (`showDisplayModeControl`), sin cambios.
  const conInversion = pantalla.presence !== 'UNSUPPORTED' && pantalla.invertibility !== 'UNSUPPORTED'
  if (superficie === 'ninguna' && !conInversion) return null

  return (
    <section data-tour="customer-display-section" className="space-y-4 rounded-2xl border border-input bg-card p-5">
      <div className="flex items-center gap-2">
        <h2 className="text-base font-semibold">{t('tpv:device.sections.customerDisplay')}</h2>
        {superficie === 'diseno' && (
          <Badge variant="secondary" className="h-5 rounded-full px-2 text-[11px] font-semibold text-muted-foreground">
            {t('card.new')}
          </Badge>
        )}
      </div>

      {superficie === 'diseno' && (
        <CustomerDisplayCard venueId={props.venueId} terminalId={props.terminalId} deviceName={props.deviceName} venueName={props.venueName} />
      )}
      {superficie === 'soloPasos' && <p className="text-sm text-muted-foreground">{t('card.ipadNoDisplay')}</p>}

      {superficie !== 'ninguna' && (
        <>
          <Separator />
          <CheckoutStepsSection tpvId={props.terminalId} deviceType={props.deviceType} versionCode={props.versionCode} />
        </>
      )}

      {conInversion && (
        <>
          {superficie !== 'ninguna' && <Separator />}
          <DisplayModeRequestControl
            key={`${props.venueId}:${props.terminalId}`}
            venueId={props.venueId}
            terminalId={props.terminalId}
            capabilities={props.capabilities}
            customerDisplayInverted={props.customerDisplayInverted}
            request={props.customerDisplayRequest}
            canUpdate={props.canUpdateDevice}
          />
        </>
      )}
    </section>
  )
}
