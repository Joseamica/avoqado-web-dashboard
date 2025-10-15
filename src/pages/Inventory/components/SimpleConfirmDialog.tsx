import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface SimpleConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void | Promise<void>
  isLoading?: boolean
  variant?: 'default' | 'destructive'
}

/**
 * SimpleConfirmDialog - Diálogo de confirmación simple y directo
 *
 * Componente diseñado para ser extremadamente simple para usuarios no técnicos.
 * Muestra un mensaje claro con dos botones: Cancelar y Confirmar.
 *
 * @example
 * ```tsx
 * <SimpleConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title="¿Cambiar a Receta?"
 *   message="Para agregar ingredientes, vamos a actualizar tu configuración."
 *   confirmLabel="Sí, cambiar"
 *   onConfirm={handleConfirm}
 * />
 * ```
 */
export function SimpleConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel = 'Continuar',
  cancelLabel = 'Cancelar',
  onConfirm,
  isLoading = false,
  variant = 'default',
}: SimpleConfirmDialogProps) {
  const handleConfirm = async () => {
    await onConfirm()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="text-xl">{title}</DialogTitle>
          <DialogDescription className="text-base pt-2">{message}</DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {cancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
