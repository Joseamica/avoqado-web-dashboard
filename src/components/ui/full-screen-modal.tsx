/**
 * FullScreenModal - Modal de pantalla completa estilo Square
 *
 * Características:
 * - Cubre toda la pantalla (incluyendo header, sidebar, etc.)
 * - Animación de entrada desde abajo hacia arriba
 * - Header fijo con: botón cerrar (izquierda), título (centro), acciones (derecha)
 * - z-index máximo para estar por encima de todo
 * - Scroll en el contenido
 * - Context para que cualquier Dialog dentro aparezca automáticamente arriba
 */

import React, { createContext, useContext, useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

/**
 * Context to track if we're inside a FullScreenModal.
 * Used by Dialog component to automatically use higher z-index.
 */
const FullScreenModalContext = createContext(false)

/**
 * Hook to check if current component is rendered inside a FullScreenModal.
 * Used by Dialog to automatically apply higher z-index.
 */
export function useIsInsideFullScreenModal() {
  return useContext(FullScreenModalContext)
}

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
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (open) {
      // Mount the component
      setIsVisible(true)
      // Trigger animation after mount (next frame)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
      // Prevent body scroll
      document.body.style.overflow = 'hidden'
    } else {
      // Start exit animation
      setIsAnimating(false)
      // Wait for animation to complete before unmounting
      const timer = setTimeout(() => {
        setIsVisible(false)
        document.body.style.overflow = ''
      }, 300) // Match animation duration
      return () => clearTimeout(timer)
    }

    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!isVisible) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col bg-background',
        'transition-transform duration-300 ease-out',
        isAnimating ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-background px-4 border-b border-border/30">
        {/* Left - Close button */}
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="h-12 w-12 rounded-full"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Cerrar</span>
        </Button>

        {/* Center - Title */}
        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold">
          {title}
        </h1>

        {/* Right - Actions */}
        <div className="flex items-center gap-2">
          {actions}
        </div>
      </header>

      {/* Content - wrapped with context so any Dialog inside knows to use higher z-index */}
      <main className={cn('flex-1 overflow-y-auto', contentClassName)}>
        <FullScreenModalContext.Provider value={true}>
          {children}
        </FullScreenModalContext.Provider>
      </main>
    </div>,
    document.body
  )
}
