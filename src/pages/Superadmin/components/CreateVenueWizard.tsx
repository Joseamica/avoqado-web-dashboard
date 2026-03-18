import React, { useCallback, useMemo, useState } from 'react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AddressAutocomplete } from '@/components/address-autocomplete'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getOrganizationsList,
  type OrganizationSimple,
} from '@/services/superadmin-organizations.service'
import { superadminAPI } from '@/services/superadmin.service'
import {
  paymentProviderAPI,
  type MccLookupResult,
  type FullSetupRequest,
} from '@/services/paymentProvider.service'
import {
  DEFAULT_SETTLEMENT_DAYS,
  type SettlementDayType,
} from '@/services/settlementConfiguration.service'
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  Copy,
  CreditCard,
  Info,
  Loader2,
  MapPin,
  Phone,
  Sparkles,
  Store,
  Utensils,
  ShoppingBag,
  Scissors,
  Hotel,
  PartyPopper,
  HelpCircle,
  Zap,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ══════════════════════════════════════════════════════════════════════
// Business type categories (superadmin = hardcoded Spanish)
// ══════════════════════════════════════════════════════════════════════

interface BusinessTypeOption {
  value: string
  label: string
  category: string
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  FOOD_SERVICE: <Utensils className="w-5 h-5" />,
  RETAIL: <ShoppingBag className="w-5 h-5" />,
  SERVICES: <Scissors className="w-5 h-5" />,
  HOSPITALITY: <Hotel className="w-5 h-5" />,
  ENTERTAINMENT: <PartyPopper className="w-5 h-5" />,
  OTHER: <HelpCircle className="w-5 h-5" />,
}

const BUSINESS_CATEGORIES: { key: string; label: string; types: BusinessTypeOption[] }[] = [
  {
    key: 'FOOD_SERVICE',
    label: 'Alimentos y bebidas',
    types: [
      { value: 'RESTAURANT', label: 'Restaurante', category: 'FOOD_SERVICE' },
      { value: 'FAST_FOOD', label: 'Comida rápida', category: 'FOOD_SERVICE' },
      { value: 'BAR', label: 'Bar / Antro', category: 'FOOD_SERVICE' },
      { value: 'CAFE', label: 'Cafetería', category: 'FOOD_SERVICE' },
      { value: 'BAKERY', label: 'Panadería / Pastelería', category: 'FOOD_SERVICE' },
      { value: 'FOOD_TRUCK', label: 'Food truck', category: 'FOOD_SERVICE' },
      { value: 'CATERING', label: 'Catering', category: 'FOOD_SERVICE' },
      { value: 'CLOUD_KITCHEN', label: 'Cocina oculta / Dark kitchen', category: 'FOOD_SERVICE' },
    ],
  },
  {
    key: 'RETAIL',
    label: 'Comercio',
    types: [
      { value: 'RETAIL_STORE', label: 'Tienda general', category: 'RETAIL' },
      { value: 'CONVENIENCE_STORE', label: 'Tienda de conveniencia', category: 'RETAIL' },
      { value: 'CLOTHING', label: 'Tienda de ropa', category: 'RETAIL' },
      { value: 'ELECTRONICS', label: 'Tienda de electrónica', category: 'RETAIL' },
      { value: 'PHARMACY', label: 'Farmacia', category: 'RETAIL' },
      { value: 'TELECOMUNICACIONES', label: 'Telecomunicaciones', category: 'RETAIL' },
    ],
  },
  {
    key: 'SERVICES',
    label: 'Servicios',
    types: [
      { value: 'SALON', label: 'Salón de belleza / Estética', category: 'SERVICES' },
      { value: 'SPA', label: 'Spa / Centro de bienestar', category: 'SERVICES' },
      { value: 'FITNESS', label: 'Gimnasio / Fitness', category: 'SERVICES' },
      { value: 'CLINIC', label: 'Consultorio médico / Clínica', category: 'SERVICES' },
      { value: 'VETERINARY', label: 'Veterinaria', category: 'SERVICES' },
      { value: 'AUTO_SERVICE', label: 'Taller mecánico / Automotriz', category: 'SERVICES' },
      { value: 'LAUNDRY', label: 'Lavandería / Tintorería', category: 'SERVICES' },
      { value: 'REPAIR_SHOP', label: 'Taller de reparación', category: 'SERVICES' },
    ],
  },
  {
    key: 'HOSPITALITY',
    label: 'Hospedaje',
    types: [
      { value: 'HOTEL', label: 'Hotel', category: 'HOSPITALITY' },
      { value: 'HOSTEL', label: 'Hostal', category: 'HOSPITALITY' },
      { value: 'RESORT', label: 'Resort', category: 'HOSPITALITY' },
    ],
  },
  {
    key: 'ENTERTAINMENT',
    label: 'Entretenimiento',
    types: [
      { value: 'CINEMA', label: 'Cine', category: 'ENTERTAINMENT' },
      { value: 'NIGHTCLUB', label: 'Antro / Club nocturno', category: 'ENTERTAINMENT' },
      { value: 'EVENT_VENUE', label: 'Salón de eventos', category: 'ENTERTAINMENT' },
      { value: 'ARCADE', label: 'Arcade / Centro de juegos', category: 'ENTERTAINMENT' },
      { value: 'BOWLING', label: 'Boliche', category: 'ENTERTAINMENT' },
    ],
  },
  {
    key: 'OTHER',
    label: 'Otros',
    types: [{ value: 'OTHER', label: 'Otro', category: 'OTHER' }],
  },
]

// ══════════════════════════════════════════════════════════════════════
// Shared types
// ══════════════════════════════════════════════════════════════════════

interface RateData {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedCost: number
  monthlyFee: number
}

interface SettlementData {
  dayType: SettlementDayType
  cutoffTime: string
  cutoffTimezone: string
  debitDays: number
  creditDays: number
  amexDays: number
  internationalDays: number
  otherDays: number
}

interface MerchantData {
  enabled: boolean
  mode: 'new' | 'copy' | null
  serialNumber: string
  brand: string
  model: string
  displayName: string
  environment: 'SANDBOX' | 'PRODUCTION'
  autofetchDone: boolean
  autofetchResult: {
    id: string
    posId: string
    dukptKeysAvailable: boolean
  } | null
  mccResult: MccLookupResult | null
  copyFromVenueId: string
  providerCosts: RateData
  providerCostsAutoCalculated: boolean
  settlement: SettlementData
  venuePricing: RateData
  venuePricingAutoCalculated: boolean
}

interface VenueFormData {
  organizationId: string
  name: string
  phone: string
  type: string
  address: string
  city: string
  state: string
  country: string
  zipCode: string
  latitude: number
  longitude: number
  timezone: string
}

const INITIAL_FORM: VenueFormData = {
  organizationId: '',
  name: '',
  phone: '',
  type: '',
  address: '',
  city: '',
  state: '',
  country: '',
  zipCode: '',
  latitude: 0,
  longitude: 0,
  timezone: '',
}

const EMPTY_RATES: RateData = {
  debitRate: 0,
  creditRate: 0,
  amexRate: 0,
  internationalRate: 0,
  fixedCost: 0,
  monthlyFee: 0,
}

const DEFAULT_SETTLEMENT: SettlementData = {
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
  debitDays: DEFAULT_SETTLEMENT_DAYS.DEBIT,
  creditDays: DEFAULT_SETTLEMENT_DAYS.CREDIT,
  amexDays: DEFAULT_SETTLEMENT_DAYS.AMEX,
  internationalDays: DEFAULT_SETTLEMENT_DAYS.INTERNATIONAL,
  otherDays: DEFAULT_SETTLEMENT_DAYS.OTHER,
}

const INITIAL_MERCHANT: MerchantData = {
  enabled: false,
  mode: null,
  serialNumber: '',
  brand: 'PAX',
  model: 'A910S',
  displayName: '',
  environment: 'SANDBOX',
  autofetchDone: false,
  autofetchResult: null,
  mccResult: null,
  copyFromVenueId: '',
  providerCosts: { ...EMPTY_RATES },
  providerCostsAutoCalculated: false,
  settlement: { ...DEFAULT_SETTLEMENT },
  venuePricing: { ...EMPTY_RATES },
  venuePricingAutoCalculated: false,
}

const RATE_FIELDS: { key: keyof Pick<RateData, 'debitRate' | 'creditRate' | 'amexRate' | 'internationalRate'>; label: string; color: string; bgColor: string }[] = [
  { key: 'debitRate', label: 'Débito', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  { key: 'creditRate', label: 'Crédito', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/20' },
  { key: 'amexRate', label: 'AMEX', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/20' },
  { key: 'internationalRate', label: 'Internacional', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/20' },
]

const SETTLEMENT_CARD_TYPES: { key: keyof Pick<SettlementData, 'debitDays' | 'creditDays' | 'amexDays' | 'internationalDays' | 'otherDays'>; label: string; color: string; bgColor: string }[] = [
  { key: 'debitDays', label: 'Débito', color: 'text-blue-600', bgColor: 'bg-blue-50 dark:bg-blue-950/20' },
  { key: 'creditDays', label: 'Crédito', color: 'text-green-600', bgColor: 'bg-green-50 dark:bg-green-950/20' },
  { key: 'amexDays', label: 'AMEX', color: 'text-purple-600', bgColor: 'bg-purple-50 dark:bg-purple-950/20' },
  { key: 'internationalDays', label: 'Internacional', color: 'text-orange-600', bgColor: 'bg-orange-50 dark:bg-orange-950/20' },
  { key: 'otherDays', label: 'Otro', color: 'text-muted-foreground', bgColor: 'bg-muted/50' },
]

// ══════════════════════════════════════════════════════════════════════
// Wizard steps config
// ══════════════════════════════════════════════════════════════════════

const STEPS = [
  { id: 'org', label: 'Organización', icon: Building2 },
  { id: 'business', label: 'Negocio', icon: Store },
  { id: 'location', label: 'Ubicación', icon: MapPin },
  { id: 'payments', label: 'Cobros', icon: CreditCard },
  { id: 'review', label: 'Resumen', icon: CheckCircle2 },
] as const

type StepId = (typeof STEPS)[number]['id']

// ══════════════════════════════════════════════════════════════════════
// Props
// ══════════════════════════════════════════════════════════════════════

interface CreateVenueWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ══════════════════════════════════════════════════════════════════════
// Main Component
// ══════════════════════════════════════════════════════════════════════

const CreateVenueWizard: React.FC<CreateVenueWizardProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState(0)
  const [form, setForm] = useState<VenueFormData>(INITIAL_FORM)
  const [merchant, setMerchant] = useState<MerchantData>(INITIAL_MERCHANT)
  const [autofetchLoading, setAutofetchLoading] = useState(false)
  const [copyLoading, setCopyLoading] = useState(false)
  const [copiedFromVenueName, setCopiedFromVenueName] = useState('')
  const [orgSearch, setOrgSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

  // ── Queries ──

  const { data: organizations = [] } = useQuery<OrganizationSimple[]>({
    queryKey: ['superadmin-organizations-list'],
    queryFn: getOrganizationsList,
    enabled: open,
  })

  const { data: allVenues = [] } = useQuery({
    queryKey: ['superadmin-venues'],
    queryFn: () => superadminAPI.getAllVenues(),
    enabled: open && merchant.enabled,
  })

  const selectedOrg = useMemo(
    () => organizations.find(o => o.id === form.organizationId),
    [organizations, form.organizationId],
  )

  const filteredOrgs = useMemo(() => {
    if (!orgSearch) return organizations
    return organizations.filter(o => o.name.toLowerCase().includes(orgSearch.toLowerCase()))
  }, [organizations, orgSearch])

  const selectedBusinessLabel = useMemo(
    () => BUSINESS_CATEGORIES.flatMap(c => c.types).find(t => t.value === form.type)?.label,
    [form.type],
  )

  // ── Mutation ──

  const createMutation = useMutation({
    mutationFn: async (data: { form: VenueFormData; merchant: MerchantData }) => {
      const venueResponse = await superadminAPI.bulkCreateVenues({
        organizationId: data.form.organizationId,
        venues: [
          {
            name: data.form.name,
            type: data.form.type,
            phone: data.form.phone,
            address: data.form.address,
            city: data.form.city,
            state: data.form.state,
            country: data.form.country,
            zipCode: data.form.zipCode,
            latitude: data.form.latitude,
            longitude: data.form.longitude,
            timezone: data.form.timezone || undefined,
          },
        ],
      })

      if (venueResponse.summary.venuesCreated === 0) {
        throw new Error(venueResponse.errors?.[0]?.error || 'Error al crear venue')
      }

      const venueId = venueResponse.venues[0].venueId

      if (data.merchant.enabled && data.merchant.mode === 'new' && data.merchant.autofetchResult) {
        const setupPayload: FullSetupRequest = {
          serialNumber: data.merchant.serialNumber,
          brand: data.merchant.brand,
          model: data.merchant.model,
          displayName: data.merchant.displayName || undefined,
          environment: data.merchant.environment,
          businessCategory: data.form.type,
          target: { type: 'venue', id: venueId },
          accountSlot: 'PRIMARY',
          costStructureOverrides: {
            debitRate: data.merchant.providerCosts.debitRate / 100,
            creditRate: data.merchant.providerCosts.creditRate / 100,
            amexRate: data.merchant.providerCosts.amexRate / 100,
            internationalRate: data.merchant.providerCosts.internationalRate / 100,
            fixedCostPerTransaction: data.merchant.providerCosts.fixedCost,
            monthlyFee: data.merchant.providerCosts.monthlyFee,
          },
          venuePricing: {
            debitRate: data.merchant.venuePricing.debitRate / 100,
            creditRate: data.merchant.venuePricing.creditRate / 100,
            amexRate: data.merchant.venuePricing.amexRate / 100,
            internationalRate: data.merchant.venuePricing.internationalRate / 100,
            fixedFeePerTransaction: data.merchant.venuePricing.fixedCost,
            monthlyServiceFee: data.merchant.venuePricing.monthlyFee,
          },
          settlementConfig: {
            dayType: data.merchant.settlement.dayType,
            cutoffTime: data.merchant.settlement.cutoffTime,
            cutoffTimezone: data.merchant.settlement.cutoffTimezone,
            debitDays: data.merchant.settlement.debitDays,
            creditDays: data.merchant.settlement.creditDays,
            amexDays: data.merchant.settlement.amexDays,
            internationalDays: data.merchant.settlement.internationalDays,
            otherDays: data.merchant.settlement.otherDays,
          },
        }
        await paymentProviderAPI.fullSetupBlumonMerchant(setupPayload)
      }

      return { venueId, venueName: data.form.name }
    },
    onSuccess: ({ venueName }) => {
      toast({
        title: 'Venue creado',
        description: `${venueName} ha sido creado exitosamente${merchant.enabled && merchant.mode === 'new' ? ' con cuenta de cobro configurada' : ''}.`,
      })
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations-list'] })
      handleClose()
    },
    onError: (error: any) => {
      toast({
        title: 'Error al crear venue',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // ── Handlers ──

  const handleClose = useCallback(() => {
    setForm(INITIAL_FORM)
    setMerchant(INITIAL_MERCHANT)
    setCurrentStep(0)
    setOrgSearch('')
    setSelectedCategory(null)
    setCopiedFromVenueName('')
    onOpenChange(false)
  }, [onOpenChange])

  const updateField = useCallback(<K extends keyof VenueFormData>(field: K, value: VenueFormData[K]) => {
    setForm(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleAddressSelect = useCallback(
    (place: {
      address: string
      city: string
      state: string
      country: string
      zipCode: string
      latitude: number
      longitude: number
      timezone?: string
    }) => {
      setForm(prev => ({
        ...prev,
        address: place.address,
        city: place.city,
        state: place.state,
        country: place.country,
        zipCode: place.zipCode,
        latitude: place.latitude,
        longitude: place.longitude,
        timezone: place.timezone || prev.timezone,
      }))
    },
    [],
  )

  const handleAutofetch = useCallback(async () => {
    setAutofetchLoading(true)
    try {
      const result = await paymentProviderAPI.autoFetchBlumonCredentials({
        serialNumber: merchant.serialNumber,
        brand: merchant.brand,
        model: merchant.model,
        displayName: merchant.displayName || form.name,
        environment: merchant.environment,
        businessCategory: form.type,
        skipCostStructure: true,
      })

      setMerchant(prev => ({
        ...prev,
        autofetchDone: true,
        autofetchResult: {
          id: result.id,
          posId: result.posId,
          dukptKeysAvailable: result.dukptKeysAvailable,
        },
        mccResult: result.mccLookup ?? null,
      }))

      if (result.mccLookup?.found && result.mccLookup.rates) {
        const r = result.mccLookup.rates
        setMerchant(prev => ({
          ...prev,
          providerCosts: {
            ...prev.providerCosts,
            debitRate: Math.round(r.debito * 10000) / 10000,
            creditRate: Math.round(r.credito * 10000) / 10000,
            amexRate: Math.round(r.amex * 10000) / 10000,
            internationalRate: Math.round(r.internacional * 10000) / 10000,
          },
          providerCostsAutoCalculated: true,
          venuePricing: {
            ...prev.venuePricing,
            debitRate: Math.round(r.debito * 1.2 * 10000) / 10000,
            creditRate: Math.round(r.credito * 1.2 * 10000) / 10000,
            amexRate: Math.round(r.amex * 1.2 * 10000) / 10000,
            internationalRate: Math.round(r.internacional * 1.2 * 10000) / 10000,
          },
          venuePricingAutoCalculated: true,
        }))
      }

      if (form.timezone) {
        setMerchant(prev => ({
          ...prev,
          settlement: { ...prev.settlement, cutoffTimezone: form.timezone },
        }))
      }

      toast({ title: 'Auto-Fetch exitoso', description: `Terminal ${result.posId} configurada.` })
    } catch (error: any) {
      toast({
        title: 'Error en Auto-Fetch',
        description: error?.response?.data?.message || error.message,
        variant: 'destructive',
      })
    } finally {
      setAutofetchLoading(false)
    }
  }, [merchant, form.name, form.type, form.timezone, toast])

  const handleCopyFromVenue = useCallback(
    async (venueId: string, venueName: string) => {
      setCopyLoading(true)
      setCopiedFromVenueName(venueName)
      try {
        const config = await paymentProviderAPI.getVenuePaymentConfig(venueId)
        if (config?.primaryAccountId) {
          const costs = await paymentProviderAPI.getProviderCostStructures({
            merchantAccountId: config.primaryAccountId,
            active: true,
          })
          if (costs.length > 0) {
            const c = costs[0]
            setMerchant(prev => ({
              ...prev,
              providerCosts: {
                debitRate: Math.round(Number(c.debitRate) * 100 * 10000) / 10000,
                creditRate: Math.round(Number(c.creditRate) * 100 * 10000) / 10000,
                amexRate: Math.round(Number(c.amexRate) * 100 * 10000) / 10000,
                internationalRate: Math.round(Number(c.internationalRate) * 100 * 10000) / 10000,
                fixedCost: Number(c.fixedCostPerTransaction || 0),
                monthlyFee: Number(c.monthlyFee || 0),
              },
              providerCostsAutoCalculated: false,
            }))
          }
          const pricing = await paymentProviderAPI.getVenuePricingStructures({
            venueId,
            accountType: 'PRIMARY',
            active: true,
          })
          if (pricing.length > 0) {
            const p = pricing[0]
            setMerchant(prev => ({
              ...prev,
              venuePricing: {
                debitRate: Math.round(Number(p.debitRate) * 100 * 10000) / 10000,
                creditRate: Math.round(Number(p.creditRate) * 100 * 10000) / 10000,
                amexRate: Math.round(Number(p.amexRate) * 100 * 10000) / 10000,
                internationalRate: Math.round(Number(p.internationalRate) * 100 * 10000) / 10000,
                fixedCost: Number(p.fixedFeePerTransaction || 0),
                monthlyFee: Number(p.monthlyServiceFee || 0),
              },
              venuePricingAutoCalculated: false,
            }))
          }
          try {
            const { getSettlementConfigurations } = await import('@/services/settlementConfiguration.service')
            const settlements = await getSettlementConfigurations({ merchantAccountId: config.primaryAccountId })
            if (settlements.length > 0) {
              const base = settlements[0]
              const byType: Partial<Record<string, number>> = {}
              settlements.forEach(s => { byType[s.cardType] = s.settlementDays })
              setMerchant(prev => ({
                ...prev,
                settlement: {
                  ...prev.settlement,
                  dayType: base.settlementDayType,
                  cutoffTime: base.cutoffTime,
                  cutoffTimezone: base.cutoffTimezone,
                  debitDays: byType.DEBIT ?? prev.settlement.debitDays,
                  creditDays: byType.CREDIT ?? prev.settlement.creditDays,
                  amexDays: byType.AMEX ?? prev.settlement.amexDays,
                  internationalDays: byType.INTERNATIONAL ?? prev.settlement.internationalDays,
                  otherDays: byType.OTHER ?? prev.settlement.otherDays,
                },
              }))
            }
          } catch { /* settlement copy optional */ }
        }
        toast({ title: 'Configuración copiada', description: 'Costos, tarifas y plazos pre-llenados.' })
      } catch {
        setCopiedFromVenueName('')
        toast({ title: 'Error', description: 'No se pudo obtener la configuración.', variant: 'destructive' })
      } finally {
        setCopyLoading(false)
      }
    },
    [toast],
  )

  const handleRateChange = useCallback((target: 'providerCosts' | 'venuePricing', field: keyof RateData, value: string) => {
    const numValue = value === '' ? 0 : parseFloat(value)
    if (isNaN(numValue)) return
    const rounded = Math.round(numValue * 10000) / 10000
    setMerchant(prev => ({
      ...prev,
      [target]: { ...prev[target], [field]: rounded },
      ...(target === 'providerCosts' ? { providerCostsAutoCalculated: false } : { venuePricingAutoCalculated: false }),
    }))
  }, [])

  const handleSettlementChange = useCallback(<K extends keyof SettlementData>(field: K, value: SettlementData[K]) => {
    setMerchant(prev => ({
      ...prev,
      settlement: { ...prev.settlement, [field]: value },
    }))
  }, [])

  // ── Step validation ──

  const stepValid = useMemo(() => {
    switch (currentStep) {
      case 0: return !!form.organizationId
      case 1: return !!form.type && !!form.name.trim()
      case 2: return !!form.address.trim()
      case 3: {
        if (!merchant.enabled) return true
        if (merchant.mode === 'new') return merchant.autofetchDone && merchant.providerCosts.debitRate > 0 && merchant.venuePricing.debitRate > 0
        if (merchant.mode === 'copy') return merchant.copyFromVenueId !== '' && merchant.providerCosts.debitRate > 0
        return false
      }
      case 4: return true
      default: return false
    }
  }, [currentStep, form, merchant])

  const getMargin = useCallback(
    (field: keyof Pick<RateData, 'debitRate' | 'creditRate' | 'amexRate' | 'internationalRate'>) => {
      return (merchant.venuePricing[field] || 0) - (merchant.providerCosts[field] || 0)
    },
    [merchant.venuePricing, merchant.providerCosts],
  )

  const getMarginColor = (margin: number) => {
    if (margin >= 0.3) return 'text-green-600'
    if (margin >= 0.1) return 'text-amber-600'
    return 'text-red-600'
  }

  const handleNext = useCallback(() => {
    if (currentStep < STEPS.length - 1) setCurrentStep(prev => prev + 1)
  }, [currentStep])

  const handleBack = useCallback(() => {
    if (currentStep > 0) setCurrentStep(prev => prev - 1)
  }, [currentStep])

  const handleSave = useCallback(() => {
    createMutation.mutate({ form, merchant })
  }, [form, merchant, createMutation])

  // ── Render ──

  const stepTitle = STEPS[currentStep].label
  const isLastStep = currentStep === STEPS.length - 1

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title="Crear Venue"
      subtitle={`Paso ${currentStep + 1} de ${STEPS.length} — ${stepTitle}`}
      contentClassName="bg-muted/30"
    >
      <div className="flex flex-col h-full">
        {/* ═══ Step Indicator ═══ */}
        <div className="border-b border-border/50 bg-card/50 backdrop-blur-sm">
          <div className="mx-auto max-w-3xl px-6 py-4">
            <div className="flex items-center justify-between">
              {STEPS.map((step, i) => {
                const Icon = step.icon
                const isActive = i === currentStep
                const isDone = i < currentStep
                return (
                  <React.Fragment key={step.id}>
                    {i > 0 && (
                      <div className="flex-1 mx-2">
                        <div className={cn(
                          'h-0.5 rounded-full transition-colors duration-500',
                          isDone ? 'bg-primary' : 'bg-border',
                        )} />
                      </div>
                    )}
                    <button
                      onClick={() => i < currentStep && setCurrentStep(i)}
                      disabled={i > currentStep}
                      className={cn(
                        'flex flex-col items-center gap-1.5 group transition-all',
                        i <= currentStep ? 'cursor-pointer' : 'cursor-default opacity-40',
                      )}
                    >
                      <div className={cn(
                        'w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300',
                        isActive && 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 scale-110',
                        isDone && 'bg-primary/15 text-primary',
                        !isActive && !isDone && 'bg-muted text-muted-foreground',
                      )}>
                        {isDone ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                      </div>
                      <span className={cn(
                        'text-[11px] font-medium transition-colors hidden sm:block',
                        isActive ? 'text-foreground' : 'text-muted-foreground',
                      )}>
                        {step.label}
                      </span>
                    </button>
                  </React.Fragment>
                )
              })}
            </div>
          </div>
        </div>

        {/* ═══ Step Content ═══ */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-2xl px-6 py-8">
            {currentStep === 0 && (
              <StepOrganization
                organizations={filteredOrgs}
                selectedId={form.organizationId}
                onSelect={(id) => updateField('organizationId', id)}
                search={orgSearch}
                onSearchChange={setOrgSearch}
                showSearch={organizations.length > 6}
              />
            )}

            {currentStep === 1 && (
              <StepBusiness
                form={form}
                updateField={updateField}
                selectedCategory={selectedCategory}
                onCategoryChange={setSelectedCategory}
                selectedBusinessLabel={selectedBusinessLabel}
              />
            )}

            {currentStep === 2 && (
              <StepLocation
                form={form}
                onAddressSelect={handleAddressSelect}
              />
            )}

            {currentStep === 3 && (
              <StepPayments
                form={form}
                merchant={merchant}
                setMerchant={setMerchant}
                allVenues={allVenues}
                handleAutofetch={handleAutofetch}
                autofetchLoading={autofetchLoading}
                handleCopyFromVenue={handleCopyFromVenue}
                copyLoading={copyLoading}
                copiedFromVenueName={copiedFromVenueName}
                handleRateChange={handleRateChange}
                handleSettlementChange={handleSettlementChange}
                getMargin={getMargin}
                getMarginColor={getMarginColor}
              />
            )}

            {currentStep === 4 && (
              <StepReview
                form={form}
                merchant={merchant}
                selectedOrg={selectedOrg}
                selectedBusinessLabel={selectedBusinessLabel}
                copiedFromVenueName={copiedFromVenueName}
              />
            )}
          </div>
        </div>

        {/* ═══ Bottom Navigation ═══ */}
        <div className="border-t border-border/50 bg-card/80 backdrop-blur-sm">
          <div className="mx-auto max-w-2xl px-6 py-4 flex items-center justify-between">
            <Button
              variant="ghost"
              onClick={handleBack}
              disabled={currentStep === 0}
              className="gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              Anterior
            </Button>

            <div className="flex items-center gap-1.5">
              {STEPS.map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    'rounded-full transition-all duration-300',
                    i === currentStep ? 'w-6 h-1.5 bg-primary' : i < currentStep ? 'w-1.5 h-1.5 bg-primary/50' : 'w-1.5 h-1.5 bg-border',
                  )}
                />
              ))}
            </div>

            {isLastStep ? (
              <Button
                onClick={handleSave}
                disabled={createMutation.isPending}
                className="gap-2 cursor-pointer"
              >
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    Crear Venue
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleNext}
                disabled={!stepValid}
                className="gap-2 cursor-pointer"
              >
                Siguiente
                <ArrowRight className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </FullScreenModal>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Step 1: Organization
// ══════════════════════════════════════════════════════════════════════

function StepOrganization({
  organizations,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  showSearch,
}: {
  organizations: OrganizationSimple[]
  selectedId: string
  onSelect: (id: string) => void
  search: string
  onSearchChange: (s: string) => void
  showSearch: boolean
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Selecciona la organización</h2>
        <p className="text-muted-foreground mt-1">¿A qué organización pertenecerá este venue?</p>
      </div>

      {showSearch && (
        <Input
          placeholder="Buscar organización..."
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          className="h-11 cursor-text"
        />
      )}

      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {organizations.map(org => (
          <button
            key={org.id}
            onClick={() => onSelect(org.id)}
            className={cn(
              'w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all cursor-pointer',
              selectedId === org.id
                ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                : 'border-border/50 hover:border-foreground/20 hover:bg-muted/30',
            )}
          >
            <div className={cn(
              'flex items-center justify-center w-11 h-11 rounded-xl shrink-0',
              selectedId === org.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
            )}>
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm">{org.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {org.venueCount} venue{org.venueCount !== 1 ? 's' : ''}
              </p>
            </div>
            {selectedId === org.id && (
              <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
            )}
          </button>
        ))}
        {organizations.length === 0 && (
          <p className="text-center py-8 text-sm text-muted-foreground">No se encontraron organizaciones</p>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Step 2: Business Type + Name
// ══════════════════════════════════════════════════════════════════════

function StepBusiness({
  form,
  updateField,
  selectedCategory,
  onCategoryChange,
  selectedBusinessLabel,
}: {
  form: VenueFormData
  updateField: <K extends keyof VenueFormData>(field: K, value: VenueFormData[K]) => void
  selectedCategory: string | null
  onCategoryChange: (cat: string | null) => void
  selectedBusinessLabel?: string
}) {
  // Auto-select category when type is already set
  const effectiveCategory = selectedCategory ?? BUSINESS_CATEGORIES.find(c => c.types.some(t => t.value === form.type))?.key ?? null
  const activeCategory = BUSINESS_CATEGORIES.find(c => c.key === effectiveCategory)

  return (
    <div className="space-y-8">
      {/* Name + Phone */}
      <div className="space-y-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Detalles del venue</h2>
          <p className="text-muted-foreground mt-1">Nombre, teléfono y tipo de negocio.</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="venue-name" className="text-sm font-medium">
            Nombre del venue <span className="text-destructive">*</span>
          </Label>
          <Input
            id="venue-name"
            placeholder="Ej: Restaurante La Parroquia"
            value={form.name}
            onChange={(e) => updateField('name', e.target.value)}
            className="h-12 text-base"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="venue-phone" className="text-sm font-medium">Teléfono</Label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              id="venue-phone"
              placeholder="Ej: +52 55 1234 5678"
              value={form.phone}
              onChange={(e) => updateField('phone', e.target.value)}
              className="h-12 text-base pl-10"
            />
          </div>
        </div>
      </div>

      {/* Business Type */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-sm font-medium">
            Tipo de negocio <span className="text-destructive">*</span>
          </Label>
          {form.type && selectedBusinessLabel && (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium">
              <Store className="w-3 h-3" />
              {selectedBusinessLabel}
              <button
                onClick={() => { updateField('type', ''); onCategoryChange(null) }}
                className="ml-0.5 hover:text-primary/70 cursor-pointer"
              >
                ×
              </button>
            </div>
          )}
        </div>

        {/* Category selector — horizontal tabs */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {BUSINESS_CATEGORIES.map(cat => {
            const isActive = effectiveCategory === cat.key
            const icon = CATEGORY_ICONS[cat.key]
            return (
              <button
                key={cat.key}
                onClick={() => onCategoryChange(isActive ? null : cat.key)}
                className={cn(
                  'flex flex-col items-center gap-2 p-3 rounded-xl border transition-all cursor-pointer',
                  isActive
                    ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                    : 'border-border/50 hover:border-foreground/20 hover:bg-muted/30',
                )}
              >
                <div className={cn(
                  'w-9 h-9 rounded-lg flex items-center justify-center',
                  isActive ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
                )}>
                  {icon}
                </div>
                <span className={cn(
                  'text-[11px] font-medium leading-tight text-center',
                  isActive ? 'text-foreground' : 'text-muted-foreground',
                )}>
                  {cat.label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Type grid — shown when category is selected */}
        {activeCategory && (
          <div className="rounded-xl border border-input bg-card p-2">
            <div className="grid grid-cols-2 gap-1.5">
              {activeCategory.types.map(type => (
                <button
                  key={type.value}
                  onClick={() => updateField('type', type.value)}
                  className={cn(
                    'text-left px-4 py-3 rounded-lg text-sm font-medium transition-all cursor-pointer',
                    form.type === type.value
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted/50 text-foreground/80',
                  )}
                >
                  {type.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Step 3: Location
// ══════════════════════════════════════════════════════════════════════

function StepLocation({
  form,
  onAddressSelect,
}: {
  form: VenueFormData
  onAddressSelect: (place: {
    address: string; city: string; state: string; country: string
    zipCode: string; latitude: number; longitude: number; timezone?: string
  }) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Ubicación</h2>
        <p className="text-muted-foreground mt-1">Busca la dirección para autocompletar la ubicación y zona horaria.</p>
      </div>

      <div className="space-y-2">
        <Label className="text-sm font-medium">
          Dirección <span className="text-destructive">*</span>
        </Label>
        <AddressAutocomplete
          value={form.address}
          onAddressSelect={onAddressSelect}
          placeholder="Busca una dirección..."
          countries={['mx', 'us', 'es', 'co', 'ar', 'cl', 'pe']}
          className="h-12"
        />
      </div>

      {form.address && (form.city || form.state) && (
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-5 space-y-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-primary">Ubicación detectada</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {form.city && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Ciudad</p>
                <p className="text-sm font-semibold mt-0.5">{form.city}</p>
              </div>
            )}
            {form.state && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Estado</p>
                <p className="text-sm font-semibold mt-0.5">{form.state}</p>
              </div>
            )}
            {form.country && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">País</p>
                <p className="text-sm font-semibold mt-0.5">{form.country}</p>
              </div>
            )}
            {form.zipCode && (
              <div>
                <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">C.P.</p>
                <p className="text-sm font-semibold mt-0.5">{form.zipCode}</p>
              </div>
            )}
          </div>
          {form.timezone && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-primary/10">
              <span className="font-medium">Zona horaria:</span> {form.timezone}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Step 4: Payments
// ══════════════════════════════════════════════════════════════════════

function StepPayments({
  form,
  merchant,
  setMerchant,
  allVenues,
  handleAutofetch,
  autofetchLoading,
  handleCopyFromVenue,
  copyLoading,
  copiedFromVenueName,
  handleRateChange,
  handleSettlementChange,
  getMargin,
  getMarginColor,
}: {
  form: VenueFormData
  merchant: MerchantData
  setMerchant: React.Dispatch<React.SetStateAction<MerchantData>>
  allVenues: Array<{ id: string; name: string }>
  handleAutofetch: () => Promise<void>
  autofetchLoading: boolean
  handleCopyFromVenue: (venueId: string, name: string) => Promise<void>
  copyLoading: boolean
  copiedFromVenueName: string
  handleRateChange: (target: 'providerCosts' | 'venuePricing', field: keyof RateData, value: string) => void
  handleSettlementChange: <K extends keyof SettlementData>(field: K, value: SettlementData[K]) => void
  getMargin: (field: keyof Pick<RateData, 'debitRate' | 'creditRate' | 'amexRate' | 'internationalRate'>) => number
  getMarginColor: (margin: number) => string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Cuenta de cobro</h2>
        <p className="text-muted-foreground mt-1">Configura la terminal y tarifas de pago. Puedes hacerlo después.</p>
      </div>

      {/* Toggle */}
      <div className="flex items-center justify-between p-4 rounded-xl border border-input bg-card">
        <div>
          <span className="text-sm font-semibold">Configurar cuenta de pagos</span>
          <p className="text-xs text-muted-foreground mt-0.5">
            {merchant.enabled ? 'Se creará con cuenta de cobro' : 'Puedes configurarlo después'}
          </p>
        </div>
        <Switch
          checked={merchant.enabled}
          onCheckedChange={(val) => setMerchant(prev => ({ ...prev, enabled: val, mode: val ? 'new' : null }))}
          className="cursor-pointer"
        />
      </div>

      {merchant.enabled && (
        <div className="space-y-6">
          {/* Mode selector */}
          <div className="flex rounded-lg border border-input bg-muted/50 p-1">
            <button
              type="button"
              onClick={() => setMerchant(prev => ({ ...prev, mode: 'new' }))}
              className={cn(
                'flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
                merchant.mode === 'new' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Nueva cuenta
            </button>
            <button
              type="button"
              onClick={() => setMerchant(prev => ({ ...prev, mode: 'copy' }))}
              className={cn(
                'flex-1 rounded-md px-4 py-2.5 text-sm font-medium transition-colors cursor-pointer',
                merchant.mode === 'copy' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Copiar de otro venue
            </button>
          </div>

          {/* Copy mode */}
          {merchant.mode === 'copy' && (
            <div className="space-y-4">
              <div className="rounded-xl border border-input bg-card p-4 space-y-3">
                <Label className="text-sm font-medium">Copiar configuración de:</Label>
                <Select
                  value={merchant.copyFromVenueId}
                  onValueChange={(venueId) => {
                    const venue = allVenues.find(v => v.id === venueId)
                    setMerchant(prev => ({ ...prev, copyFromVenueId: venueId }))
                    handleCopyFromVenue(venueId, venue?.name || '')
                  }}
                >
                  <SelectTrigger className="h-12 text-base cursor-pointer">
                    <SelectValue placeholder="Selecciona un venue..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allVenues.map(v => (
                      <SelectItem key={v.id} value={v.id} className="cursor-pointer">
                        {v.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {copyLoading && (
                <div className="flex items-center justify-center gap-2 p-8 rounded-xl border border-input bg-card">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Obteniendo configuración de {copiedFromVenueName}...</span>
                </div>
              )}

              {!copyLoading && merchant.copyFromVenueId && copiedFromVenueName && (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-3 rounded-xl border border-blue-500/30 bg-blue-500/5">
                    <Copy className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-blue-600">Copiado de: {copiedFromVenueName}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">Puedes modificar cualquier valor.</p>
                    </div>
                  </div>

                  <RatesSection
                    title="Costos del procesador"
                    rates={merchant.providerCosts}
                    onRateChange={(field, value) => handleRateChange('providerCosts', field, value)}
                  />
                  <SettlementSection
                    settlement={merchant.settlement}
                    onChange={handleSettlementChange}
                  />
                  <VenuePricingSection
                    providerCosts={merchant.providerCosts}
                    venuePricing={merchant.venuePricing}
                    autoCalculated={merchant.venuePricingAutoCalculated}
                    onRateChange={(field, value) => handleRateChange('venuePricing', field, value)}
                    getMargin={getMargin}
                    getMarginColor={getMarginColor}
                  />
                </div>
              )}
            </div>
          )}

          {/* New account mode */}
          {merchant.mode === 'new' && (
            <div className="space-y-6">
              {/* Provider badge */}
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/5 border border-primary/20 w-fit">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-primary">Blumon</span>
              </div>

              {/* Terminal fields */}
              <div className="rounded-xl border border-input bg-card p-5 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">Número de serie <span className="text-destructive">*</span></Label>
                  <Input
                    placeholder="Ej: 0821142850"
                    value={merchant.serialNumber}
                    onChange={(e) => setMerchant(prev => ({ ...prev, serialNumber: e.target.value }))}
                    className="h-12 text-base font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Marca</Label>
                    <Select value={merchant.brand} onValueChange={(v) => setMerchant(prev => ({ ...prev, brand: v }))}>
                      <SelectTrigger className="h-12 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="PAX" className="cursor-pointer">PAX</SelectItem>
                        <SelectItem value="INGENICO" className="cursor-pointer">Ingenico</SelectItem>
                        <SelectItem value="VERIFONE" className="cursor-pointer">Verifone</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Modelo</Label>
                    <Select value={merchant.model} onValueChange={(v) => setMerchant(prev => ({ ...prev, model: v }))}>
                      <SelectTrigger className="h-12 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A910S" className="cursor-pointer">A910S</SelectItem>
                        <SelectItem value="A920" className="cursor-pointer">A920</SelectItem>
                        <SelectItem value="A77" className="cursor-pointer">A77</SelectItem>
                        <SelectItem value="D210" className="cursor-pointer">D210</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Nombre de cuenta</Label>
                    <Input
                      placeholder={form.name || 'Terminal principal'}
                      value={merchant.displayName}
                      onChange={(e) => setMerchant(prev => ({ ...prev, displayName: e.target.value }))}
                      className="h-12"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">Ambiente</Label>
                    <Select
                      value={merchant.environment}
                      onValueChange={(v: 'SANDBOX' | 'PRODUCTION') => setMerchant(prev => ({ ...prev, environment: v }))}
                    >
                      <SelectTrigger className="h-12 cursor-pointer"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SANDBOX" className="cursor-pointer">Sandbox</SelectItem>
                        <SelectItem value="PRODUCTION" className="cursor-pointer">Producción</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {merchant.autofetchDone && merchant.autofetchResult && (
                  <div className="flex items-center gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                    <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    <span className="text-sm font-medium text-green-600">Auto-Fetch completado</span>
                    <span className="text-xs text-muted-foreground ml-1">POS: {merchant.autofetchResult.posId}</span>
                  </div>
                )}

                <Button
                  onClick={handleAutofetch}
                  disabled={merchant.serialNumber.trim().length < 4 || autofetchLoading}
                  className="w-full h-12 cursor-pointer gap-2 text-base"
                >
                  {autofetchLoading ? (
                    <><Loader2 className="w-5 h-5 animate-spin" />Obteniendo credenciales...</>
                  ) : merchant.autofetchDone ? (
                    <><CheckCircle2 className="w-5 h-5" />Re-ejecutar Auto-Fetch</>
                  ) : (
                    <><Zap className="w-5 h-5" />Ejecutar Auto-Fetch</>
                  )}
                </Button>
              </div>

              {/* Costs, Settlement, Pricing — after autofetch */}
              {merchant.autofetchDone && (
                <div className="space-y-6">
                  {merchant.providerCostsAutoCalculated && merchant.mccResult?.found && (
                    <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
                      <Calculator className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                      <p className="text-xs text-green-600">
                        Calculado automáticamente (MCC: {merchant.mccResult.mcc}, confianza: {Math.round((merchant.mccResult.confidence ?? 0) * 100)}%)
                      </p>
                    </div>
                  )}

                  <RatesSection
                    title="Costos del procesador"
                    rates={merchant.providerCosts}
                    onRateChange={(field, value) => handleRateChange('providerCosts', field, value)}
                  />
                  <SettlementSection
                    settlement={merchant.settlement}
                    onChange={handleSettlementChange}
                  />
                  <VenuePricingSection
                    providerCosts={merchant.providerCosts}
                    venuePricing={merchant.venuePricing}
                    autoCalculated={merchant.venuePricingAutoCalculated}
                    onRateChange={(field, value) => handleRateChange('venuePricing', field, value)}
                    getMargin={getMargin}
                    getMarginColor={getMarginColor}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Shared: Rates Section ──

function RatesSection({
  title,
  rates,
  onRateChange,
}: {
  title: string
  rates: RateData
  onRateChange: (field: keyof RateData, value: string) => void
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="rounded-xl border border-input bg-card p-4 space-y-2">
        {RATE_FIELDS.map(field => (
          <div key={field.key} className={cn('flex items-center gap-3 p-2.5 rounded-lg', field.bgColor)}>
            <span className={cn('text-sm font-medium w-24', field.color)}>{field.label}</span>
            <div className="relative flex-1 max-w-[120px]">
              <Input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={rates[field.key] || ''}
                onChange={e => onRateChange(field.key, e.target.value)}
                className="h-9 text-sm pr-6 cursor-text"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        ))}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Cuota fija / txn</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input type="number" step="0.01" min="0" value={rates.fixedCost || ''} onChange={e => onRateChange('fixedCost', e.target.value)} className="h-9 pl-6 text-sm cursor-text" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuota mensual</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input type="number" step="0.01" min="0" value={rates.monthlyFee || ''} onChange={e => onRateChange('monthlyFee', e.target.value)} className="h-9 pl-6 text-sm cursor-text" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Shared: Settlement Section ──

function SettlementSection({
  settlement,
  onChange,
}: {
  settlement: SettlementData
  onChange: <K extends keyof SettlementData>(field: K, value: SettlementData[K]) => void
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Plazos de liquidación</h3>
      <div className="rounded-xl border border-input bg-card p-4 space-y-3">
        <div className="flex rounded-lg border border-input bg-muted/50 p-1">
          {(['BUSINESS_DAYS', 'CALENDAR_DAYS'] as const).map(dt => (
            <button
              key={dt}
              type="button"
              onClick={() => onChange('dayType', dt)}
              className={cn(
                'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer',
                settlement.dayType === dt ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              {dt === 'BUSINESS_DAYS' ? 'Días hábiles' : 'Días calendario'}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          <Label className="text-xs shrink-0">Hora de corte</Label>
          <Input type="time" value={settlement.cutoffTime} onChange={e => onChange('cutoffTime', e.target.value)} className="h-9 text-sm w-32" />
          <span className="text-xs text-muted-foreground">{settlement.cutoffTimezone.replace('America/', '')}</span>
        </div>
        {SETTLEMENT_CARD_TYPES.map(card => (
          <div key={card.key} className={cn('flex items-center gap-3 p-2.5 rounded-lg', card.bgColor)}>
            <span className={cn('text-sm font-medium w-24', card.color)}>{card.label}</span>
            <Input
              type="number" min={1} max={30} value={settlement[card.key]}
              onChange={e => { const v = parseInt(e.target.value); if (!isNaN(v) && v >= 0 && v <= 30) onChange(card.key, v) }}
              className="h-9 w-16 text-center font-bold cursor-text"
            />
            <span className="text-xs text-muted-foreground">{settlement.dayType === 'BUSINESS_DAYS' ? 'háb.' : 'cal.'}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Shared: Venue Pricing Section ──

function VenuePricingSection({
  providerCosts,
  venuePricing,
  autoCalculated,
  onRateChange,
  getMargin,
  getMarginColor,
}: {
  providerCosts: RateData
  venuePricing: RateData
  autoCalculated: boolean
  onRateChange: (field: keyof RateData, value: string) => void
  getMargin: (field: keyof Pick<RateData, 'debitRate' | 'creditRate' | 'amexRate' | 'internationalRate'>) => number
  getMarginColor: (margin: number) => string
}) {
  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold">Tarifas al venue</h3>

      {autoCalculated && (
        <div className="flex items-start gap-2 p-3 rounded-lg border border-green-500/30 bg-green-500/5">
          <Calculator className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
          <p className="text-xs text-green-600">Calculado automáticamente: costo + 20% margen</p>
        </div>
      )}

      <div className="rounded-xl border border-input bg-card p-4 space-y-2">
        <div className="grid grid-cols-4 gap-2 text-xs font-medium text-muted-foreground px-2.5 pb-1">
          <span>Tipo</span><span>Costo</span><span>Tu tarifa</span><span>Margen</span>
        </div>
        {RATE_FIELDS.map(field => {
          const cost = providerCosts[field.key] || 0
          const margin = getMargin(field.key)
          return (
            <div key={field.key} className={cn('grid grid-cols-4 gap-2 items-center p-2.5 rounded-lg', field.bgColor)}>
              <span className={cn('text-sm font-medium', field.color)}>{field.label}</span>
              <span className="text-xs text-muted-foreground">{cost.toFixed(2)}%</span>
              <div className="relative">
                <Input type="number" step="0.01" min="0" max="100" value={venuePricing[field.key] || ''} onChange={e => onRateChange(field.key, e.target.value)} className="h-9 text-sm pr-5 cursor-text" />
                <span className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">%</span>
              </div>
              <span className={cn('text-xs font-medium', getMarginColor(margin))}>
                {margin >= 0 ? '+' : ''}{margin.toFixed(2)}%
              </span>
            </div>
          )
        })}
        <div className="grid grid-cols-2 gap-3 pt-2">
          <div className="space-y-1">
            <Label className="text-xs">Cuota fija / txn</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input type="number" step="0.01" min="0" value={venuePricing.fixedCost || ''} onChange={e => onRateChange('fixedCost', e.target.value)} className="h-9 pl-6 text-sm cursor-text" />
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Cuota mensual</Label>
            <div className="relative">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground text-xs">$</span>
              <Input type="number" step="0.01" min="0" value={venuePricing.monthlyFee || ''} onChange={e => onRateChange('monthlyFee', e.target.value)} className="h-9 pl-6 text-sm cursor-text" />
            </div>
          </div>
        </div>
      </div>

      {/* Profit example */}
      <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
        <div className="flex items-center gap-2 mb-2">
          <Calculator className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium">Ejemplo: transacción de $1,000</span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-card">
            <p className="text-[10px] text-muted-foreground">Cobro</p>
            <p className="text-sm font-bold">${((venuePricing.creditRate || 0) * 10).toFixed(2)}</p>
          </div>
          <div className="p-2 rounded-lg bg-card">
            <p className="text-[10px] text-muted-foreground">Costo</p>
            <p className="text-sm font-bold">${((providerCosts.creditRate || 0) * 10).toFixed(2)}</p>
          </div>
          <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/20">
            <p className="text-[10px] text-muted-foreground">Ganancia</p>
            <p className="text-sm font-bold text-green-600">
              ${(((venuePricing.creditRate || 0) - (providerCosts.creditRate || 0)) * 10).toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════
// Step 5: Review
// ══════════════════════════════════════════════════════════════════════

function StepReview({
  form,
  merchant,
  selectedOrg,
  selectedBusinessLabel,
  copiedFromVenueName,
}: {
  form: VenueFormData
  merchant: MerchantData
  selectedOrg?: OrganizationSimple
  selectedBusinessLabel?: string
  copiedFromVenueName?: string
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Todo listo</h2>
        <p className="text-muted-foreground mt-1">Revisa los datos antes de crear el venue.</p>
      </div>

      {/* Preview card */}
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Header gradient */}
        <div className="h-20 bg-gradient-to-br from-primary/20 via-primary/10 to-transparent flex items-end px-6 pb-4">
          <div className="w-12 h-12 rounded-xl bg-card border border-border shadow-sm flex items-center justify-center -mb-6">
            <Store className="w-6 h-6 text-foreground" />
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pt-8 pb-6 space-y-5">
          <div>
            <h3 className="text-xl font-bold">{form.name}</h3>
            {selectedOrg && <p className="text-sm text-muted-foreground">{selectedOrg.name}</p>}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {/* Business Type */}
            {selectedBusinessLabel && (
              <ReviewRow icon={<Store className="w-4 h-4" />} iconBg="bg-primary/10 text-primary" label="Tipo" value={selectedBusinessLabel} />
            )}

            {/* Address */}
            {form.address && (
              <ReviewRow
                icon={<MapPin className="w-4 h-4" />}
                iconBg="bg-blue-500/10 text-blue-500"
                label="Dirección"
                value={
                  <div>
                    <p className="text-sm">{form.address}</p>
                    {(form.city || form.state) && (
                      <p className="text-xs text-muted-foreground">{[form.city, form.state, form.country].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                }
              />
            )}

            {/* Phone */}
            {form.phone && (
              <ReviewRow icon={<Phone className="w-4 h-4" />} iconBg="bg-green-500/10 text-green-500" label="Teléfono" value={form.phone} />
            )}

            {/* Timezone */}
            {form.timezone && (
              <ReviewRow icon={<Info className="w-4 h-4" />} iconBg="bg-amber-500/10 text-amber-500" label="Zona horaria" value={form.timezone} />
            )}
          </div>

          {/* Payment section */}
          {merchant.enabled && (
            <>
              <hr className="border-border" />
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm font-semibold">Cuenta de cobro</span>
                </div>

                {merchant.mode === 'copy' && merchant.copyFromVenueId && copiedFromVenueName ? (
                  <div className="space-y-1.5 pl-6">
                    <ReviewCheck text={`Copiado de: ${copiedFromVenueName}`} color="text-blue-600" />
                    {merchant.providerCosts.debitRate > 0 && (
                      <ReviewCheck text={`Costos: ${merchant.providerCosts.debitRate.toFixed(2)}% débito`} />
                    )}
                    {merchant.venuePricing.debitRate > 0 && (
                      <ReviewCheck text={`Tarifas: ${merchant.venuePricing.debitRate.toFixed(2)}% débito`} />
                    )}
                    <ReviewCheck text="Falta Auto-Fetch de terminal" color="text-amber-600" icon={<Info className="w-3.5 h-3.5" />} />
                  </div>
                ) : merchant.mode === 'new' && merchant.autofetchDone ? (
                  <div className="space-y-1.5 pl-6">
                    <ReviewCheck text={`Blumon · ${merchant.autofetchResult?.posId}`} />
                    {merchant.providerCosts.debitRate > 0 && <ReviewCheck text="Costos configurados" />}
                    {merchant.venuePricing.debitRate > 0 && <ReviewCheck text="Tarifas configuradas" />}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground pl-6">Pendiente de configuración</p>
                )}
              </div>
            </>
          )}

          {!merchant.enabled && (
            <>
              <hr className="border-border" />
              <div className="flex items-center gap-2 text-muted-foreground">
                <CreditCard className="w-4 h-4" />
                <span className="text-sm">Sin cuenta de cobro (se puede configurar después)</span>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Review helpers ──

function ReviewRow({ icon, iconBg, label, value }: { icon: React.ReactNode; iconBg: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', iconBg)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
        <div className="mt-0.5">{typeof value === 'string' ? <p className="text-sm font-medium">{value}</p> : value}</div>
      </div>
    </div>
  )
}

function ReviewCheck({ text, color = 'text-green-600', icon }: { text: string; color?: string; icon?: React.ReactNode }) {
  return (
    <div className={cn('flex items-center gap-1.5 text-xs', color)}>
      {icon || <CheckCircle2 className="w-3.5 h-3.5" />}
      {text}
    </div>
  )
}

export default CreateVenueWizard
