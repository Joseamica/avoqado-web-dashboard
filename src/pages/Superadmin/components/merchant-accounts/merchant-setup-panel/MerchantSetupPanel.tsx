import { useMemo, useReducer, useState } from 'react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { initialState, setupReducer, isCardValid, isRequiredComplete } from './useSetupReducer'
import { useDraftAutosave } from './useDraftStorage'
import { REQUIRED_CARDS } from './types'

interface MerchantSetupPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** `create` mode (no merchantId) opens an empty panel + checks draft.
   *  `edit` mode loads everything from DB and saves per card. */
  mode: 'create' | 'edit'
  /** Required when mode='edit'. */
  merchantAccountId?: string
}

/**
 * Object-centric panel for AngelPay merchant configuration. Replaces the
 * linear AngelPayWizard. See spec:
 * docs/superpowers/specs/2026-05-23-merchant-setup-panel-design.md
 *
 * In create mode the reducer holds local state, debounced to localStorage.
 * On "Activar merchant" the state is assembled and POSTed to the existing
 * fullSetupAngelPayMerchant endpoint. In edit mode, each card hits its own
 * CRUD endpoint and the panel acts as a dashboard.
 */
export default function MerchantSetupPanel({
  open,
  onOpenChange,
  mode,
  merchantAccountId: _merchantAccountId,
}: MerchantSetupPanelProps) {
  const { toast } = useToast()
  const [state, dispatch] = useReducer(setupReducer, undefined, initialState)
  const [showDraftBanner] = useState(false)

  // Resolve the user account id (only known once login card has chosen one)
  const userAccountId = state.login.mode === 'existing' ? state.login.angelpayUserAccountId : null

  // Draft autosave — only in create mode
  useDraftAutosave(state.venue.id, userAccountId, state, mode === 'create')

  // Progress for the header
  const progress = useMemo(() => {
    const completed = REQUIRED_CARDS.filter(k => isCardValid(state, k)).length
    return { completed, total: REQUIRED_CARDS.length, ready: isRequiredComplete(state) }
  }, [state])

  const handleActivate = () => {
    // Real implementation in Task 2.3 (assembleAndPost). Stub for now.
    toast({ title: 'TODO: wire up activate', description: 'Phase 2.3' })
  }

  // Acknowledge intentionally-unused props until later tasks wire them up.
  void dispatch

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={mode === 'create' ? 'Nuevo merchant AngelPay' : 'Configuración del merchant'}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {progress.completed} de {progress.total} obligatorios ✓
          </p>
          {mode === 'create' && (
            <Button
              onClick={handleActivate}
              disabled={!progress.ready}
              data-tour="setup-panel-activate"
            >
              Activar merchant
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
        {/* Cards rendered in Phase 3. Placeholder so the file compiles. */}
        <div className="rounded-2xl border border-border/50 bg-card p-6">
          <p className="text-sm text-muted-foreground">Cards aparecerán aquí (Phase 3).</p>
        </div>
      </div>

      {showDraftBanner && (
        <div className="fixed bottom-6 left-6 right-6 max-w-md mx-auto p-4 rounded-lg border border-input bg-muted/40">
          <p className="text-sm">Tienes un borrador guardado. ¿Continuar o descartar?</p>
        </div>
      )}
    </FullScreenModal>
  )
}
