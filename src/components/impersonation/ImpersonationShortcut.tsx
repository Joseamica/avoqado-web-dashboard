/**
 * ImpersonationShortcut
 *
 * Binds ⌘⇧I / Ctrl+Shift+I globally:
 *   - When NOT impersonating: toggles the header's ImpersonationPicker popover.
 *   - When impersonating: immediately calls /stop (acts as an "exit" hotkey).
 *
 * Rendered as a non-visual component from dashboard.tsx. Hidden entirely for
 * non-SUPERADMIN users.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useImpersonation } from '@/hooks/use-impersonation'
import { useToast } from '@/hooks/use-toast'

interface ImpersonationShortcutProps {
  onTogglePicker: () => void
}

export function ImpersonationShortcut({ onTogglePicker }: ImpersonationShortcutProps) {
  const { t } = useTranslation(['impersonation'])
  const { toast } = useToast()
  const { isImpersonating, isRealSuperadmin, stopImpersonation } = useImpersonation()

  useEffect(() => {
    // Bind the shortcut whenever the user is "really" a SUPERADMIN — this
    // includes ongoing impersonation sessions where `user.role` has been
    // swapped to the target (WAITER, etc.) but the underlying actor is
    // still a SUPERADMIN.
    if (!isRealSuperadmin) return

    const handler = (e: KeyboardEvent) => {
      // ⌘⇧I on Mac, Ctrl+Shift+I elsewhere. Use KeyI to stay layout-independent.
      // Ignore when user is typing in an input / textarea / contenteditable.
      const target = e.target as HTMLElement | null
      if (target) {
        const tag = target.tagName
        if (
          tag === 'INPUT' ||
          tag === 'TEXTAREA' ||
          tag === 'SELECT' ||
          target.isContentEditable
        ) {
          return
        }
      }

      const isShortcut = e.shiftKey && (e.metaKey || e.ctrlKey) && (e.code === 'KeyI' || e.key.toLowerCase() === 'i')
      if (!isShortcut) return

      e.preventDefault()

      if (isImpersonating) {
        stopImpersonation()
          .then(() => toast({ title: t('impersonation:toast.stopped') }))
          .catch(() => toast({ title: t('impersonation:toast.stopFailed'), variant: 'destructive' }))
      } else {
        onTogglePicker()
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isRealSuperadmin, isImpersonating, onTogglePicker, stopImpersonation, toast, t])

  return null
}
