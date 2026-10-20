import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Copy, Download, ExternalLink } from 'lucide-react'
import { QRCodeCanvas } from 'qrcode.react'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/hooks/use-toast'

const ORDERING_URL = (import.meta.env.VITE_ORDERING_URL as string | undefined) || 'https://pedidos.avoqado.io'

// Orígenes desde los que la tienda deja enmarcar la vista previa. 🔴 Debe coincidir con `frame-ancestors` de
// `avoqado-booking-widget/public/_headers`; cualquier otro origen del panel vería «rechazó la conexión», así que ahí va una liga.
const FRAMEABLE_ORIGINS = [
  'https://dashboard.avoqado.io',
  'https://dashboardv2.avoqado.io',
  'https://demo.dashboard.avoqado.io',
  'https://staging.dashboard.avoqado.io',
]
// Desarrollo local (cualquier puerto): la tienda de desarrollo no manda `frame-ancestors`.
const canEmbedPreview = () =>
  FRAMEABLE_ORIGINS.includes(window.location.origin) || ['localhost', '127.0.0.1'].includes(window.location.hostname)

const storefrontUrl = (slug: string) => `${ORDERING_URL}/${slug}`
const widgetSnippet = (slug: string) =>
  `<script src="https://cdn.avoqado.io/widget.js" defer></script>\n<avoqado-order venue="${slug}"></avoqado-order>`

/** Liga, QR (PNG del canvas, nunca un servicio externo), snippet del widget y vista previa. Sin snippet de iframe (R6). */
export function StorefrontShareCard({ slug }: { slug: string }) {
  const { t } = useTranslation('onlineOrdering')
  const { toast } = useToast()
  const qrWrap = useRef<HTMLDivElement>(null)
  const url = storefrontUrl(slug)
  const snippet = widgetSnippet(slug)

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: t('settings.share.copied') })
    } catch {
      toast({ title: t('settings.share.copyFailed'), variant: 'destructive' })
    }
  }

  const downloadQr = () => {
    const canvas = qrWrap.current?.querySelector('canvas')
    if (!canvas) return
    const a = document.createElement('a')
    a.href = canvas.toDataURL('image/png')
    a.download = `pedidos-${slug}.png`
    a.click()
  }

  return (
    <Card data-tour="online-ordering-share">
      <CardHeader>
        <CardTitle>{t('settings.share.title')}</CardTitle>
        <CardDescription>{t('settings.share.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          <Input readOnly value={url} aria-label={t('settings.share.link')} />
          <Button type="button" variant="outline" className="cursor-pointer" onClick={() => copy(url)}>
            <Copy className="mr-2 h-4 w-4" />
            {t('settings.share.copy')}
          </Button>
          <Button type="button" variant="outline" className="cursor-pointer" asChild>
            <a href={url} target="_blank" rel="noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              {t('settings.share.open')}
            </a>
          </Button>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div ref={qrWrap} className="rounded-xl border border-border p-3" style={{ backgroundColor: '#ffffff' }}>
            <QRCodeCanvas value={url} size={160} />
          </div>
          <Button type="button" variant="outline" className="cursor-pointer" onClick={downloadQr}>
            <Download className="mr-2 h-4 w-4" />
            {t('settings.share.downloadQr')}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.share.snippetTitle')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.share.snippetHelp')}</p>
          <pre data-testid="widget-snippet" className="overflow-x-auto rounded-lg bg-muted p-3 text-xs">
            {snippet}
          </pre>
          <Button type="button" variant="outline" size="sm" className="cursor-pointer" onClick={() => copy(snippet)}>
            <Copy className="mr-2 h-4 w-4" />
            {t('settings.share.copySnippet')}
          </Button>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.share.preview')}</p>
          {canEmbedPreview() ? (
            <iframe title={t('settings.share.previewTitle')} src={url} className="h-[480px] w-full rounded-xl border border-border" />
          ) : (
            <Button type="button" variant="outline" className="cursor-pointer" asChild>
              <a href={url} target="_blank" rel="noreferrer">
                <ExternalLink className="mr-2 h-4 w-4" />
                {t('settings.share.openInTab')}
              </a>
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
