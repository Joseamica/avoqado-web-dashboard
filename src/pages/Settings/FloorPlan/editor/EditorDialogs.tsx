import { useTranslation } from 'react-i18next'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'

/**
 * «¿Salir sin guardar?». `onStay` es «Seguir editando» (y Esc); `onLeave`, «Salir sin guardar». Ninguno pasa por
 * `onOpenChange`: Radix lo llama también DESPUÉS de «Salir sin guardar», y quedarse ahí cancelaría la salida.
 */
export function LeaveDialog({ open, onStay, onLeave }: { open: boolean; onStay: () => void; onLeave: () => void }) {
  const { t } = useTranslation('floorPlan')
  return (
    <AlertDialog open={open}>
      <AlertDialogContent onEscapeKeyDown={onStay}>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('editor.unsavedTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('editor.unsavedBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onStay}>{t('editor.keepEditing')}</AlertDialogCancel>
          <AlertDialogAction onClick={onLeave} data-testid="floor-plan-discard">
            {t('editor.unsavedConfirm')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** «Alguien más cambió el plano» (409): recargar (se pierden los cambios) o seguir editando. */
export function ConflictDialog({ open, onStay, onReload }: { open: boolean; onStay: () => void; onReload: () => void }) {
  const { t } = useTranslation('floorPlan')
  return (
    <AlertDialog open={open} onOpenChange={o => !o && onStay()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('editor.conflictTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('editor.conflictBody')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('editor.keepEditing')}</AlertDialogCancel>
          <AlertDialogAction onClick={onReload} data-testid="floor-plan-reload">
            {t('editor.reload')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
