/**
 * FullScreenModal - Modal de pantalla completa usando Radix Dialog
 *
 * Características:
 * - Usa Radix Dialog primitives para manejo correcto de portales y z-index
 * - Cubre toda la pantalla (incluyendo header, sidebar, etc.)
 * - Animación de entrada desde abajo hacia arriba
 * - Header fijo con: botón cerrar (izquierda), título (centro), acciones (derecha)
 * - Todos los componentes Radix (Popover, Select, etc.) funcionan correctamente dentro
 */

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FullScreenModalProps {
  open: boolean
  onClose: () => void
  title: string
  /** Optional subtitle shown above the title (e.g. venue name) */
  subtitle?: string
  children: React.ReactNode
  /** Optional action buttons for the right side of the header */
  actions?: React.ReactNode
  /** Optional className for the content container */
  contentClassName?: string
  /**
   * Optional Radix focus hooks. Default on open: focus is NOT moved (no field gets focus); on close: Radix's default.
   * Pass them to move focus into the modal on open, or to return it somewhere stable on close.
   */
  onOpenAutoFocus?: (event: Event) => void
  onCloseAutoFocus?: (event: Event) => void
  /** Esc dentro del modal. `event.preventDefault()` evita que se cierre (un editor que usa Esc para soltar una herramienta). */
  onEscapeKeyDown?: (event: KeyboardEvent) => void
  /** `data-testid` del botón de cerrar (para pruebas: «Cerrar» por nombre choca con el de un aviso abierto). */
  closeButtonTestId?: string
  /**
   * Clases del bloque del título. En un celular el título ya va en el flujo y se recorta solo; desde `sm` va centrado encima del header,
   * y ahí un título largo con muchas acciones puede encimarse: pasa un ancho máximo y `*:truncate`.
   */
  titleClassName?: string
}

export function FullScreenModal({
  open,
  onClose,
  title,
  subtitle,
  children,
  actions,
  contentClassName,
  onOpenAutoFocus,
  onCloseAutoFocus,
  onEscapeKeyDown,
  closeButtonTestId,
  titleClassName,
}: FullScreenModalProps) {
  const { t } = useTranslation()
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-card" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-card',
            // Animation: slide up from bottom on open, slide down on close
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'duration-300',
            // The container can end up focused (a caller moves focus to it, or Radix does: the family sheet, 19-oct): a focus ring
            // around the whole page is never useful.
            'outline-none'
          )}
          // Prevent auto-focus on first focusable element (we want natural flow)
          onOpenAutoFocus={onOpenAutoFocus ?? ((e) => e.preventDefault())}
          onCloseAutoFocus={onCloseAutoFocus}
          onEscapeKeyDown={onEscapeKeyDown}
        >
          {/* Header */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-card px-4 border-b border-border/30">
            {/* Left - Close button */}
            <DialogPrimitive.Close asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-12 w-12 shrink-0 rounded-full"
                data-tour="bundle-editor-close"
                data-testid={closeButtonTestId}
              >
                <X className="h-6 w-6" />
                <span className="sr-only">{t('common:close')}</span>
              </Button>
            </DialogPrimitive.Close>

            {/* Center - Title. En un celular (< sm) va junto a la X, en el flujo y recortado con «…»: centrado encima del header se
                encimaba con las acciones (a 375 px, «Exportar historial» quedaba debajo del botón «Exportar», 12-nov). Desde sm, centrado. */}
            <div
              className={cn(
                'min-w-0 flex-1 px-3 text-left max-sm:*:truncate',
                'sm:absolute sm:left-1/2 sm:flex-none sm:-translate-x-1/2 sm:px-0 sm:text-center',
                titleClassName
              )}
            >
              {subtitle && (
                <p className="text-xs text-muted-foreground leading-tight">{subtitle}</p>
              )}
              <DialogPrimitive.Title className="text-lg font-semibold leading-tight">
                {title}
              </DialogPrimitive.Title>
            </div>

            {/* Hidden description for accessibility */}
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>

            {/* Right - Actions */}
            <div className="flex shrink-0 items-center gap-2">
              {actions}
            </div>
          </header>

          {/* Content */}
          <main data-fsm-content="" className={cn('flex-1 overflow-y-auto', contentClassName)}>
            {children}
          </main>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

// Re-export the hook for backwards compatibility (no longer needed but kept for any existing usage)
export function useIsInsideFullScreenModal() {
  return false
}
