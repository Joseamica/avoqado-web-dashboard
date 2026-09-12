import { FileWarning, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { cn } from '@/lib/utils'
import type { ReceiptDevices, ReceiptReadiness } from '@/services/receiptLayout.service'

/** Las plataformas que el servidor cuenta (readiness.service.ts). Otra desconocida se pinta cruda. */
const PLATAFORMAS_CONOCIDAS = new Set(['TPV_ANDROID', 'TPV_IOS', 'POS_ANDROID', 'POS_IOS', 'POS_DESKTOP'])

/**
 * Los dos avisos honestos: el ticket va a salir sin datos fiscales, y hay aparatos que todavía
 * imprimen el ticket anterior.
 *
 * 🔴 Viven en la SECCIÓN y en el DISEÑADOR. Sólo en el diseñador, quien entra a mirar su ticket
 * nunca se enteraba de que su RFC no sale (WARN del /full-testing, 12-sep).
 *
 * 🔴 `supporting: 0` es lo ESPERADO hasta que salgan los intérpretes de las apps (fases 3 y 4).
 * El aviso lo dice así en vez de parecer una avería.
 */
export function AvisosHonestos({
  readiness,
  devices,
  fiscalHref,
  className,
}: {
  readiness: ReceiptReadiness
  devices: ReceiptDevices
  fiscalHref?: string
  className?: string
}) {
  const { t } = useTranslation('receiptLayout')
  const pendientes = devices.notSupporting.length

  if (readiness.fiscalEmisor && pendientes === 0) return null

  return (
    <div className={cn('space-y-2', className)} data-testid="receipt-layout-banners">
      {!readiness.fiscalEmisor && (
        <div role="alert" className="flex items-start gap-2 rounded-xl border border-warning-border bg-warning-muted p-3 text-xs">
          <FileWarning aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium">{t('readiness.noEmisorTitle')}</p>
            <p className="mt-0.5 text-muted-foreground">{t('readiness.noEmisorBody')}</p>
            {fiscalHref && (
              <a href={fiscalHref} className="mt-1 inline-block font-medium text-primary hover:underline">
                {t('readiness.goToFiscal')}
              </a>
            )}
          </div>
        </div>
      )}

      {pendientes > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs"
          data-testid="receipt-layout-devices"
        >
          <Smartphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('devices.title', { count: pendientes })}</p>
            <p className="mt-0.5 text-muted-foreground">{t('devices.body')}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {devices.notSupporting.slice(0, 5).map((d, i) => (
                <li key={i}>
                  {/* «TPV_ANDROID» a secas no dice cuál terminal falta: la PAX y la Nexgo son el
                      mismo tipo con motores distintos, así que la marca va SIEMPRE que exista. */}
                  {d.name} · {PLATAFORMAS_CONOCIDAS.has(d.platform) ? t(`devices.platform.${d.platform}`) : d.platform}
                  {d.brand ? ` ${d.brand}` : ''}
                  {d.appVersion ? ` · ${d.appVersion}` : ` · ${t('devices.unknownVersion')}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
