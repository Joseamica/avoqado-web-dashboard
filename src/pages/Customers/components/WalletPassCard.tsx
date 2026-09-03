import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
import { Apple, Copy, MessageCircle, Settings2, Smartphone, Wallet } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { PermissionGate } from '@/components/PermissionGate'
import { useToast } from '@/hooks/use-toast'
import { buildWalletPassUrl, type WalletPassPlatform } from '@/services/walletCard.service'

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
  // 🔴 Ahora hay DOS tarjetas (iPhone y Android) visibles a la vez — nunca se
  // adivina cuál trae el cliente enfrente, porque quien mira la pantalla es el
  // barista, no el dueño del teléfono. Por eso el estado va indexado por
  // plataforma en vez de ser un solo booleano: copiar o revelar la liga de una
  // NO debe tocar el estado de la otra.
  const [copiada, setCopiada] = useState<WalletPassPlatform | null>(null)
  // Se enciende SOLO si el portapapeles fallo, y solo para ESA plataforma. Ver `handleCopy`.
  const [ligaVisible, setLigaVisible] = useState<Record<WalletPassPlatform, boolean>>({ apple: false, google: false })

  const appleUrl = useMemo(() => buildWalletPassUrl(venueSlug, customer.id, 'apple'), [venueSlug, customer.id])
  const googleUrl = useMemo(() => buildWalletPassUrl(venueSlug, customer.id, 'google'), [venueSlug, customer.id])

  const nombre = useMemo(
    () => [customer.firstName, customer.lastName].filter(Boolean).join(' ').trim(),
    [customer.firstName, customer.lastName],
  )

  const appleWhatsappHref = useMemo(() => {
    const mensaje = t('walletPass.whatsappMessageApple', { name: nombre, venue: venueName, url: appleUrl })
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
  }, [nombre, venueName, appleUrl, t])

  const googleWhatsappHref = useMemo(() => {
    const mensaje = t('walletPass.whatsappMessageGoogle', { name: nombre, venue: venueName, url: googleUrl })
    return `https://wa.me/?text=${encodeURIComponent(mensaje)}`
  }, [nombre, venueName, googleUrl, t])

  const handleCopy = async (platform: WalletPassPlatform, url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopiada(platform)
      toast({ title: t('walletPass.copied') })
      window.setTimeout(() => setCopiada(actual => (actual === platform ? null : actual)), 2000)
    } catch {
      // 🔴 `navigator.clipboard` falla mas seguido de lo que parece: sin HTTPS, en
      // algunos WebView, y cuando la pestaña no tiene el foco. Decir "copiala a
      // mano" sin ENSEÑAR la liga deja al negocio sin salida — se vio tocando el
      // boton, no en ninguna prueba. Al fallar, la liga se revela seleccionable,
      // pero SOLO la de la tarjeta que fallo — la otra sigue como estaba.
      setLigaVisible(prev => ({ ...prev, [platform]: true }))
      toast({ variant: 'destructive', title: t('walletPass.copyFailed') })
    }
  }

  const plataformas: Array<{
    id: WalletPassPlatform
    label: string
    icon: typeof Apple
    url: string
    whatsappHref: string
  }> = [
    { id: 'apple', label: t('walletPass.appleLabel'), icon: Apple, url: appleUrl, whatsappHref: appleWhatsappHref },
    { id: 'google', label: t('walletPass.googleLabel'), icon: Smartphone, url: googleUrl, whatsappHref: googleWhatsappHref },
  ]

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

      {/* 🔴 Dos QR lado a lado, no un selector: quien decide cuál sirve es el
          teléfono que el cliente ya trae en la mano, no el barista. Un selector
          obligaría a preguntar y tocar un control ANTES de poder enseñar el
          código correcto — con un barista con fila y prisa, ese paso extra sobra.
          Lado a lado el cliente apunta su cámara al que dice su marca y ya; y no
          hay estado que "se quede pegado" en la plataforma del cliente anterior. */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {plataformas.map(plataforma => (
          <div
            key={plataforma.id}
            className="flex flex-col items-center gap-3 rounded-xl border border-input p-3"
            data-testid={`wallet-pass-platform-${plataforma.id}`}
          >
            <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
              <plataforma.icon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{plataforma.label}</span>
            </div>

            {/* Un QR SIEMPRE es negro sobre blanco, sin tokens de tema: en modo oscuro
                un QR con los colores invertidos no lo lee ninguna camara. El blanco
                alrededor tampoco es decorativo — es la zona muerta que el lector
                necesita. Mismo patron que `ActivationCodeDialog`. */}
            <div className="rounded-xl p-3" style={{ backgroundColor: '#ffffff', border: '1px solid #e5e7eb' }}>
              <QRCodeSVG
                value={plataforma.url}
                size={104}
                level="M"
                bgColor="#ffffff"
                fgColor="#000000"
                data-testid={`wallet-pass-qr-${plataforma.id}`}
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleCopy(plataforma.id, plataforma.url)}
                className="cursor-pointer"
                data-tour={`wallet-pass-copy-${plataforma.id}`}
                data-testid={`wallet-pass-copy-btn-${plataforma.id}`}
              >
                <Copy className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                {copiada === plataforma.id ? t('walletPass.copied') : t('walletPass.copyLink')}
              </Button>
              <Button
                variant="outline"
                size="sm"
                asChild
                className="cursor-pointer"
                data-testid={`wallet-pass-whatsapp-btn-${plataforma.id}`}
              >
                <a href={plataforma.whatsappHref} target="_blank" rel="noopener noreferrer">
                  <MessageCircle className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
                  {t('walletPass.sendWhatsapp')}
                </a>
              </Button>
            </div>

            {ligaVisible[plataforma.id] && (
              <input
                type="text"
                readOnly
                value={plataforma.url}
                onFocus={e => e.currentTarget.select()}
                aria-label={t('walletPass.linkLabel', { platform: plataforma.label })}
                className="w-full text-xs font-mono bg-muted text-foreground rounded-md px-2 py-1.5 border border-input"
                data-testid={`wallet-pass-url-${plataforma.id}`}
              />
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground mt-3">{t('walletPass.scanHint')}</p>
    </GlassCard>
  )
}

export default WalletPassCard
