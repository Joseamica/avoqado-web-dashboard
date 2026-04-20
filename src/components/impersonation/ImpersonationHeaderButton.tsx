/**
 * ImpersonationHeaderButton
 *
 * SUPERADMIN-only header action. Two states:
 *   - Not impersonating: gradient amber→pink "Impersonar" button that opens
 *     the ImpersonationPicker in a Popover.
 *   - Impersonating: destructive "Salir impersonación" button that calls /stop.
 *
 * Hidden for non-SUPERADMINs. Keyboard shortcut ⌘⇧I / Ctrl+Shift+I is bound
 * globally (in ImpersonationShortcut) to toggle this control.
 */
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, UserCog } from 'lucide-react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { useImpersonation } from '@/hooks/use-impersonation'
import { useToast } from '@/hooks/use-toast'
import { ImpersonationPicker } from './ImpersonationPicker'

interface ImpersonationHeaderButtonProps {
  /** Controlled open state — the global shortcut toggles this. */
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ImpersonationHeaderButton({ open, onOpenChange }: ImpersonationHeaderButtonProps) {
  const { t } = useTranslation(['impersonation'])
  const { toast } = useToast()
  const { isImpersonating, isRealSuperadmin, isStopping, stopImpersonation } = useImpersonation()

  // Close the popover automatically once an impersonation session starts.
  // Declared before the early-return so the hook order stays stable.
  useEffect(() => {
    if (isImpersonating && open) onOpenChange(false)
  }, [isImpersonating, open, onOpenChange])

  // The control is visible when the user is "really" a SUPERADMIN — either
  // they are one normally or they are currently impersonating (so the exit
  // path must stay reachable even though `user.role` now reflects the target).
  if (!isRealSuperadmin) return null

  const handleExit = async () => {
    try {
      await stopImpersonation()
      toast({ title: t('impersonation:toast.stopped') })
    } catch (err: any) {
      toast({
        title: err?.response?.data?.message ?? t('impersonation:toast.stopFailed'),
        variant: 'destructive',
      })
    }
  }

  if (isImpersonating) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleExit}
        disabled={isStopping}
        title={t('impersonation:button.tooltipExit') ?? undefined}
        className="h-8 gap-1.5 border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground cursor-pointer"
      >
        <LogOut className="h-3.5 w-3.5" />
        <span className="hidden sm:inline text-xs">{t('impersonation:button.exit')}</span>
      </Button>
    )
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          title={t('impersonation:button.tooltip') ?? undefined}
          className="h-8 gap-1.5 bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground hover:from-amber-500 hover:to-pink-600 cursor-pointer"
        >
          <UserCog className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">{t('impersonation:button.open')}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="p-0 w-auto">
        <ImpersonationPicker onImpersonationStarted={() => onOpenChange(false)} />
      </PopoverContent>
    </Popover>
  )
}
