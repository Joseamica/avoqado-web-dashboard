import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { ArrowUp, Printer, QrCode } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { useToast } from '@/hooks/use-toast'
import { buildPosterUrl } from '@/services/walletCard.service'
import { SectionHeader } from './SectionHeader'

interface CounterPosterCardProps {
  venueSlug: string
  venueName: string
  /** Del interruptor de arriba en esta misma pantalla, no de lo ya guardado. */
  stampsEnabled: boolean
  /** Lleva la vista hasta el interruptor y lo resalta. */
  onGoToSwitch?: () => void
}

export function CounterPosterCard({ venueSlug, venueName, stampsEnabled, onGoToSwitch }: CounterPosterCardProps) {
  const { t } = useTranslation('loyalty')
  const { toast } = useToast()
  const qrRef = useRef<HTMLDivElement>(null)
  const [urlVisible, setUrlVisible] = useState(false)

  const url = buildPosterUrl(venueSlug)

  const imprimir = () => {
    const svg = qrRef.current?.querySelector('svg')?.outerHTML
    // La ventana puede venir null: los bloqueadores de emergentes la matan sin avisar
    // y sin lanzar. Si eso pasa, se enseña la liga para que al menos pueda copiarla.
    const win = svg ? window.open('', '_blank', 'width=800,height=1000') : null
    if (!win) {
      setUrlVisible(true)
      toast({ variant: 'destructive', title: t('card.poster.printBlocked') })
      return
    }
    // Blanco y negro fijos, sin tokens de tema: esto se imprime en papel, y un QR
    // sobre fondo oscuro no lo lee ninguna camara.
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>${t('card.poster.title')}</title>
<style>
  @page { size: A4; margin: 18mm; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif;
         text-align: center; color: #000; background: #fff; margin: 0; padding: 24px; }
  h1 { font-size: 34px; font-weight: 600; margin: 0 0 8px; }
  p  { font-size: 19px; color: #333; margin: 0 0 28px; }
  .qr { display: inline-block; padding: 20px; border: 2px solid #000; border-radius: 16px; background: #fff; }
  .qr svg { display: block; width: 300px; height: 300px; }
  .pie { font-size: 15px; color: #555; margin-top: 28px; }
</style></head><body>
  <h1>${t('card.poster.headline', { venue: venueName })}</h1>
  <p>${t('card.poster.subheadline')}</p>
  <div class="qr">${svg}</div>
  <p class="pie">${t('card.poster.footnote')}</p>
</body></html>`)
    win.document.close()
    win.focus()
    win.print()
  }

  return (
    <GlassCard className="p-6" data-testid="counter-poster-card">
      <SectionHeader icon={QrCode} title={t('card.poster.title')} description={t('card.poster.description')} />

      {/* 🔴 NO se esconde cuando los sellos estan apagados: la regla del workspace es
          que lo apagado se VE y se EXPLICA. Escondiendolo, quien esta configurando su
          tarjeta ve el cartel aparecer y desaparecer sin entender por que — pasó
          exactamente asi la primera vez que se probo esta pantalla. */}
      {!stampsEnabled ? (
        <div data-testid="counter-poster-disabled">
          <p className="text-sm text-muted-foreground mb-3">{t('card.poster.needsStamps')}</p>
          {/* 🔴 Un boton que LLEVA, no una instruccion que describe. "Prendelo aqui
              arriba" fallo en la primera prueba real: en una pantalla de seis
              secciones, "arriba" no es una direccion que nadie pueda seguir. */}
          {onGoToSwitch && (
            <Button
              variant="outline"
              size="sm"
              onClick={onGoToSwitch}
              className="cursor-pointer"
              data-testid="counter-poster-goto-switch"
            >
              <ArrowUp className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              {t('card.poster.goToSwitch')}
            </Button>
          )}
        </div>
      ) : (
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        <div
          ref={qrRef}
          className="shrink-0 self-center sm:self-start rounded-xl p-3"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
          data-url={url ?? undefined}
        >
          <QRCodeSVG value={url} size={104} level="M" bgColor="#ffffff" fgColor="#000000" data-testid="counter-poster-qr" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <Button
            variant="outline"
            size="sm"
            onClick={imprimir}
            className="cursor-pointer"
            data-tour="wallet-print-poster"
            data-testid="counter-poster-print-btn"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            {t('card.poster.print')}
          </Button>

          {urlVisible && (
            <input
              type="text"
              readOnly
              value={url}
              onFocus={e => e.currentTarget.select()}
              aria-label={t('card.poster.linkLabel')}
              className="w-full text-xs font-mono bg-muted text-foreground rounded-md px-2 py-1.5 border border-input"
              data-testid="counter-poster-url"
            />
          )}

          <p className="text-xs text-muted-foreground">{t('card.poster.hint')}</p>
        </div>
      </div>
      )}
    </GlassCard>
  )
}

export default CounterPosterCard
