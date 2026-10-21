import { QrCode, Star } from 'lucide-react'
import type { CSSProperties } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { CustomerDisplayFicha } from '@/services/customerDisplay.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { MARCO_DE_LA_TABLET, PALETA_DE_LA_TABLET, type Momento } from './model'

/** Montos de ejemplo de la vista previa: neutros a propósito (el ICP no es sólo cafeterías). */
const MUESTRA = { a: 120, b: 85.5 } as const

export interface TabletPreviewProps {
  ficha: CustomerDisplayFicha
  momento: Momento
  nombreDelNegocio: string
  pasos: { tipSuggestions: number[]; showTipScreen: boolean; showReceiptScreen: boolean }
  tamano?: 'miniatura' | 'grande'
}

/**
 * La tablet APROXIMADA (spec §6.3): dibuja la ficha que mandó el server, sin recalcular nada. Los colores son los del
 * aparato (`PALETA_DE_LA_TABLET`, de Color.kt), en estilos en línea: el tema de la tablet no depende del del dashboard.
 * Los tamaños van en `cqi` (unidades del contenedor) para que miniatura y grande se vean igual de proporcionadas.
 */
export function TabletPreview({ ficha, momento, nombreDelNegocio, pasos, tamano = 'grande' }: TabletPreviewProps) {
  const { t, i18n } = useTranslation('customerDisplay')
  const paleta = PALETA_DE_LA_TABLET[ficha.theme]
  const acento = ficha.accent.custom ? ficha.accent.color : paleta.acento
  const sobreAcento = ficha.accent.custom ? ficha.accent.on : paleta.sobreAcento
  const dinero = new Intl.NumberFormat(getIntlLocale(i18n.language), { style: 'currency', currency: 'MXN' })
  const total = MUESTRA.a + MUESTRA.b
  const propinas = pasos.tipSuggestions.slice(0, 3)
  const propinaElegida = pasos.showTipScreen ? (propinas[0] ?? 0) : 0
  const pagado = total + Math.round(total * propinaElegida) / 100
  const secundario: CSSProperties = { color: paleta.secundario }

  return (
    <figure
      data-testid="tablet-preview"
      data-momento={momento}
      data-tema={ficha.theme}
      aria-label={t('card.thumbnailLabel')}
      className={cn('m-0 w-full', tamano === 'miniatura' ? 'max-w-[220px]' : 'max-w-[720px]')}
    >
      <div
        // El anillo (token semántico) separa el marco oscuro del fondo cuando el dashboard está en modo oscuro.
        className={cn('w-full ring-1 ring-input', tamano === 'miniatura' ? 'rounded-lg p-1.5' : 'rounded-2xl p-3')}
        style={{ backgroundColor: MARCO_DE_LA_TABLET }}
      >
        <div
          data-testid="tablet-preview-pantalla"
          className="relative grid aspect-[16/10] w-full overflow-hidden rounded-md"
          style={{ containerType: 'inline-size', backgroundColor: paleta.fondo, color: paleta.texto }}
        >
          {momento === 'espera' && (
            <div className="flex flex-col items-center justify-center gap-[2.5cqi] p-[4cqi] text-center">
              {ficha.logo && (
                <img
                  data-testid="tablet-preview-logo"
                  src={ficha.logo.url}
                  alt=""
                  className="h-[13cqi] w-[13cqi] rounded-full object-cover"
                />
              )}
              <p className="text-[2.6cqi]" style={secundario}>
                {nombreDelNegocio}
              </p>
              <p className="max-w-[90%] text-[4.6cqi] font-semibold leading-tight">{ficha.welcomeText ?? t('preview.defaultWelcome')}</p>
              <p className="absolute inset-x-0 bottom-[2.4cqi] text-center text-[1.6cqi]" style={secundario}>
                {t('preview.poweredBy')}
              </p>
            </div>
          )}

          {momento === 'carrito' && (
            <div className="grid h-full grid-cols-[1.4fr_1fr]">
              <div className="flex flex-col gap-[1.6cqi] p-[4cqi] text-[2.4cqi]" style={{ borderRight: `1px solid ${paleta.linea}` }}>
                <div className="flex justify-between gap-[2cqi]">
                  <span>{t('preview.sampleItemA')}</span>
                  <span className="tabular-nums">{dinero.format(MUESTRA.a)}</span>
                </div>
                <div className="flex justify-between gap-[2cqi]">
                  <span>{t('preview.sampleItemB')}</span>
                  <span className="tabular-nums">{dinero.format(MUESTRA.b)}</span>
                </div>
              </div>
              <div className="flex flex-col items-center justify-center gap-[1.4cqi] p-[4cqi] text-center">
                <span className="text-[2cqi]" style={secundario}>
                  {t('preview.total')}
                </span>
                <span data-testid="tablet-preview-total" className="text-[6cqi] font-bold tabular-nums" style={{ color: acento }}>
                  {dinero.format(total)}
                </span>
                <span className="text-[2cqi]" style={secundario}>
                  {t('preview.taxIncluded')}
                </span>
              </div>
            </div>
          )}

          {momento === 'propina' && (
            <div className="flex flex-col items-center justify-center gap-[3cqi] p-[4cqi] text-center">
              <p className="text-[3.6cqi] font-semibold">{t('preview.tipQuestion')}</p>
              <div className="grid w-[90%] grid-cols-4 gap-[1.8cqi]">
                {propinas.map((p, i) => (
                  <div
                    key={p}
                    className="grid gap-[0.6cqi] rounded-[1.6cqi] px-[1cqi] py-[2cqi] text-[2.4cqi]"
                    style={{ border: `0.35cqi solid ${i === 0 ? acento : paleta.linea}` }}
                  >
                    <b className="text-[3.2cqi]">{p} %</b>
                    <span className="tabular-nums">{dinero.format(Math.round(total * p) / 100)}</span>
                  </div>
                ))}
                <div
                  className="grid place-items-center rounded-[1.6cqi] px-[1cqi] py-[2cqi]"
                  style={{ border: `0.35cqi solid ${paleta.linea}` }}
                >
                  <b className="text-[2.6cqi]">{t('preview.noTip')}</b>
                </div>
              </div>
            </div>
          )}

          {momento === 'calificar' && (
            <div className="flex flex-col items-center justify-center gap-[3cqi] p-[4cqi] text-center">
              <p className="text-[3.6cqi] font-semibold">{t('preview.reviewQuestion')}</p>
              <div className="flex gap-[1.6cqi]" aria-hidden="true">
                {[0, 1, 2, 3, 4].map(i => (
                  <Star key={i} className="h-[6cqi] w-[6cqi]" style={{ color: acento, fill: acento }} />
                ))}
              </div>
              <span
                className="rounded-[1.6cqi] px-[4cqi] py-[1.8cqi] text-[2.6cqi] font-semibold"
                style={{ backgroundColor: acento, color: sobreAcento }}
              >
                {t('preview.reviewSend')}
              </span>
            </div>
          )}

          {momento === 'gracias' && (
            <div
              className={cn(
                'grid items-center gap-[4cqi] p-[6cqi]',
                pasos.showReceiptScreen ? 'grid-cols-[1fr_auto]' : 'justify-items-center text-center',
              )}
            >
              <div className="grid gap-[1.4cqi]">
                <p className="text-[4.4cqi] font-semibold leading-tight">{ficha.thanksText ?? t('preview.defaultThanks')}</p>
                <span className="text-[2.2cqi]" style={secundario}>
                  {t('preview.paid', { amount: dinero.format(pagado) })}
                </span>
              </div>
              {pasos.showReceiptScreen && (
                <div data-testid="tablet-preview-qr" className="grid justify-items-center gap-[1cqi] text-[1.8cqi]" style={secundario}>
                  <QrCode className="h-[18cqi] w-[18cqi]" style={{ color: paleta.texto }} aria-hidden="true" />
                  {t('preview.receiptQr')}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </figure>
  )
}
