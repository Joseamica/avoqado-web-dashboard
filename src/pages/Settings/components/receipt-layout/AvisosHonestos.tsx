import { Clock, FileWarning, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import type { ReceiptDevices, ReceiptReadiness } from '@/services/receiptLayout.service'

/** Las plataformas que el servidor cuenta (readiness.service.ts). Otra desconocida se pinta cruda. */
const PLATAFORMAS_CONOCIDAS = new Set(['TPV_ANDROID', 'TPV_IOS', 'POS_ANDROID', 'POS_IOS', 'POS_DESKTOP'])

/**
 * 🔴 Las TERMINALES DE COBRO no son «aparatos que no han actualizado»: el diseño todavía no
 * existe para ellas (la PAX imprime por Neptune y la Nexgo por AngelPay, dos motores que aún no
 * interpretan la receta). Meterlas en el aviso de «actualiza tu app» le pedía al dueño una acción
 * que NO iba a servir de nada — y lo dejaba esperando un ticket nuevo que su terminal no puede
 * imprimir. Van en su propio aviso, con «Próximamente» y sin pedirle nada.
 */
const TERMINALES_DE_COBRO = new Set(['TPV_ANDROID', 'TPV_IOS'])

/** «Terminal 2 · Terminal NEXGO» — la marca SIEMPRE que exista: la PAX y la Nexgo son el mismo tipo. */
function nombreDelAparato(d: ReceiptDevices['notSupporting'][number], t: (k: string) => string): string {
  const plataforma = PLATAFORMAS_CONOCIDAS.has(d.platform) ? t(`devices.platform.${d.platform}`) : d.platform
  return `${d.name} · ${plataforma}${d.brand ? ` ${d.brand}` : ''}`
}

/**
 * Los avisos honestos: el ticket va a salir sin datos fiscales, qué aparatos todavía imprimen el
 * ticket anterior, y a cuáles el diseño no ha llegado todavía.
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
  // Las terminales se cuentan APARTE: el conteo del aviso de actualizar sólo puede incluir
  // aparatos a los que actualizar SÍ les sirve.
  const terminales = devices.notSupporting.filter(d => TERMINALES_DE_COBRO.has(d.platform))
  const porActualizar = devices.notSupporting.filter(d => !TERMINALES_DE_COBRO.has(d.platform))

  if (readiness.fiscalEmisor && porActualizar.length === 0 && terminales.length === 0) return null

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

      {porActualizar.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs"
          data-testid="receipt-layout-devices"
        >
          <Smartphone aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            <p className="font-medium">{t('devices.title', { count: porActualizar.length })}</p>
            <p className="mt-0.5 text-muted-foreground">{t('devices.body')}</p>
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {porActualizar.slice(0, 5).map((d, i) => (
                <li key={i}>
                  {nombreDelAparato(d, t)}
                  {d.appVersion ? ` · ${d.appVersion}` : ` · ${t('devices.unknownVersion')}`}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {terminales.length > 0 && (
        <div
          className="flex items-start gap-2 rounded-xl border border-border/60 bg-muted/40 p-3 text-xs"
          data-testid="receipt-layout-terminals"
        >
          <Clock aria-hidden className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
          <div>
            {/* `div` y no `p`: el Badge es un div, y un div dentro de un p es HTML inválido
                (React lo grita en consola y el navegador cierra el párrafo antes de tiempo). */}
            <div className="flex flex-wrap items-center gap-2 font-medium">
              {t('devices.terminalsTitle', { count: terminales.length })}
              <Badge variant="outline" className="text-[10px] font-medium uppercase tracking-wide">
                {t('devices.comingSoon')}
              </Badge>
            </div>
            <p className="mt-0.5 text-muted-foreground">{t('devices.terminalsBody')}</p>
            {/* Sin versión a propósito: aquí actualizar no cambia nada, y ponerla invitaría a
                intentarlo. Sin la etiqueta de plataforma tampoco: en ESTE aviso todas son
                terminales, y «Terminal Barra · Terminal NEXGO» repite la palabra (se vio
                renderizando la pantalla). La MARCA sí va: dice cuál de las dos es. */}
            <ul className="mt-1 space-y-0.5 text-muted-foreground">
              {terminales.slice(0, 5).map((d, i) => (
                <li key={i}>
                  {d.name}
                  {d.brand ? ` · ${d.brand}` : ''}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
