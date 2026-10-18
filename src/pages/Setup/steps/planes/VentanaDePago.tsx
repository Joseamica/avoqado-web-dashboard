import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useRef, type ReactNode, type RefObject } from 'react'
import { useTranslation } from 'react-i18next'

import { useIsMobile } from '@/hooks/use-mobile'
import { cn } from '@/lib/utils'
import { getIntlLocale } from '@/utils/i18n-locale'

import { formatMXN } from '../../offer/formatMXN'

interface VentanaDePagoProps {
  abierta: boolean
  onCerrar: () => void
  /** `false` con un cobro en vuelo: ni Esc ni la X cierran. */
  puedeCerrar: boolean
  /** A dónde va el foco al cerrar si el botón que la abrió ya no está en la página (p. ej. «Confirmar mi pago»). */
  focoDeRespaldo?: RefObject<HTMLElement>
  titulo: string
  subtitulo: string
  hoyPagasCents: number
  primerCobro?: { fecha: Date; texto: string }
  legal: string
  /** El formulario de la tarjeta (Stripe) con su botón de pagar. */
  children: ReactNode
}

/**
 * Ventana para pagar del alta: centrada en computadora, hoja pegada abajo en celular.
 *
 * 🔴 `modal={false}` a propósito: la ventana de 3D Secure de Stripe se monta FUERA de esta
 * ventana, y el modo modal de Radix le pone `pointer-events: none` al `body` y atrapa el foco
 * (Radix #2122), así que el cliente no podría tocar ni teclear el reto de su banco. El fondo es
 * propio (`bg-background/80`, como el `Dialog` del panel) y sólo tapa la página; clic fuera nunca cierra.
 */
export function VentanaDePago({
  abierta,
  onCerrar,
  puedeCerrar,
  focoDeRespaldo,
  titulo,
  subtitulo,
  hoyPagasCents,
  primerCobro,
  legal,
  children,
}: VentanaDePagoProps) {
  const { t, i18n } = useTranslation('setup')
  const esCelular = useIsMobile()
  // No hay `Dialog.Trigger`: sin esto, al cerrar el foco se pierde en el `body`.
  const abrio = useRef<HTMLElement | null>(null)

  const fecha =
    primerCobro &&
    new Intl.DateTimeFormat(getIntlLocale(i18n.language), {
      day: 'numeric',
      month: 'long',
      timeZone: 'America/Mexico_City',
    }).format(primerCobro.fecha)

  return (
    <Dialog.Root modal={false} open={abierta} onOpenChange={abrir => !abrir && onCerrar()}>
      <Dialog.Portal>
        <div data-testid="fondo-ventana-de-pago" aria-hidden="true" className="fixed inset-0 z-50 bg-background/80" />
        <Dialog.Content
          // M4: el fondo tapa la página y lo de atrás queda `inert`, así que para un lector de pantalla es modal. 🔴 Salvo
          // con un cobro en vuelo: el reto 3D Secure del banco se monta FUERA de esta ventana, y Safari/VoiceOver esconde
          // todo lo que queda fuera de un `aria-modal` (el reto quedaría mudo).
          aria-modal={puedeCerrar}
          onOpenAutoFocus={event => {
            // Si quien la abrió se desmontó al abrirla, el foco ya cayó al <body>: ése no cuenta como «quien la abrió».
            const activo = document.activeElement as HTMLElement | null
            abrio.current = activo && activo !== document.body ? activo : null
            // M4: el foco va a la ventana misma (se leen primero su título y su descripción), no a la X.
            event.preventDefault()
            ;(event.currentTarget as HTMLElement | null)?.focus()
          }}
          onCloseAutoFocus={event => {
            event.preventDefault()
            // M6: si el botón que la abrió ya no está, al respaldo; sin esto el foco se perdía en el <body>.
            ;(abrio.current?.isConnected ? abrio.current : focoDeRespaldo?.current)?.focus()
          }}
          onInteractOutside={event => event.preventDefault()}
          onEscapeKeyDown={event => {
            if (!puedeCerrar) event.preventDefault()
          }}
          className={cn(
            // `overscroll-contain`: el desplazamiento de la ventana no arrastra la página de atrás.
            'fixed z-50 flex max-h-[90dvh] w-full flex-col gap-4 overflow-y-auto overscroll-contain border border-border bg-card p-6 text-card-foreground shadow-lg outline-none',
            // En celular, el botón de pagar no queda bajo la barra de inicio del iPhone.
            esCelular
              ? 'inset-x-0 bottom-0 rounded-t-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]'
              : 'left-1/2 top-1/2 max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl',
          )}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex flex-col gap-1">
              <Dialog.Title className="text-lg font-semibold">{titulo}</Dialog.Title>
              <Dialog.Description className="text-sm text-muted-foreground">{subtitulo}</Dialog.Description>
            </div>
            <button
              type="button"
              onClick={onCerrar}
              disabled={!puedeCerrar}
              className="rounded-sm opacity-70 transition-opacity hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30"
            >
              <X className="size-4" aria-hidden="true" />
              <span className="sr-only">{t('common:close')}</span>
            </button>
          </div>

          <div className="flex flex-col gap-1 rounded-lg bg-muted p-4 text-sm">
            <div className="flex items-center justify-between gap-4 font-semibold">
              <span>{t('plans.todayYouPay')}</span>
              <span>{formatMXN(hoyPagasCents)}</span>
            </div>
            {primerCobro && (
              <div className="flex flex-wrap items-center justify-between gap-x-4 text-muted-foreground">
                <span>{t('plans.firstCharge', { fecha })}</span>
                <span>{primerCobro.texto}</span>
              </div>
            )}
          </div>

          {children}

          <p className="text-xs text-muted-foreground">{legal}</p>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
