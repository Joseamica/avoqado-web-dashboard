import { forwardRef, useEffect, useImperativeHandle, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useCreateCommissionConfig, useCreateOrgCommissionConfig } from '@/hooks/useCommissions'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { commissionService } from '@/services/commission.service'
import type {
  CommissionRecipient,
  CommissionCalcType,
  TierPeriod,
  CreateCommissionConfigInput,
  CreateCommissionTierInput,
} from '@/types/commission'
import StepAmount from './StepAmount'
import StepConfirm from './StepConfirm'
import { calcTypeAGuardar, excepcionesAGuardar, ofreceNiveles, tasasPorRolAGuardar } from '../../tasaDelEsquema'
import { finDelDiaEnLaSede, hoyEnLaSede, inicioDelDiaEnLaSede, useZonaDeLaSede } from '../../fechasDeVigencia'

// Override type for wizard (simplified from CreateCommissionOverrideInput)
export interface WizardOverride {
  staffId: string
  staffName: string // For display purposes
  customRate: number | null // Stored as decimal (0.03 = 3%)
  excludeFromCommissions: boolean
}

// Wizard data structure
export interface WizardData {
  // Recipient is always SERVER (same person takes order and charges via PIN login)
  recipient: CommissionRecipient

  // Step 1: Amount & Advanced
  calcType: CommissionCalcType // 'PERCENTAGE' or 'FIXED'
  defaultRate: number // Stored as decimal (0.03 = 3%) - used for PERCENTAGE
  fixedAmount: number // Fixed amount per transaction - used for FIXED

  // Base de cálculo
  includeTax: boolean
  includeTips: boolean
  includeDiscount: boolean

  // Category filtering
  filterByCategories: boolean
  categoryIds: string[]

  // Goal-based tier (use staff's monthly goal as tier threshold)
  useGoalAsTier: boolean
  goalBonusRate: number // decimal, e.g. 0.06 for 6%
  // Asistencia → comisiones: un día con retardo pierde este % de sus comisiones. Nace apagada.
  attendanceLinked: boolean
  attendanceLatePenaltyRate: number // decimal, e.g. 0.25 = pierde el 25%

  // Advanced: Tiers
  tiersEnabled: boolean
  tierPeriod: TierPeriod
  tiers: CreateCommissionTierInput[]

  // Advanced: Role rates
  roleRatesEnabled: boolean
  roleRates: Record<string, number>

  // Advanced: Limits
  limitsEnabled: boolean
  minAmount: number | null
  maxAmount: number | null

  // Advanced: Overrides (exceptions for specific staff)
  overridesEnabled: boolean
  overrides: WizardOverride[]

  // Step 2: Name & Validity
  name: string
  customValidityEnabled: boolean
  effectiveFrom: string // ISO date string
  effectiveTo: string | null // ISO date string or null for no end date

  // Aggregation period for payroll alignment
  aggregationPeriod: TierPeriod // WEEKLY, BIWEEKLY, MONTHLY - how often to group commissions for payout

  // Priority for config selection (higher = takes precedence)
  priority: number
}

const initialData: WizardData = {
  recipient: 'SERVER',
  defaultRate: 0.03, // 3%
  calcType: 'PERCENTAGE',
  fixedAmount: 10, // $10 default for fixed amount
  includeTax: false,
  includeTips: false,
  includeDiscount: false,
  filterByCategories: false,
  categoryIds: [],
  useGoalAsTier: false,
  attendanceLinked: false,
  attendanceLatePenaltyRate: 0.25,
  goalBonusRate: 0.06, // 6% default bonus rate
  tiersEnabled: false,
  tierPeriod: 'MONTHLY',
  tiers: [
    { tierLevel: 1, name: 'Bronce', minThreshold: 0, maxThreshold: 10000, rate: 0.02 },
    { tierLevel: 2, name: 'Plata', minThreshold: 10000, maxThreshold: 25000, rate: 0.03 },
    { tierLevel: 3, name: 'Oro', minThreshold: 25000, maxThreshold: null, rate: 0.04 },
  ],
  roleRatesEnabled: false,
  roleRates: {
    WAITER: 0.03,
    CASHIER: 0.025,
    MANAGER: 0.015,
  },
  limitsEnabled: false,
  minAmount: null,
  maxAmount: null,
  overridesEnabled: false,
  overrides: [],
  name: '',
  customValidityEnabled: false,
  effectiveFrom: '', // «hoy» en la zona del negocio, al montar (ft-graves, D-D2)
  effectiveTo: null,
  aggregationPeriod: 'MONTHLY', // Default to monthly (most common payroll alignment)
  priority: 1, // Default priority (higher = takes precedence when multiple configs exist)
}

export interface WizardHandle {
  goNext: () => void
  goPrevious: () => void
  submit: () => Promise<void>
}

export interface WizardStepInfo {
  currentStep: number
  totalSteps: number
  canSubmit: boolean
  isSubmitting: boolean
}

interface CreateCommissionWizardProps {
  onSuccess: () => void
  onCancel?: () => void
  isOrgLevel?: boolean
  /** Called whenever wizard step or submit-readiness changes */
  onStepChange?: (info: WizardStepInfo) => void
  /** When true, steps won't render their own bottom navigation buttons */
  hideNavigation?: boolean
}

const CreateCommissionWizard = forwardRef<WizardHandle, CreateCommissionWizardProps>(
  ({ onSuccess, isOrgLevel = false, onStepChange, hideNavigation = false }, ref) => {
    const { t } = useTranslation('commissions')
    const { t: tCommon } = useTranslation()
    const { toast } = useToast()
    const { venueId } = useCurrentVenue()
    const [currentStep, setCurrentStep] = useState(1)
    const zona = useZonaDeLaSede()
    const [data, setData] = useState<WizardData>(() => ({ ...initialData, effectiveFrom: hoyEnLaSede(zona) }))

    const createConfigMutation = useCreateCommissionConfig()
    const createOrgConfigMutation = useCreateOrgCommissionConfig()
    const activeMutation = isOrgLevel ? createOrgConfigMutation : createConfigMutation

    const updateData = (updates: Partial<WizardData>) => {
      setData(prev => ({ ...prev, ...updates }))
    }

    const handleNext = () => {
      if (currentStep < 2) {
        setCurrentStep(prev => prev + 1)
      }
    }

    const handlePrevious = () => {
      if (currentStep > 1) {
        setCurrentStep(prev => prev - 1)
      }
    }

    const handleSubmit = async () => {
      try {
        // For FIXED type, use fixedAmount; for PERCENTAGE/TIERED, use defaultRate
        const effectiveRate = data.calcType === 'FIXED' ? data.fixedAmount : data.defaultRate

        // Niveles o meta como nivel ⇒ TIERED, sólo con porcentaje. 🔴 Un fijo se guarda FIXED aunque traiga niveles o meta como nivel
        // prendidos de antes: como TIERED, el servidor leería el monto como tasa (final-fijo-niveles).
        const conNiveles = ofreceNiveles(data.calcType)
        const finalCalcType = calcTypeAGuardar(data.calcType, data.tiersEnabled, data.useGoalAsTier)
        const metaComoNivel = conNiveles && data.useGoalAsTier

        const input: CreateCommissionConfigInput = {
          name: data.name,
          recipient: data.recipient,
          calcType: finalCalcType,
          defaultRate: effectiveRate,
          minAmount: data.limitsEnabled ? data.minAmount : null,
          maxAmount: data.limitsEnabled ? data.maxAmount : null,
          includeTips: data.includeTips,
          includeDiscount: data.includeDiscount,
          includeTax: data.includeTax,
          roleRates: tasasPorRolAGuardar(data.calcType, data.roleRatesEnabled, data.roleRates),
          filterByCategories: data.filterByCategories,
          categoryIds: data.filterByCategories ? data.categoryIds : [],
          useGoalAsTier: metaComoNivel,
          goalBonusRate: metaComoNivel ? data.goalBonusRate : null,
          priority: data.priority,
          // El día del negocio, no el del navegador: «desde» su inicio, «hasta» incluido entero (ft-graves, D-D2).
          effectiveFrom: data.effectiveFrom ? inicioDelDiaEnLaSede(data.effectiveFrom, zona) : undefined,
          effectiveTo: data.effectiveTo ? finDelDiaEnLaSede(data.effectiveTo, zona) : null,
          aggregationPeriod: data.aggregationPeriod,
        }

        const createdConfig = await activeMutation.mutateAsync(input)

        // Create tiers after config creation if enabled (nunca en un fijo: los niveles son porcentajes)
        if (conNiveles && data.tiersEnabled && data.tiers.length > 0 && venueId && createdConfig?.id) {
          const tiersWithPeriod = data.tiers.map(tier => ({
            ...tier,
            tierPeriod: data.tierPeriod,
          }))
          await commissionService.createTiersBatch(venueId, createdConfig.id, tiersWithPeriod)
        }

        // Create overrides after config creation if enabled. En un fijo sólo viajan las exclusiones, sin tasa propia.
        if (data.overridesEnabled && data.overrides.length > 0 && venueId && createdConfig?.id) {
          const excepciones = excepcionesAGuardar(
            data.calcType,
            data.overrides.map(override => ({
              staffId: override.staffId,
              customRate: override.excludeFromCommissions ? null : override.customRate,
              excluir: override.excludeFromCommissions,
            })),
          )
          await Promise.all(excepciones.map(excepcion => commissionService.createOverride(venueId, createdConfig.id, excepcion)))
        }

        toast({
          title: t('success.configCreated'),
        })
        onSuccess()
      } catch (error: any) {
        toast({
          title: t('errors.saveError'),
          description: error.response?.data?.message || tCommon('common.error'),
          variant: 'destructive',
        })
      }
    }

    // Expose navigation methods to parent via ref
    useImperativeHandle(ref, () => ({
      goNext: handleNext,
      goPrevious: handlePrevious,
      submit: handleSubmit,
    }))

    // Notify parent of step changes
    useEffect(() => {
      onStepChange?.({
        currentStep,
        totalSteps: 2,
        canSubmit: data.name.trim().length > 0,
        isSubmitting: activeMutation.isPending,
      })
    }, [currentStep, data.name, activeMutation.isPending])

    return (
      <div className="space-y-6">
        {currentStep === 1 && <StepAmount data={data} updateData={updateData} onNext={handleNext} hideNavigation={hideNavigation} />}

        {currentStep === 2 && (
          <StepConfirm
            data={data}
            updateData={updateData}
            onPrevious={handlePrevious}
            onSubmit={handleSubmit}
            isSubmitting={activeMutation.isPending}
            hideNavigation={hideNavigation}
          />
        )}
      </div>
    )
  },
)

CreateCommissionWizard.displayName = 'CreateCommissionWizard'
export default CreateCommissionWizard
