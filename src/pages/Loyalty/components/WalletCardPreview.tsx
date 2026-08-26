import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { walletCardService, type WalletCardDesign } from '@/services/walletCard.service'

/**
 * La credencial tal como se ve en la cartera del cliente.
 *
 * 🔴 La banda de sellos NO se dibuja aquí: se pide al servidor, que la genera con el
 * MISMO código que arma el pase. Antes se dibujaba en SVG y ya empezaba a divergir
 * —los nueve iconos y el cálculo que decide el color de un sello sin ganar vivían
 * duplicados— y una vista previa que diverge es peor que no tenerla, porque el
 * negocio guarda convencido de haber visto el resultado.
 *
 * El resto (fondo, textos, el código) sí es HTML: en el pase real también son campos
 * que Apple dibuja, no parte de la imagen.
 */

interface Props {
  design: WalletCardDesign
  venueName: string
  stampsEarned: number
  stampsRequired: number
  rewardLabel: string
  venueId: string
}

export function WalletCardPreview({ design, venueName, stampsEarned, stampsRequired, rewardLabel, venueId }: Props) {
  const { t } = useTranslation('loyalty')
  const [stripUrl, setStripUrl] = useState<string | null>(null)
  const anterior = useRef<string | null>(null)

  useEffect(() => {
    let cancelado = false
    // Se espera a que el usuario deje de mover el color. Sin esto, arrastrar el
    // selector dispararía una petición por cada tono intermedio.
    const timer = setTimeout(async () => {
      try {
        const blob = await walletCardService.getStripPreview(venueId, {
          earned: stampsEarned,
          required: stampsRequired,
          strip: design.stripColor,
          filled: design.stampFilledColor,
          empty: design.stampEmptyColor,
          shape: design.stampShape,
        })
        if (cancelado) return
        const url = URL.createObjectURL(blob)
        // 🔴 Se libera la anterior: cada objeto de estos retiene su blob en memoria
        // hasta que se revoca, y aquí se genera uno por cada ajuste de color.
        if (anterior.current) URL.revokeObjectURL(anterior.current)
        anterior.current = url
        setStripUrl(url)
      } catch {
        // Un fallo de red deja la banda anterior en pantalla. Vaciarla haría
        // parpadear la tarjeta entera por un tropiezo momentáneo.
      }
    }, 250)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [venueId, design.stripColor, design.stampFilledColor, design.stampEmptyColor, design.stampShape, stampsEarned, stampsRequired])

  // Al desmontar se suelta la última.
  useEffect(() => () => void (anterior.current && URL.revokeObjectURL(anterior.current)), [])

  return (
    <div className="mx-auto w-[300px]">
      <div className="overflow-hidden rounded-[18px] shadow-2xl" style={{ backgroundColor: design.backgroundColor }}>
        {/* Encabezado: el logo del negocio y el conteo */}
        <div className="flex items-center justify-between gap-3 px-4 pb-2 pt-4">
          {design.logoUrl ? (
            <img src={design.logoUrl} alt={venueName} className="h-7 max-w-[130px] object-contain object-left" />
          ) : (
            <span className="truncate text-[13px] font-semibold" style={{ color: design.textColor }}>
              {venueName}
            </span>
          )}
          <div className="shrink-0 text-right">
            <div className="text-[8px] font-medium uppercase tracking-wider" style={{ color: design.labelColor }}>
              {t('card.preview.stamps')}
            </div>
            <div className="text-[15px] font-semibold leading-tight" style={{ color: design.textColor }}>
              {stampsEarned} / {stampsRequired}
            </div>
          </div>
        </div>

        {/*
          La banda. `aspect-[750/246]` reserva su espacio desde el primer instante:
          sin eso, la tarjeta salta de alto cuando llega la imagen.
        */}
        <div className="aspect-[750/246] w-full" style={{ backgroundColor: design.stripColor }}>
          {stripUrl && <img src={stripUrl} alt="" className="h-full w-full object-cover" />}
        </div>

        {/* El premio */}
        <div className="px-4 pb-3 pt-3">
          <div className="text-[8px] font-medium uppercase tracking-wider" style={{ color: design.labelColor }}>
            {t('card.preview.reward')}
          </div>
          <div className="truncate text-[13px] font-medium" style={{ color: design.textColor }}>
            {rewardLabel}
          </div>
        </div>

        {/* El código: en el pase real es un QR con un token opaco */}
        <div className="flex justify-center px-4 pb-4">
          {/*
            🔴 Blanco literal, no un token de tema, y no es un descuido: un código de
            barras necesita fondo claro para que un lector lo distinga, y Apple lo
            dibuja sobre blanco dentro del pase, sea cual sea el color de la tarjeta.
            Con `bg-background` saldría oscuro en modo oscuro y la vista previa
            mostraría algo que el cliente nunca va a ver.
          */}
          <div className="flex h-[74px] w-[74px] items-center justify-center rounded-md" style={{ backgroundColor: '#FFFFFF' }}>
            <QrPlaceholder />
          </div>
        </div>
      </div>

      <p className="mt-3 text-center text-xs text-muted-foreground">{t('card.preview.disclaimer')}</p>
    </div>
  )
}

/** Un patrón que se LEE como código QR sin fingir ser uno escaneable. */
function QrPlaceholder() {
  return (
    <svg viewBox="0 0 21 21" className="h-[64px] w-[64px]" aria-hidden="true">
      <rect width="21" height="21" fill="#fff" />
      {[
        [0, 0],
        [14, 0],
        [0, 14],
      ].map(([x, y]) => (
        <g key={`${x}-${y}`} fill="#000">
          <rect x={x} y={y} width="7" height="7" />
          <rect x={x + 1} y={y + 1} width="5" height="5" fill="#fff" />
          <rect x={x + 2} y={y + 2} width="3" height="3" />
        </g>
      ))}
      {/* Ruido determinista: el mismo dibujo en cada render, sin parecer un QR real */}
      {Array.from({ length: 60 }, (_, i) => {
        const x = (i * 7) % 21
        const y = Math.floor((i * 13) / 21) % 21
        if (x < 8 && y < 8) return null
        if (x > 12 && y < 8) return null
        if (x < 8 && y > 12) return null
        return <rect key={i} x={x} y={y} width="1" height="1" fill="#000" />
      })}
    </svg>
  )
}
