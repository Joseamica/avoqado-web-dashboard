import { useEffect, useMemo, useReducer, useState } from 'react'
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
import { useMerchantBundle, bundleToSetupState } from './useMerchantBundle'
import { REQUIRED_CARDS } from './types'
import VenueCard from './cards/VenueCard'
import AngelPayLoginCard from './cards/AngelPayLoginCard'
import MerchantCard from './cards/MerchantCard'
import SlotCard from './cards/SlotCard'
import CostCard from './cards/CostCard'
import PricingCard from './cards/PricingCard'
import SettlementCard from './cards/SettlementCard'
import RevenueShareCard from './cards/RevenueShareCard'
import TerminalsCard from './cards/TerminalsCard'

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
  merchantAccountId,
}: MerchantSetupPanelProps) {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(setupReducer, undefined, initialState)

  // Resolve the user account id (only known once login card has chosen one)
  const userAccountId = state.login.mode === 'existing' ? state.login.angelpayUserAccountId : null

  // Draft autosave — only in create mode
  useDraftAutosave(state.venue.id, userAccountId, state, mode === 'create')

  // Edit-mode hydration: fire 8 parallel queries and load the bundle into the
  // reducer once. `hydrated` guards against re-hydration on refetch/refocus —
  // per-card edits in Task 4.2 will mutate local state and we don't want a
  // background refetch to clobber them.
  const { bundle, isLoading: bundleLoading, isError: bundleError } = useMerchantBundle(
    merchantAccountId,
    mode === 'edit' && open,
  )
  const [hydrated, setHydrated] = useState(false)
  useEffect(() => {
    if (mode === 'edit' && bundle && !hydrated) {
      dispatch({ type: 'LOAD_DRAFT', state: bundleToSetupState(bundle) })
      setHydrated(true)
    }
  }, [mode, bundle, hydrated])

  // Reset hydration flag when the panel closes so a re-open re-hydrates fresh.
  useEffect(() => {
    if (!open) setHydrated(false)
  }, [open])

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

  // Title — in edit mode, include the merchant's display label once the bundle resolves
  const merchantLabel =
    bundle?.merchant.displayName ?? bundle?.merchant.alias ?? bundle?.merchant.externalMerchantId ?? ''
  const title =
    mode === 'create'
      ? 'Nuevo merchant AngelPay'
      : merchantLabel
        ? `Configuración · ${merchantLabel}`
        : 'Configuración del merchant'

  const showSkeleton = mode === 'edit' && bundleLoading && !hydrated

  return (
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={title}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-3">
          {mode === 'create' && (
            <p className="text-xs text-muted-foreground">
              {progress.completed} de {progress.total} obligatorios ✓
            </p>
          )}
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
      {mode === 'edit' && bundleError && (
        <div className="mx-6 mt-6 rounded-md border border-destructive bg-destructive/10 p-4 text-sm">
          No pudimos cargar la configuración del merchant. Reintenta o cierra el panel.
        </div>
      )}

      <div className="relative">
        {showSkeleton && (
          <div
            className="absolute inset-0 z-10 flex items-center justify-center bg-muted/40 backdrop-blur-[1px]"
            data-testid="setup-panel-hydrating"
          >
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
          <VenueCard state={state} dispatch={dispatch} mode={mode} />
          <AngelPayLoginCard state={state} dispatch={dispatch} mode={mode} />
          <MerchantCard state={state} dispatch={dispatch} mode={mode} />
          <SlotCard state={state} dispatch={dispatch} mode={mode} />
          <CostCard
            state={state}
            dispatch={dispatch}
            mode={mode}
            merchantAccountId={mode === 'edit' ? merchantAccountId : undefined}
            providerId={mode === 'edit' ? bundle?.merchant.providerId : undefined}
          />
          <PricingCard state={state} dispatch={dispatch} mode={mode} />
          <SettlementCard state={state} dispatch={dispatch} mode={mode} />
          <RevenueShareCard state={state} dispatch={dispatch} mode={mode} />
          <TerminalsCard state={state} dispatch={dispatch} mode={mode} />
        </div>
      </div>

      {/* Draft recovery banner: Task 5.1 */}
    </FullScreenModal>
  )
}
