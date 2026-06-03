import { useMemo, useReducer } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useToast } from '@/hooks/use-toast'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { commissionService } from '@/services/commission.service'
import { REQUIRED_CARDS } from './types'
import { initialState, setupReducer, isCardValid, isRequiredComplete } from './useSetupReducer'
import RateCard from './cards/RateCard'
import NameCard from './cards/NameCard'
import StaffCard from './cards/StaffCard'
import CalculationBaseCard from './cards/CalculationBaseCard'
import CategoriesCard from './cards/CategoriesCard'
import PeriodCard from './cards/PeriodCard'
import TiersCard from './cards/TiersCard'
import RoleRatesCard from './cards/RoleRatesCard'
import LimitsCard from './cards/LimitsCard'

interface CommissionSetupPanelProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export default function CommissionSetupPanel({ open, onOpenChange }: CommissionSetupPanelProps) {
  const { t } = useTranslation('commissions')
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(setupReducer, undefined, initialState)

  const progress = useMemo(() => {
    const completed = REQUIRED_CARDS.filter(k => isCardValid(state, k)).length
    return { completed, total: REQUIRED_CARDS.length, ready: isRequiredComplete(state) }
  }, [state])

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!venueId) throw new Error('No venue')

      const config = await commissionService.createConfig(venueId, {
        name: state.name.value,
        recipient: state.rate.recipient,
        calcType: state.rate.calcType,
        defaultRate: state.rate.calcType === 'FIXED' ? state.rate.fixedAmount : state.rate.defaultRate,
        includeTax: state.calculationBase.includeTax,
        includeTips: state.calculationBase.includeTips,
        includeDiscount: state.calculationBase.includeDiscount,
        filterByCategories: state.categories.filterEnabled,
        categoryIds: state.categories.filterEnabled ? state.categories.categoryIds : [],
        aggregationPeriod: state.period.aggregationPeriod,
        effectiveFrom: state.name.effectiveFrom
          ? new Date(`${state.name.effectiveFrom}T00:00:00`).toISOString()
          : undefined,
        effectiveTo: state.name.effectiveTo
          ? new Date(`${state.name.effectiveTo}T23:59:59`).toISOString()
          : undefined,
        priority: state.name.priority,
        roleRates: state.roleRates.enabled ? state.roleRates.rates : undefined,
        minAmount: state.limits.enabled ? state.limits.minAmount : undefined,
        maxAmount: state.limits.enabled ? state.limits.maxAmount : undefined,
      })

      if (state.tiers.enabled && state.tiers.items.length > 0) {
        await commissionService.createTiersBatch(
          venueId,
          config.id,
          state.tiers.items.map(tier => ({
            tierLevel: tier.level,
            name: tier.name,
            tierType: 'BY_AMOUNT' as const,
            minThreshold: tier.minThreshold,
            maxThreshold: tier.maxThreshold,
            minThresholdType: tier.minThresholdType,
            maxThresholdType: tier.maxThresholdType,
            rate: tier.rate,
            period: state.tiers.tierPeriod,
          })),
        )
      }

      if (state.staff.overrides.length > 0) {
        for (const override of state.staff.overrides) {
          await commissionService.createOverride(venueId, config.id, {
            staffId: override.staffId,
            customRate: override.customRate ?? state.rate.defaultRate,
            excludeFromCommissions: override.excluded,
          })
        }
      }

      return config
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission'] })
      toast({ title: t('success.configCreated') })
      dispatch({ type: 'RESET' })
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast({
        title: t('errors.createError'),
        description: err?.response?.data?.message || err?.message,
        variant: 'destructive',
      })
    },
  })

  return (
    <FullScreenModal
      open={open}
      onClose={() => {
        dispatch({ type: 'RESET' })
        onOpenChange(false)
      }}
      title={t('setup.title')}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-3">
          <p className="text-xs text-muted-foreground">
            {progress.completed} de {progress.total} {t('setup.requiredLabel')} ✓
          </p>
          <Button
            onClick={() => createMutation.mutate()}
            disabled={!progress.ready || createMutation.isPending}
          >
            {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {t('setup.createButton')}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 p-6">
        {/* Row 1: Required */}
        <RateCard state={state} dispatch={dispatch} />
        <NameCard state={state} dispatch={dispatch} />
        <StaffCard state={state} dispatch={dispatch} />

        {/* Row 2: Smart defaults */}
        <CalculationBaseCard state={state} dispatch={dispatch} />
        <CategoriesCard state={state} dispatch={dispatch} />
        <PeriodCard state={state} dispatch={dispatch} />

        {/* Row 3: Advanced optional */}
        <TiersCard state={state} dispatch={dispatch} />
        <RoleRatesCard state={state} dispatch={dispatch} />
        <LimitsCard state={state} dispatch={dispatch} />
      </div>
    </FullScreenModal>
  )
}
