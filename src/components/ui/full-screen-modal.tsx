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
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FullScreenModalProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  /** Optional action buttons for the right side of the header */
  actions?: React.ReactNode
  /** Optional className for the content container */
  contentClassName?: string
}

export function FullScreenModal({
  open,
  onClose,
  title,
  children,
  actions,
  contentClassName,
}: FullScreenModalProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-background" />
        <DialogPrimitive.Content
          className={cn(
            'fixed inset-0 z-50 flex flex-col bg-background',
            // Animation: slide up from bottom on open, slide down on close
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom',
            'duration-300'
          )}
          // Prevent auto-focus on first focusable element (we want natural flow)
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Header */}
          <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-background px-4 border-b border-border/30">
            {/* Left - Close button */}
            <DialogPrimitive.Close asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-12 w-12 rounded-full"
              >
                <X className="h-6 w-6" />
                <span className="sr-only">Cerrar</span>
              </Button>
            </DialogPrimitive.Close>

            {/* Center - Title */}
            <DialogPrimitive.Title className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold">
              {title}
            </DialogPrimitive.Title>

            {/* Hidden description for accessibility */}
            <DialogPrimitive.Description className="sr-only">
              {title}
            </DialogPrimitive.Description>

            {/* Right - Actions */}
            <div className="flex items-center gap-2">
              {actions}
            </div>
          </header>

          {/* Content */}
          <main className={cn('flex-1 overflow-y-auto', contentClassName)}>
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
