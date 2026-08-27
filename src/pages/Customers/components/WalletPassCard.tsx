import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Copy, MessageCircle, Settings2, Smartphone, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { buildWalletPassUrl } from '@/services/walletCard.service'

interface WalletPassCardProps {
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
  }
  /** Slug del negocio — es lo que la ruta publica usa, no el id. */
  venueSlug: string
  /** Nombre legible del negocio, para el mensaje de WhatsApp. */
  venueName: string
  /** Prefijo de rutas del venue (`/venues/x` o `/wl/venues/x`). */
  fullBasePath: string
  /** Del `LoyaltyConfig` que la ficha ya consulto. `undefined` = todavia cargando. */
  stampsEnabled: boolean | undefined
}

export function WalletPassCard({
  customer,
  venueSlug,
  venueName,
  fullBasePath,
  stampsEnabled,
}: WalletPassCardProps) {
  const { t } = useTranslation('customers')
  const { toast } = useToast()
  const [copiada, setCopiada] = useState(false)
  // Se enciende SOLO si el portapapeles fallo. Ver `handleCopy`.
  const [ligaVisible, setLigaVisible] = useState(false)

  const url = useMemo(() => buildWalletPassUrl(venueSlug, customer.id), [venueSlug, customer.id])

  const whatsappHref = useMemo(() => {
    const nombre = [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim()
    const mensaje = t('walletPass.whatsappMessage', { name: nombre, venue: venueName, url })
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
  }, [customer.firstName, customer.lastName, venueName, url, t])

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiada(true)
      toast({ title: t('walletPass.copied') })
      window.setTimeout(() => setCopiada(false), 2000)
    } catch {
      // 🔴 `navigator.clipboard` falla mas seguido de lo que parece: sin HTTPS, en
      // algunos WebView, y cuando la pestaña no tiene el foco. Decir "copiala a
      // mano" sin ENSEÑAR la liga deja al negocio sin salida — se vio tocando el
      // boton, no en ninguna prueba. Al fallar, la liga se revela seleccionable.
      setLigaVisible(true)
      toast({ variant: 'destructive', title: t('walletPass.copyFailed') })
    }
  }

  // Mientras la config viaja no se dibuja nada: enseñar el estado "apagado" y
  // que a los 200 ms salte a "prendido" hace parpadear un aviso que no era cierto.
  if (stampsEnabled === undefined) return null

  const header = (
    <div className="flex items-center gap-2 mb-3">
      <div className="p-1.5 rounded-lg bg-muted text-foreground">
        <Wallet className="h-4 w-4" aria-hidden="true" />
      </div>
      <h3 className="text-sm font-semibold">{t('walletPass.title')}</h3>
    </div>
  )

  // ─── Apagado ────────────────────────────────────────────────────────────
  // 🔴 No se oculta la seccion: la regla del workspace es que lo apagado se VE y
  // se EXPLICA. Desaparecer dejaria al negocio sin enterarse de que la tarjeta
  // existe, que es exactamente como el motor de sellos vivio semanas sin usarse.
  if (!stampsEnabled) {
    return (
      <GlassCard className="border-input p-5" data-testid="wallet-pass-card">
        {header}
        <p className="text-sm text-muted-foreground mb-4">{t('walletPass.disabled')}</p>
        <PermissionGate
          permission="loyalty:update"
          fallback={<p className="text-xs text-muted-foreground italic">{t('walletPass.disabledNoPermission')}</p>}
        >
          <Button variant="outline" size="sm" asChild className="cursor-pointer">
            <Link to={`${fullBasePath}/loyalty/card`}>
              <Settings2 className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              {t('walletPass.turnOn')}
            </Link>
          </Button>
        </PermissionGate>
      </GlassCard>
    )
  }

  // ─── Prendido ───────────────────────────────────────────────────────────
  return (
    <GlassCard className="border-input p-5" data-testid="wallet-pass-card">
      {header}
      <p className="text-sm text-muted-foreground mb-4">{t('walletPass.description')}</p>

      <div className="flex flex-col sm:flex-row sm:items-start gap-4">
        {/* El QR va sobre blanco SIEMPRE, no sobre un token de tema: en modo
            oscuro un QR con el fondo invertido no lo lee ninguna camara. */}
        {/* Un QR SIEMPRE es negro sobre blanco, sin tokens de tema: en modo oscuro
            un QR con los colores invertidos no lo lee ninguna camara. El blanco
            alrededor tampoco es decorativo — es la zona muerta que el lector
            necesita. Mismo patron que `ActivationCodeDialog`. */}
        <div
          className="shrink-0 self-center sm:self-start rounded-xl p-3"
          style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}
        >
          <QRCodeSVG value={url} size={116} level="M" bgColor="#ffffff" fgColor="#000000" data-testid="wallet-pass-qr" />
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <p className="text-xs text-muted-foreground">{t('walletPass.scanHint')}</p>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopy}
              className="cursor-pointer"
              data-tour="wallet-pass-copy"
              data-testid="wallet-pass-copy-btn"
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              {copiada ? t('walletPass.copied') : t('walletPass.copyLink')}
            </Button>
            <Button variant="outline" size="sm" asChild className="cursor-pointer" data-testid="wallet-pass-whatsapp-btn">
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {t('walletPass.sendWhatsapp')}
              </a>
            </Button>
          </div>

          {ligaVisible && (
            <input
              type="text"
              readOnly
              value={url}
              onFocus={e => e.currentTarget.select()}
              aria-label={t('walletPass.linkLabel')}
              className="w-full text-xs font-mono bg-muted text-foreground rounded-md px-2 py-1.5 border border-input"
              data-testid="wallet-pass-url"
            />
          )}

          {/* 🔴 Se dice en la pantalla, no en una nota al pie: Google Wallet todavia
              no existe. Sin este aviso el negocio le manda la liga a alguien con
              Android, no le abre nada, y el que queda mal es el negocio. */}
          <p className="text-xs text-muted-foreground flex items-start gap-1.5">
            <Smartphone className="h-3.5 w-3.5 mt-0.5 shrink-0" aria-hidden="true" />
            <span>{t('walletPass.iphoneOnly')}</span>
          </p>
        </div>
      </div>
    </GlassCard>
  )
}

export default WalletPassCard
