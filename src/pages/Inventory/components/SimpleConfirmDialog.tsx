import { useTranslation } from 'react-i18next'
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
 * SimpleConfirmDialog - Simple and direct confirmation dialog
 *
 * Component designed to be extremely simple for non-technical users.
 * Shows a clear message with two buttons: Cancel and Confirm.
 *
 * @example
 * ```tsx
 * <SimpleConfirmDialog
 *   open={isOpen}
 *   onOpenChange={setIsOpen}
 *   title={t('confirmDialog.title')}
 *   message={t('confirmDialog.message')}
 *   confirmLabel={t('confirmDialog.confirm')}
 *   onConfirm={handleConfirm}
 * />
 * ```
 */
export function SimpleConfirmDialog({
  open,
  onOpenChange,
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isLoading = false,
  variant = 'default',
}: SimpleConfirmDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')

  const resolvedConfirmLabel = confirmLabel ?? tCommon('continue')
  const resolvedCancelLabel = cancelLabel ?? tCommon('cancel')
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
            {resolvedCancelLabel}
          </Button>
          <Button type="button" variant={variant} onClick={handleConfirm} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {resolvedConfirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
