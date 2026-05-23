import { useMemo, useReducer } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { merchantRevenueShareAPI } from '@/services/merchantRevenueShare.service'
import { initialState, setupReducer, isCardValid, isRequiredComplete } from './useSetupReducer'
import { useDraftAutosave, clearDraft } from './useDraftStorage'
import { assemblePayload } from './assemblePayload'
import { REQUIRED_CARDS } from './types'
import VenueCard from './cards/VenueCard'
import AngelPayLoginCard from './cards/AngelPayLoginCard'
import MerchantCard from './cards/MerchantCard'
import SlotCard from './cards/SlotCard'
import CostCard from './cards/CostCard'
import PricingCard from './cards/PricingCard'

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
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(setupReducer, undefined, initialState)

  // Resolve the user account id (only known once login card has chosen one)
  const userAccountId = state.login.mode === 'existing' ? state.login.angelpayUserAccountId : null

  // Draft autosave — only in create mode
  useDraftAutosave(state.venue.id, userAccountId, state, mode === 'create')

  // Progress for the header
  const progress = useMemo(() => {
    const completed = REQUIRED_CARDS.filter(k => isCardValid(state, k)).length
    return { completed, total: REQUIRED_CARDS.length, ready: isRequiredComplete(state) }
  }, [state])

  const activateMutation = useMutation({
    mutationFn: () => paymentProviderAPI.fullSetupAngelPayMerchant(assemblePayload(state)),
    onSuccess: async result => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })

      // Follow-up: revenue share (non-atomic, non-blocking)
      if (!state.revenueShare.skipped) {
        try {
          await merchantRevenueShareAPI.create({
            merchantAccountId: result.merchantAccountId,
            aggregatorPrice: state.revenueShare.useAggregator
              ? {
                  DEBIT: state.revenueShare.aggregatorDebitRate ?? 0,
                  CREDIT: state.revenueShare.aggregatorCreditRate ?? 0,
                  AMEX: state.revenueShare.aggregatorAmexRate ?? 0,
                  INTERNATIONAL: state.revenueShare.aggregatorInternationalRate ?? 0,
                }
              : null,
            aggregatorPriceIncludesTax: state.revenueShare.aggregatorPriceIncludesTax,
            avoqadoShareOfProviderMargin: state.revenueShare.avoqadoShareOfProviderMargin,
            avoqadoShareOfAggregatorMargin: state.revenueShare.useAggregator
              ? state.revenueShare.avoqadoShareOfAggregatorMargin ?? 0.5
              : null,
            taxRate: state.revenueShare.taxRate,
          })
          toast({ title: 'Éxito', description: 'Merchant activado y reparto guardado' })
        } catch (rsErr: any) {
          toast({
            title: 'Merchant activado · reparto pendiente',
            description: rsErr?.response?.data?.message || 'El reparto no se guardó. Configúralo en /superadmin/aggregators.',
            variant: 'destructive',
          })
        }
      } else {
        toast({ title: 'Éxito', description: 'Merchant activado' })
      }

      // Clear draft + close
      clearDraft(state.venue.id, userAccountId)
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast({
        title: 'No pudimos activar el merchant',
        description: err?.response?.data?.message || 'Error en el servidor. Reintenta.',
        variant: 'destructive',
      })
    },
  })

  const handleActivate = () => activateMutation.mutate()

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
              disabled={!progress.ready || activateMutation.isPending}
              data-tour="setup-panel-activate"
            >
              {activateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Activar merchant
            </Button>
          )}
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
        <VenueCard state={state} dispatch={dispatch} mode={mode} />
        <AngelPayLoginCard state={state} dispatch={dispatch} mode={mode} />
        <MerchantCard state={state} dispatch={dispatch} mode={mode} />
        <SlotCard state={state} dispatch={dispatch} mode={mode} />
        <CostCard state={state} dispatch={dispatch} mode={mode} />
        <PricingCard state={state} dispatch={dispatch} mode={mode} />
        {/* More cards added in Tasks 3.7 - 3.9 */}
      </div>

      {/* Draft recovery banner: Task 5.1 */}
    </FullScreenModal>
  )
}
