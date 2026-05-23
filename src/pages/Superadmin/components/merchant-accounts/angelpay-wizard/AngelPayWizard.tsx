import React, { useEffect, useMemo, useReducer, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2, Search, CheckCircle2, AlertTriangle, Building2, CreditCard, Info, Wallet, Plus } from 'lucide-react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { cn, includesNormalized } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { getAllVenues } from '@/services/superadmin.service'
import {
  listAngelPayUserAccountsForVenue,
  fetchAngelPayMerchantsFromTpv,
  type AngelPayUserAccount,
} from '@/services/superadmin-angelpay-user-account.service'
import { getAllTerminals, type Terminal } from '@/services/superadmin-terminals.service'
import { AngelPayCreateTerminalDialog } from '../../angelpay/AngelPayCreateTerminalDialog'
import { AngelPayAccountDetailsDialog } from './AngelPayAccountDetailsDialog'
import { paymentProviderAPI, type FullSetupAngelPayPayload } from '@/services/paymentProvider.service'
import { aggregatorAPI } from '@/services/aggregator.service'
import { merchantRevenueShareAPI } from '@/services/merchantRevenueShare.service'
import { decimalToPercent, percentToDecimal } from './feeTemplate'
import {
  wizardReducer,
  initialState,
  isPricingRequired,
  type AngelPayWizardState,
  type AngelPayAccountType,
} from './wizardReducer'

interface AngelPayWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const STEPS = [
  { key: 'venue', title: 'Venue', optional: false },
  { key: 'login', title: 'Cuenta AngelPay', optional: false },
  { key: 'merchant', title: 'Merchant', optional: false },
  { key: 'slot', title: 'Slot del venue', optional: false },
  { key: 'terminals', title: 'Terminales', optional: true },
  { key: 'cost', title: 'Costo del procesador', optional: true },
  { key: 'pricing', title: 'Precio al venue', optional: true },
  { key: 'settlement', title: 'Liquidación', optional: true },
  { key: 'revenueShare', title: 'Reparto Avoqado/agregador', optional: true },
  { key: 'summary', title: 'Resumen', optional: false },
] as const

const SLOT_FIELD: Record<AngelPayAccountType, 'primaryAccountId' | 'secondaryAccountId' | 'tertiaryAccountId'> = {
  PRIMARY: 'primaryAccountId',
  SECONDARY: 'secondaryAccountId',
  TERTIARY: 'tertiaryAccountId',
}

/** Clearable number input — empty => undefined (project rule). */
function NumberField({
  label,
  value,
  onChange,
  hint,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
  hint?: string
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <Input
        type="number"
        step="0.0001"
        value={value ?? ''}
        onChange={e => {
          const raw = e.target.value
          onChange(raw === '' ? undefined : parseFloat(raw))
        }}
        className="h-10"
      />
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}

/**
 * Percentage rate input. The user types a percentage (1.5 for 1.5%), but the
 * wizard state and the DB keep rates as decimals (0.015). Mirrors the `* 100` /
 * `/ 100` convention already used by ProviderCostStructureDialog elsewhere.
 * Keeps a local text buffer so intermediate states ("1.") aren't snapped away.
 */
function PercentField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (v: number | undefined) => void
}) {
  const [text, setText] = useState<string>(() => (value === undefined ? '' : String(decimalToPercent(value))))
  // Re-sync the buffer when `value` changes from outside (aggregator prefill, step revisit).
  useEffect(() => {
    const fromText = text.trim() === '' ? undefined : percentToDecimal(parseFloat(text))
    const isNan = fromText !== undefined && Number.isNaN(fromText)
    if (fromText !== value && !(isNan && value === undefined)) {
      setText(value === undefined ? '' : String(decimalToPercent(value)))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <div className="space-y-1">
      <Label className="text-xs">{label}</Label>
      <div className="relative">
        <Input
          type="number"
          step="0.01"
          inputMode="decimal"
          value={text}
          onChange={e => {
            const raw = e.target.value
            setText(raw)
            const parsed = parseFloat(raw)
            onChange(raw.trim() === '' || Number.isNaN(parsed) ? undefined : percentToDecimal(parsed))
          }}
          className="h-10 pr-7"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
          %
        </span>
      </div>
    </div>
  )
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-input bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      {children}
    </div>
  )
}

const AngelPayWizard: React.FC<AngelPayWizardProps> = ({ open, onOpenChange }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(wizardReducer, undefined, initialState)
  const [step, setStep] = useState(0)
  const [venueSearch, setVenueSearch] = useState('')
  const [managingAccount, setManagingAccount] = useState<AngelPayUserAccount | null>(null)
  const [tpvFetchState, setTpvFetchState] = useState<'idle' | 'fetching' | 'done' | 'error'>('idle')
  const [tpvFetchMsg, setTpvFetchMsg] = useState('')
  const [slotMovePrompt, setSlotMovePrompt] = useState<AngelPayAccountType | null>(null)
  const [createTerminalOpen, setCreateTerminalOpen] = useState(false)
  // Inline "Crear agregador" — del paso de Costo (paso 6).
  const [createAggOpen, setCreateAggOpen] = useState(false)
  const [newAggName, setNewAggName] = useState('')
  const [newAggIva, setNewAggIva] = useState('16')

  const venueId = state.venue?.id

  // ----- Data -----
  const { data: venues = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['superadmin-venues', 'all'],
    queryFn: () => getAllVenues(true),
    enabled: open,
  })

  const { data: logins = [] } = useQuery({
    queryKey: ['angelpay-logins', venueId],
    queryFn: () => listAngelPayUserAccountsForVenue(venueId as string),
    enabled: !!venueId,
  })

  const { data: terminals = [] } = useQuery({
    queryKey: ['venue-terminals', venueId],
    queryFn: () => getAllTerminals({ venueId: venueId as string }),
    enabled: !!venueId,
  })

  const { data: paymentConfig } = useQuery({
    queryKey: ['venue-payment-config', venueId],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(venueId as string),
    enabled: !!venueId,
  })

  const { data: allMerchants = [] } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: open,
  })

  const { data: aggregators = [] } = useQuery({
    queryKey: ['aggregators', 'active'],
    queryFn: () => aggregatorAPI.getAll({ active: true }),
    enabled: open,
  })

  const activeLogins = useMemo(() => logins.filter(l => l.status === 'ACTIVE' && !l.lastValidationErr), [logins])

  // Merchants already linked to the selected existing login — offered for reuse
  // so the operator can skip re-typing merchant data in step 3.
  const loginMerchants = useMemo(() => {
    if (state.login.mode !== 'existing') return []
    const loginId = state.login.angelpayUserAccountId
    return allMerchants.filter(m => m.angelpayUserAccountId === loginId)
  }, [allMerchants, state.login])

  // A NEXGO terminal that is ACTIVE is considered reachable for live discovery.
  const nexgoTerminal = useMemo(() => terminals.find(t => t.brand === 'NEXGO' && t.status === 'ACTIVE'), [terminals])

  /**
   * Dispatch FETCH_ANGELPAY_MERCHANTS to the venue's NEXGO terminal, then poll
   * the merchant list for ~30s until newly discovered merchants for this login
   * appear. On success they surface in the step-3 picker (loginMerchants).
   */
  const handleTpvFetch = async () => {
    if (state.login.mode !== 'existing' || !venueId) return
    const loginId = state.login.angelpayUserAccountId
    if (!nexgoTerminal) {
      setTpvFetchState('error')
      setTpvFetchMsg('No hay una terminal NEXGO activa en este venue.')
      return
    }
    setTpvFetchState('fetching')
    setTpvFetchMsg('Buscando merchants en la terminal…')
    const before = allMerchants.filter(m => m.angelpayUserAccountId === loginId).length

    // Step 1 — dispatch the command. A failure HERE is a real "couldn't start".
    try {
      await fetchAngelPayMerchantsFromTpv({ venueId, terminalId: nexgoTerminal.id, angelpayUserAccountId: loginId })
    } catch {
      setTpvFetchState('error')
      setTpvFetchMsg('No se pudo iniciar la búsqueda en la terminal.')
      return
    }

    // Step 2 — poll for newly discovered merchants. A transient poll failure
    // (network blip, backend reload mid-poll) is NOT a fetch failure — swallow
    // it and retry on the next tick rather than aborting the whole search.
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 3000))
      try {
        const fresh = await queryClient.fetchQuery({
          queryKey: ['merchant-accounts-all'],
          queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
        })
        const found = fresh.filter(m => m.angelpayUserAccountId === loginId).length
        if (found > before) {
          setTpvFetchState('done')
          setTpvFetchMsg(`Se encontraron ${found - before} merchant(s). Elígelos abajo.`)
          return
        }
      } catch {
        // Transient poll error — ignore, keep polling until the window closes.
      }
    }
    setTpvFetchState('error')
    setTpvFetchMsg('La terminal no reportó merchants nuevos (timeout 30s). Verifica que la TPV esté en línea.')
  }

  /**
   * Called after a NEXGO terminal is created (or activated) inside the wizard.
   * Refreshes the terminal list so the fetch gate + step-5 picker see it, and
   * auto-selects it so the operator doesn't recapture it in the Terminales step.
   */
  const handleTerminalCreated = (terminal: Terminal) => {
    queryClient.invalidateQueries({ queryKey: ['venue-terminals', venueId] })
    queryClient.refetchQueries({ queryKey: ['venue-terminals', venueId] })
    dispatch({
      type: 'SET_TERMINALS',
      terminals: {
        ...state.terminals,
        skipped: false,
        terminalIds: Array.from(new Set([...state.terminals.terminalIds, terminal.id])),
      },
    })
  }

  /**
   * Selecciona un agregador para este merchant (campo `MerchantAccount.aggregatorId`).
   * El revenue-share real se configura por merchant en `MerchantRevenueShare`
   * (Phase A–B). Aquí solo se guarda la asociación; las tasas se capturan a mano
   * en los pasos de Costo y Precio.
   */
  const handleAggregatorPick = (aggregatorId: string | undefined) => {
    dispatch({ type: 'SET_COST', cost: { ...state.cost, aggregatorId } })
  }

  // If the selected existing login was deleted/suspended via the manage sheet,
  // drop the stale selection back to a fresh "new login".
  useEffect(() => {
    if (state.login.mode !== 'existing') return
    const selectedId = state.login.angelpayUserAccountId
    if (!activeLogins.some(l => l.id === selectedId)) {
      dispatch({ type: 'SET_LOGIN', login: { mode: 'new', email: '', pin: '', environment: 'QA' } })
    }
  }, [activeLogins, state.login])

  const filteredVenues = useMemo(() => {
    if (!venueSearch) return venues
    return venues.filter(v => includesNormalized(v.name, venueSearch))
  }, [venues, venueSearch])

  // ----- Inline "Crear agregador" mutation -----
  // Opcional desde el paso de Costo. baseFees = ceros: el revenue-share real se
  // configura por merchant en `MerchantRevenueShare` (no en el agregador). El
  // agregador acá es solo el contenedor con nombre + IVA.
  const createAggMutation = useMutation({
    mutationFn: (input: { name: string; ivaRate: number }) =>
      aggregatorAPI.create({
        name: input.name.trim(),
        baseFees: { DEBIT: 0, CREDIT: 0, AMEX: 0, INTERNATIONAL: 0 },
        ivaRate: input.ivaRate,
      }),
    onSuccess: created => {
      queryClient.invalidateQueries({ queryKey: ['aggregators', 'active'] })
      // Lo seleccionamos inmediato así no hay que volver a abrir el dropdown.
      dispatch({ type: 'SET_COST', cost: { ...state.cost, aggregatorId: created.id } })
      toast({ title: 'Agregador creado', description: created.name })
      setCreateAggOpen(false)
      setNewAggName('')
      setNewAggIva('16')
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo crear el agregador',
        description: err?.response?.data?.message || err?.response?.data?.error || 'Error',
        variant: 'destructive',
      })
    },
  })

  // ----- Mutation -----
  // The main fullSetup endpoint is the atomic transaction. The revenue-share is
  // a follow-up POST that's intentionally NON-atomic: if it fails, the merchant
  // is still created and the operator can configure the split later from the
  // aggregators page or by re-running this step. We surface the failure as a
  // warning toast (not an error) so the operator knows what to do next.
  const mutation = useMutation({
    mutationFn: (payload: FullSetupAngelPayPayload) => paymentProviderAPI.fullSetupAngelPayMerchant(payload),
    onSuccess: async (result) => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })

      // Optional follow-up: persist MerchantRevenueShare if the operator opted in.
      if (!state.revenueShare.skipped) {
        try {
          await merchantRevenueShareAPI.create(buildRevenueSharePayload(result.merchantAccountId))
          toast({ title: 'Éxito', description: 'Cuenta AngelPay configurada y reparto guardado' })
        } catch (rsErr: any) {
          // Non-blocking — the merchant is fine, just the share didn't save.
          toast({
            title: 'Cuenta creada — reparto no guardado',
            description:
              rsErr?.response?.data?.message ||
              'La cuenta quedó OK pero el reparto Avoqado/agregador no se guardó. Configúralo después en /superadmin/aggregators.',
            variant: 'destructive',
          })
        }
      } else {
        toast({ title: 'Éxito', description: 'Cuenta AngelPay configurada exitosamente' })
      }

      handleClose()
    },
    onError: (err: any) => {
      toast({
        title: 'Error',
        description: err?.response?.data?.message || 'No se pudo configurar la cuenta AngelPay',
        variant: 'destructive',
      })
    },
  })

  const handleClose = () => {
    dispatch({ type: 'RESET' })
    setStep(0)
    setVenueSearch('')
    onOpenChange(false)
  }

  /** Patch the "new login" fields, always producing a valid new-login object. */
  const updateNewLogin = (patch: Partial<{ email: string; pin: string; environment: 'QA' | 'PROD' }>) => {
    const cur =
      state.login.mode === 'new'
        ? state.login
        : { mode: 'new' as const, email: '', pin: '', environment: 'QA' as const }
    dispatch({
      type: 'SET_LOGIN',
      login: { mode: 'new', email: cur.email, pin: cur.pin, environment: cur.environment, ...patch },
    })
  }

  // ----- Slot occupancy -----
  const slotOccupant = (accountType: AngelPayAccountType): string | null => {
    if (!paymentConfig) return null
    return ((paymentConfig as unknown as Record<string, unknown>)[SLOT_FIELD[accountType]] as string | null) ?? null
  }

  // ----- Per-step validation -----
  const stepValid = (s: AngelPayWizardState, idx: number): boolean => {
    switch (STEPS[idx].key) {
      case 'venue':
        return !!s.venue
      case 'login':
        return s.login.mode === 'existing'
          ? !!s.login.angelpayUserAccountId
          : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s.login.email) && /^\d{6}$/.test(s.login.pin)
      case 'merchant':
        return s.merchant.mode === 'existing'
          ? !!s.merchant.existingMerchantId
          : /^\d+$/.test(s.merchant.externalMerchantId) &&
              !!s.merchant.name.trim() &&
              !!s.merchant.affiliation.trim() &&
              !!s.merchant.displayName.trim() &&
              s.merchant.idConfirmed
      case 'slot':
        return s.slot.mode !== 'replace' || !!s.slot.replacedAccountId
      case 'pricing':
        // Pricing required only in replace mode; then it cannot be skipped.
        return !isPricingRequired(s) || !s.pricing.skipped
      default:
        return true
    }
  }

  const canAdvance = stepValid(state, step)

  // ----- Build payload -----
  const buildPayload = (): FullSetupAngelPayPayload => {
    const iso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : new Date().toISOString())
    return {
      idempotencyKey: state.idempotencyKey,
      venueId: state.venue!.id,
      aggregatorId: state.cost.skipped ? undefined : state.cost.aggregatorId,
      login: state.login,
      merchant:
        state.merchant.mode === 'existing'
          ? { mode: 'existing', merchantAccountId: state.merchant.existingMerchantId ?? '' }
          : {
              mode: 'create',
              externalMerchantId: state.merchant.externalMerchantId,
              name: state.merchant.name,
              affiliation: state.merchant.affiliation,
              displayName: state.merchant.displayName,
            },
      slot: state.slot,
      terminalIds: state.terminals.skipped || state.terminals.terminalIds.length === 0 ? undefined : state.terminals.terminalIds,
      cost: state.cost.skipped
        ? undefined
        : {
            debitRate: state.cost.debitRate ?? 0,
            creditRate: state.cost.creditRate ?? 0,
            amexRate: state.cost.amexRate ?? 0,
            internationalRate: state.cost.internationalRate ?? 0,
            includesTax: state.cost.includesTax,
            taxRate: state.cost.taxRate,
            fixedCostPerTransaction: state.cost.fixedCostPerTransaction,
            monthlyFee: state.cost.monthlyFee,
            effectiveFrom: iso(state.cost.effectiveFrom),
          },
      pricing: state.pricing.skipped
        ? undefined
        : {
            debitRate: state.pricing.debitRate ?? 0,
            creditRate: state.pricing.creditRate ?? 0,
            amexRate: state.pricing.amexRate ?? 0,
            internationalRate: state.pricing.internationalRate ?? 0,
            includesTax: state.pricing.includesTax,
            taxRate: state.pricing.taxRate,
            fixedFeePerTransaction: state.pricing.fixedFeePerTransaction,
            monthlyServiceFee: state.pricing.monthlyServiceFee,
            effectiveFrom: iso(state.pricing.effectiveFrom),
          },
      settlement: state.settlement.skipped
        ? undefined
        : {
            settlementDays: state.settlement.settlementDays ?? 1,
            settlementDayType: state.settlement.settlementDayType,
            cutoffTime: state.settlement.cutoffTime || '23:00',
            cutoffTimezone: state.settlement.cutoffTimezone || 'America/Mexico_City',
            effectiveFrom: iso(state.settlement.effectiveFrom),
          },
    }
  }

  /**
   * Build the MerchantRevenueShare payload for the post-setup follow-up POST.
   * Only called when `state.revenueShare.skipped === false`.
   *
   * - When `useAggregator` is false → no aggregatorPrice, no aggregator share.
   *   The split is purely the provider→venue margin × `avoqadoShareOfProviderMargin`.
   * - When `useAggregator` is true → all 4 card rates required, plus the second share.
   */
  const buildRevenueSharePayload = (merchantAccountId: string) => {
    const rs = state.revenueShare
    if (rs.useAggregator) {
      return {
        merchantAccountId,
        aggregatorPrice: {
          DEBIT: rs.aggregatorDebitRate ?? 0,
          CREDIT: rs.aggregatorCreditRate ?? 0,
          AMEX: rs.aggregatorAmexRate ?? 0,
          INTERNATIONAL: rs.aggregatorInternationalRate ?? 0,
        },
        aggregatorPriceIncludesTax: rs.aggregatorPriceIncludesTax,
        avoqadoShareOfProviderMargin: rs.avoqadoShareOfProviderMargin,
        avoqadoShareOfAggregatorMargin: rs.avoqadoShareOfAggregatorMargin ?? 0.5,
        taxRate: rs.taxRate,
      }
    }
    return {
      merchantAccountId,
      aggregatorPrice: null,
      aggregatorPriceIncludesTax: false,
      avoqadoShareOfProviderMargin: rs.avoqadoShareOfProviderMargin,
      avoqadoShareOfAggregatorMargin: null,
      taxRate: rs.taxRate,
    }
  }

  const stepKey = STEPS[step].key

  // ----- Step content -----
  const renderStep = () => {
    switch (stepKey) {
      case 'venue':
        return (
          <Section title="Selecciona el venue" icon={<Building2 className="w-4 h-4 text-muted-foreground" />}>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar venue..."
                value={venueSearch}
                onChange={e => setVenueSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            {venuesLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Cargando venues...
              </div>
            ) : (
              <div className="max-h-[360px] overflow-y-auto space-y-1">
                {filteredVenues.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => dispatch({ type: 'SET_VENUE', venue: { id: v.id, name: v.name, slug: v.slug } })}
                    className={cn(
                      'flex w-full items-center justify-between rounded-lg border border-input px-3 py-2 text-left text-sm cursor-pointer hover:bg-muted/50',
                      state.venue?.id === v.id && 'border-foreground bg-muted/40',
                    )}
                  >
                    <span className="truncate">{v.name}</span>
                    {state.venue?.id === v.id && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />}
                  </button>
                ))}
                {filteredVenues.length === 0 && (
                  <p className="text-sm text-muted-foreground py-4 text-center">Sin resultados</p>
                )}
              </div>
            )}
          </Section>
        )

      case 'login':
        return (
          <Section title="Login de AngelPay" icon={<Wallet className="w-4 h-4 text-muted-foreground" />}>
            {activeLogins.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Cuentas existentes en este venue</Label>
                {activeLogins.map(l => {
                  const selected = state.login.mode === 'existing' && state.login.angelpayUserAccountId === l.id
                  const hasMerchant = allMerchants.some(
                    m => m.angelpayUserAccountId === l.id && !!m.externalMerchantId && !!m.angelpayAffiliation,
                  )
                  return (
                    <div key={l.id} className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => dispatch({ type: 'SET_LOGIN', login: { mode: 'existing', angelpayUserAccountId: l.id } })}
                        className={cn(
                          'flex flex-1 min-w-0 items-center justify-between rounded-lg border border-input px-3 py-2 text-left text-sm cursor-pointer hover:bg-muted/50',
                          selected && 'border-foreground bg-muted/40',
                        )}
                      >
                        <span className="truncate">{l.email}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          {!hasMerchant && (
                            <Badge className="text-[10px] bg-amber-500/15 text-amber-700 dark:text-amber-400 hover:bg-amber-500/15">
                              Falta info
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px]">
                            {l.environment}
                          </Badge>
                        </div>
                      </button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-9 w-9 shrink-0 cursor-pointer"
                        title="Ver detalles / eliminar cuenta"
                        onClick={() => setManagingAccount(l)}
                      >
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </Button>
                    </div>
                  )
                })}
              </div>
            )}
            <button
              type="button"
              onClick={() => dispatch({ type: 'SET_LOGIN', login: { mode: 'new', email: '', pin: '', environment: 'QA' } })}
              className={cn(
                'w-full rounded-lg border border-dashed border-input px-3 py-2 text-sm cursor-pointer hover:bg-muted/50',
                state.login.mode === 'new' && 'border-foreground border-solid bg-muted/40',
              )}
            >
              + Conectar una cuenta nueva
            </button>
            {state.login.mode === 'new' && (
              <div className="space-y-3 pt-1">
                <div className="space-y-1">
                  <Label className="text-xs">Correo</Label>
                  <Input
                    value={state.login.email}
                    onChange={e => updateNewLogin({ email: e.target.value })}
                    placeholder="correo@ejemplo.com"
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">PIN (6 dígitos)</Label>
                    <Input
                      value={state.login.pin}
                      onChange={e => updateNewLogin({ pin: e.target.value.replace(/\D/g, '').slice(0, 6) })}
                      placeholder="123456"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Ambiente</Label>
                    <Select
                      value={state.login.environment}
                      onValueChange={v => updateNewLogin({ environment: v as 'QA' | 'PROD' })}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="QA">QA</SelectItem>
                        <SelectItem value="PROD">PROD</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}
          </Section>
        )

      case 'merchant': {
        const setCreateMode = () =>
          dispatch({
            type: 'SET_MERCHANT',
            merchant: { mode: 'create', externalMerchantId: '', name: '', affiliation: '', displayName: '', idConfirmed: false },
          })
        return (
          <Section title="Datos del merchant" icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}>
            {/* NEXGO terminal — required for AngelPay (live discovery + payments). */}
            <div className="rounded-lg border border-input bg-muted/30 p-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-medium">Terminal NEXGO</p>
                  <p className="text-[11px] text-muted-foreground">
                    {nexgoTerminal
                      ? `${nexgoTerminal.name || nexgoTerminal.serialNumber} activa — lista para descubrir merchants.`
                      : 'AngelPay necesita una terminal NEXGO activa en este venue.'}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0"
                  onClick={() => setCreateTerminalOpen(true)}
                >
                  <Plus className="w-3.5 h-3.5 mr-1.5" />
                  Crear terminal NEXGO
                </Button>
              </div>
              {/* TPV live discovery — only for an existing login (a new one isn't on AngelPay yet). */}
              {state.login.mode === 'existing' && (
                <div className="flex items-center justify-between gap-3 border-t border-input pt-2">
                  <p className="min-w-0 text-[11px] text-muted-foreground">
                    {nexgoTerminal
                      ? 'Descubre automáticamente los merchants de esta cuenta desde la TPV.'
                      : 'Crea y activa una NEXGO para habilitar la búsqueda en TPV.'}
                  </p>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="shrink-0"
                    disabled={!nexgoTerminal || tpvFetchState === 'fetching'}
                    onClick={handleTpvFetch}
                  >
                    {tpvFetchState === 'fetching' ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Search className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    {tpvFetchState === 'fetching' ? 'Buscando…' : 'Buscar en TPV'}
                  </Button>
                </div>
              )}
              {tpvFetchMsg && (
                <p
                  className={cn(
                    'text-[11px]',
                    tpvFetchState === 'error'
                      ? 'text-destructive'
                      : tpvFetchState === 'done'
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-muted-foreground',
                  )}
                >
                  {tpvFetchMsg}
                </p>
              )}
            </div>

            {/* If the chosen AngelPay login already has merchants, offer to reuse one. */}
            {loginMerchants.length > 0 && (
              <div className="space-y-1">
                <Label className="text-xs">Esta cuenta AngelPay ya tiene merchants — úsalos o captura uno nuevo</Label>
                {loginMerchants.map(m => {
                  const selected = state.merchant.mode === 'existing' && state.merchant.existingMerchantId === m.id
                  // Does this merchant already occupy a slot in the venue's payment config?
                  const inSlot = (['PRIMARY', 'SECONDARY', 'TERTIARY'] as AngelPayAccountType[]).find(
                    s => slotOccupant(s) === m.id,
                  )
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() =>
                        dispatch({
                          type: 'SET_MERCHANT',
                          merchant: {
                            mode: 'existing',
                            externalMerchantId: '',
                            name: '',
                            affiliation: '',
                            displayName: '',
                            idConfirmed: false,
                            existingMerchantId: m.id,
                            existingMerchantLabel: m.displayName || m.angelpayMerchantName || `Merchant ${m.externalMerchantId}`,
                          },
                        })
                      }
                      className={cn(
                        'flex w-full items-center justify-between rounded-lg border border-input px-3 py-2 text-left text-sm cursor-pointer hover:bg-muted/50',
                        selected && 'border-foreground bg-muted/40',
                      )}
                    >
                      <span className="min-w-0 truncate">
                        {m.displayName || m.angelpayMerchantName || 'Sin nombre'}
                        <span className="ml-2 font-mono text-[11px] text-muted-foreground">ID {m.externalMerchantId}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {inSlot && (
                          <Badge variant="secondary" className="text-[10px]">
                            Ya en slot {inSlot}
                          </Badge>
                        )}
                        {selected && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      </div>
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={setCreateMode}
                  className={cn(
                    'w-full rounded-lg border border-dashed border-input px-3 py-2 text-sm cursor-pointer hover:bg-muted/50',
                    state.merchant.mode === 'create' && 'border-foreground border-solid bg-muted/40',
                  )}
                >
                  + Capturar un merchant nuevo
                </button>
              </div>
            )}

            {state.merchant.mode === 'existing' ? (
              <p className="rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                Usarás el merchant existente <strong>{state.merchant.existingMerchantLabel}</strong>. No necesitas capturar datos.
              </p>
            ) : (
              <>
                <div className="space-y-1">
                  <Label className="text-xs">ID del merchant (numérico)</Label>
                  <Input
                    value={state.merchant.externalMerchantId}
                    onChange={e =>
                      dispatch({
                        type: 'SET_MERCHANT',
                        merchant: {
                          ...state.merchant,
                          mode: 'create',
                          externalMerchantId: e.target.value.replace(/\D/g, ''),
                          idConfirmed: false,
                        },
                      })
                    }
                    placeholder="9814275"
                    className="h-10"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Afiliación</Label>
                    <Input
                      value={state.merchant.affiliation}
                      onChange={e => dispatch({ type: 'SET_MERCHANT', merchant: { ...state.merchant, affiliation: e.target.value } })}
                      placeholder="Núm. de afiliación"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre del merchant</Label>
                    <Input
                      value={state.merchant.name}
                      onChange={e =>
                        dispatch({
                          type: 'SET_MERCHANT',
                          merchant: {
                            ...state.merchant,
                            name: e.target.value,
                            displayName: state.merchant.displayName || e.target.value,
                          },
                        })
                      }
                      placeholder="Nombre del comercio"
                      className="h-10"
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Nombre para mostrar</Label>
                  <Input
                    value={state.merchant.displayName}
                    onChange={e => dispatch({ type: 'SET_MERCHANT', merchant: { ...state.merchant, displayName: e.target.value } })}
                    placeholder="Cómo se mostrará en el panel"
                    className="h-10"
                  />
                </div>
                <label className="flex items-start gap-2 cursor-pointer rounded-lg border border-input bg-amber-500/5 p-3">
                  <Checkbox
                    checked={state.merchant.idConfirmed}
                    onCheckedChange={c => dispatch({ type: 'SET_MERCHANT', merchant: { ...state.merchant, idConfirmed: !!c } })}
                    className="mt-0.5"
                  />
                  <span className="text-xs text-muted-foreground">
                    Confirmo que el ID <strong className="text-foreground">{state.merchant.externalMerchantId || '—'}</strong> y la
                    afiliación <strong className="text-foreground">{state.merchant.affiliation || '—'}</strong> son correctos. Un
                    error rutea pagos a un merchant equivocado.
                  </span>
                </label>
              </>
            )}
          </Section>
        )
      }

      case 'slot': {
        const selectedMerchantId = state.merchant.mode === 'existing' ? state.merchant.existingMerchantId : undefined
        const merchantLabel = (id: string) => {
          const m = allMerchants.find(x => x.id === id)
          return m ? m.displayName || m.angelpayMerchantName || `ID ${m.externalMerchantId}` : 'Cuenta desconocida'
        }
        // The merchant being assigned by this wizard run (the one that replaces the occupant).
        const incomingLabel =
          state.merchant.mode === 'existing'
            ? state.merchant.existingMerchantLabel || 'el merchant seleccionado'
            : state.merchant.displayName || state.merchant.name || 'el merchant nuevo'
        // Which slot (if any) the merchant being assigned already occupies here.
        const alreadyInSlot = (['PRIMARY', 'SECONDARY', 'TERTIARY'] as AngelPayAccountType[]).find(
          s => !!selectedMerchantId && slotOccupant(s) === selectedMerchantId,
        )
        // Picking a slot: if the merchant already occupies a different slot, ask
        // swap vs vacate; otherwise assign directly.
        const handleSlotPick = (slot: AngelPayAccountType) => {
          if (alreadyInSlot && alreadyInSlot !== slot) {
            setSlotMovePrompt(slot)
            return
          }
          const occupant = slotOccupant(slot)
          dispatch({
            type: 'SET_SLOT',
            slot: occupant
              ? { accountType: slot, mode: 'replace', replacedAccountId: occupant }
              : { accountType: slot, mode: 'fill' },
          })
        }
        const confirmSlotMove = (strategy: 'swap' | 'vacate') => {
          if (!slotMovePrompt || !alreadyInSlot) return
          const occupant = slotOccupant(slotMovePrompt)
          dispatch({
            type: 'SET_SLOT',
            slot: {
              accountType: slotMovePrompt,
              mode: occupant ? 'replace' : 'fill',
              replacedAccountId: occupant ?? undefined,
              fromSlot: alreadyInSlot,
              moveStrategy: strategy,
            },
          })
          setSlotMovePrompt(null)
        }
        return (
          <Section title="Slot del venue" icon={<Building2 className="w-4 h-4 text-muted-foreground" />}>
            <p className="text-xs text-muted-foreground">
              ¿En qué slot de ruteo de pagos va esta cuenta? Reemplazar un slot ocupado obliga a recapturar el precio.
            </p>
            {alreadyInSlot && (
              <p className="flex items-center gap-1.5 rounded-lg border border-green-600/30 bg-green-600/5 px-3 py-2 text-xs text-green-700 dark:text-green-400">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Este merchant ya está asignado y activo en el slot <strong>{alreadyInSlot}</strong> de este venue.
              </p>
            )}
            {(['PRIMARY', 'SECONDARY', 'TERTIARY'] as AngelPayAccountType[]).map(slot => {
              const occupant = slotOccupant(slot)
              const selected = state.slot.accountType === slot
              const isSelf = !!occupant && occupant === selectedMerchantId
              return (
                <button
                  key={slot}
                  type="button"
                  onClick={() => handleSlotPick(slot)}
                  className={cn(
                    'flex w-full items-center justify-between gap-3 rounded-lg border border-input px-3 py-2.5 text-left text-sm cursor-pointer hover:bg-muted/50',
                    selected && 'border-foreground bg-muted/40',
                  )}
                >
                  <div className="min-w-0">
                    <p className="font-medium">{slot}</p>
                    {occupant && <p className="truncate text-[11px] text-muted-foreground">{merchantLabel(occupant)}</p>}
                  </div>
                  {isSelf ? (
                    <Badge className="text-[10px] shrink-0 bg-green-600 hover:bg-green-600">Asignado aquí</Badge>
                  ) : occupant ? (
                    <Badge variant="secondary" className="text-[10px] shrink-0">
                      Ocupado — reemplazar
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      Libre
                    </Badge>
                  )}
                </button>
              )
            })}
            {state.slot.mode === 'replace' && state.slot.replacedAccountId && (
              <div className="space-y-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                <p className="flex items-center gap-1.5 text-xs font-medium text-amber-700 dark:text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                  Reemplazo en el slot {state.slot.accountType}
                </p>
                <div className="flex items-center gap-2 text-xs">
                  <span className="rounded-md border border-input bg-card px-2 py-1 text-muted-foreground line-through">
                    {merchantLabel(state.slot.replacedAccountId)}
                  </span>
                  <span className="text-muted-foreground">→</span>
                  <span className="rounded-md border border-foreground/30 bg-card px-2 py-1 font-medium">
                    {incomingLabel}
                  </span>
                </div>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-400/80">
                  La cuenta de la izquierda sale del ruteo de pagos de este venue. El precio se recaptura en el paso 7.
                </p>
              </div>
            )}

            {/* Cross-slot move confirmation — swap vs vacate. */}
            {slotMovePrompt && alreadyInSlot && (
              <Dialog open onOpenChange={o => !o && setSlotMovePrompt(null)}>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader>
                    <DialogTitle>Mover merchant de slot</DialogTitle>
                  </DialogHeader>
                  <p className="text-sm text-muted-foreground">
                    <strong className="text-foreground">{incomingLabel}</strong> ya está en el slot{' '}
                    <strong className="text-foreground">{alreadyInSlot}</strong>. Lo asignarás a{' '}
                    <strong className="text-foreground">{slotMovePrompt}</strong>.
                  </p>
                  <div className="space-y-2">
                    {slotOccupant(slotMovePrompt) ? (
                      <>
                        <button
                          type="button"
                          onClick={() => confirmSlotMove('swap')}
                          className="w-full rounded-lg border border-input px-3 py-2.5 text-left cursor-pointer hover:bg-muted/50"
                        >
                          <p className="text-sm font-medium">Intercambiar</p>
                          <p className="text-xs text-muted-foreground">
                            {merchantLabel(slotOccupant(slotMovePrompt)!)} pasa al slot {alreadyInSlot}.
                          </p>
                        </button>
                        {alreadyInSlot !== 'PRIMARY' && (
                          <button
                            type="button"
                            onClick={() => confirmSlotMove('vacate')}
                            className="w-full rounded-lg border border-input px-3 py-2.5 text-left cursor-pointer hover:bg-muted/50"
                          >
                            <p className="text-sm font-medium">Vaciar el slot {alreadyInSlot}</p>
                            <p className="text-xs text-muted-foreground">
                              {alreadyInSlot} queda libre; {merchantLabel(slotOccupant(slotMovePrompt)!)} sale del ruteo de pagos.
                            </p>
                          </button>
                        )}
                      </>
                    ) : alreadyInSlot !== 'PRIMARY' ? (
                      <button
                        type="button"
                        onClick={() => confirmSlotMove('vacate')}
                        className="w-full rounded-lg border border-input px-3 py-2.5 text-left cursor-pointer hover:bg-muted/50"
                      >
                        <p className="text-sm font-medium">Mover a {slotMovePrompt}</p>
                        <p className="text-xs text-muted-foreground">El slot {alreadyInSlot} queda libre.</p>
                      </button>
                    ) : (
                      <p className="rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                        No se puede mover desde PRIMARY a un slot vacío — PRIMARY no puede quedar sin cuenta. Elige un slot
                        ocupado para intercambiar.
                      </p>
                    )}
                  </div>
                  <Button variant="ghost" onClick={() => setSlotMovePrompt(null)}>
                    Cancelar
                  </Button>
                </DialogContent>
              </Dialog>
            )}
          </Section>
        )
      }

      case 'terminals':
        return (
          <Section title="Terminales (opcional)" icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={state.terminals.skipped}
                onCheckedChange={c =>
                  dispatch({ type: 'SET_TERMINALS', terminals: { ...state.terminals, skipped: !!c } })
                }
              />
              Configurar después
            </label>
            {!state.terminals.skipped && (
              <div className="max-h-[300px] overflow-y-auto space-y-1">
                {terminals.length === 0 && (
                  <p className="text-sm text-muted-foreground py-2">Este venue no tiene terminales registradas.</p>
                )}
                {terminals.map(t => {
                  const checked = state.terminals.terminalIds.includes(t.id)
                  return (
                    <label
                      key={t.id}
                      className="flex items-center gap-2 cursor-pointer rounded-lg border border-input px-3 py-2 text-sm"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={c =>
                          dispatch({
                            type: 'SET_TERMINALS',
                            terminals: {
                              ...state.terminals,
                              terminalIds: c
                                ? [...state.terminals.terminalIds, t.id]
                                : state.terminals.terminalIds.filter(id => id !== t.id),
                            },
                          })
                        }
                      />
                      <span className="flex-1 truncate">{t.name || t.serialNumber}</span>
                      <Badge variant="outline" className="text-[10px]">
                        {t.brand || t.type}
                      </Badge>
                    </label>
                  )
                })}
              </div>
            )}
          </Section>
        )

      case 'cost':
        return (
          <Section title="Costo del procesador (opcional)" icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}>
            <p className="text-xs text-muted-foreground">
              Lo que AngelPay nos cobra. Escribe el porcentaje tal cual: <strong>1.5</strong> = 1.5%.
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={state.cost.skipped}
                onCheckedChange={c => dispatch({ type: 'SET_COST', cost: { ...state.cost, skipped: !!c } })}
              />
              Configurar después
            </label>
            {!state.cost.skipped && (
              <div className="space-y-1">
                <Label className="text-xs">Agregador (opcional)</Label>
                {aggregators.length > 0 ? (
                  <>
                    <Select
                      value={state.cost.aggregatorId ?? 'none'}
                      onValueChange={v => {
                        if (v === '__create__') {
                          setCreateAggOpen(true)
                          return
                        }
                        handleAggregatorPick(v === 'none' ? undefined : v)
                      }}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Sin agregador" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin agregador</SelectItem>
                        {aggregators.map(a => (
                          <SelectItem key={a.id} value={a.id}>
                            {a.name}
                          </SelectItem>
                        ))}
                        <SelectItem value="__create__" className="text-primary">
                          + Crear agregador nuevo
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    {state.cost.aggregatorId && (
                      <p className="text-[11px] text-muted-foreground">
                        Agregador asociado. El revenue-share se configura por merchant después de crear.
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground">
                      No hay agregadores configurados. Crea uno o captura las tasas manualmente.
                    </p>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setCreateAggOpen(true)}
                    >
                      + Crear agregador
                    </Button>
                  </div>
                )}
              </div>
            )}
            {!state.cost.skipped && (
              <div className="grid grid-cols-2 gap-3">
                <PercentField label="Débito" value={state.cost.debitRate} onChange={v => dispatch({ type: 'SET_COST', cost: { ...state.cost, debitRate: v } })} />
                <PercentField label="Crédito" value={state.cost.creditRate} onChange={v => dispatch({ type: 'SET_COST', cost: { ...state.cost, creditRate: v } })} />
                <PercentField label="Amex" value={state.cost.amexRate} onChange={v => dispatch({ type: 'SET_COST', cost: { ...state.cost, amexRate: v } })} />
                <PercentField label="Internacional" value={state.cost.internationalRate} onChange={v => dispatch({ type: 'SET_COST', cost: { ...state.cost, internationalRate: v } })} />
                <NumberField label="Cuota fija / transacción" value={state.cost.fixedCostPerTransaction} onChange={v => dispatch({ type: 'SET_COST', cost: { ...state.cost, fixedCostPerTransaction: v } })} />
                <NumberField label="Cuota mensual" value={state.cost.monthlyFee} onChange={v => dispatch({ type: 'SET_COST', cost: { ...state.cost, monthlyFee: v } })} />
                <div className="space-y-1">
                  <Label className="text-xs">Vigente desde</Label>
                  <Input type="date" value={state.cost.effectiveFrom} onChange={e => dispatch({ type: 'SET_COST', cost: { ...state.cost, effectiveFrom: e.target.value } })} className="h-10" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs pt-6">
                  <Checkbox checked={state.cost.includesTax} onCheckedChange={c => dispatch({ type: 'SET_COST', cost: { ...state.cost, includesTax: !!c } })} />
                  Las tasas ya incluyen IVA
                </label>
              </div>
            )}
          </Section>
        )

      case 'pricing':
        return (
          <Section title="Precio al venue (opcional)" icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}>
            <p className="text-xs text-muted-foreground">
              Lo que le cobramos al venue (con margen). Escribe el porcentaje tal cual: <strong>2.5</strong> = 2.5%.
            </p>
            {isPricingRequired(state) ? (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Obligatorio: estás reemplazando un slot.
              </p>
            ) : (
              <label className="flex items-center gap-2 cursor-pointer text-sm">
                <Checkbox
                  checked={state.pricing.skipped}
                  onCheckedChange={c => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, skipped: !!c } })}
                />
                Configurar después
              </label>
            )}
            {!state.pricing.skipped && (
              <div className="grid grid-cols-2 gap-3">
                <PercentField label="Débito" value={state.pricing.debitRate} onChange={v => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, debitRate: v } })} />
                <PercentField label="Crédito" value={state.pricing.creditRate} onChange={v => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, creditRate: v } })} />
                <PercentField label="Amex" value={state.pricing.amexRate} onChange={v => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, amexRate: v } })} />
                <PercentField label="Internacional" value={state.pricing.internationalRate} onChange={v => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, internationalRate: v } })} />
                <NumberField label="Cuota fija / transacción" value={state.pricing.fixedFeePerTransaction} onChange={v => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, fixedFeePerTransaction: v } })} />
                <NumberField label="Cuota mensual de servicio" value={state.pricing.monthlyServiceFee} onChange={v => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, monthlyServiceFee: v } })} />
                <div className="space-y-1">
                  <Label className="text-xs">Vigente desde</Label>
                  <Input type="date" value={state.pricing.effectiveFrom} onChange={e => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, effectiveFrom: e.target.value } })} className="h-10" />
                </div>
                <label className="flex items-center gap-2 cursor-pointer text-xs pt-6">
                  <Checkbox checked={state.pricing.includesTax} onCheckedChange={c => dispatch({ type: 'SET_PRICING', pricing: { ...state.pricing, includesTax: !!c } })} />
                  Las tasas ya incluyen IVA
                </label>
              </div>
            )}
          </Section>
        )

      case 'settlement':
        return (
          <Section title="Liquidación (opcional)" icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={state.settlement.skipped}
                onCheckedChange={c => dispatch({ type: 'SET_SETTLEMENT', settlement: { ...state.settlement, skipped: !!c } })}
              />
              Configurar después
            </label>
            {!state.settlement.skipped && (
              <div className="grid grid-cols-2 gap-3">
                <NumberField label="Días de liquidación" value={state.settlement.settlementDays} onChange={v => dispatch({ type: 'SET_SETTLEMENT', settlement: { ...state.settlement, settlementDays: v } })} />
                <div className="space-y-1">
                  <Label className="text-xs">Tipo de día</Label>
                  <Select
                    value={state.settlement.settlementDayType}
                    onValueChange={v => dispatch({ type: 'SET_SETTLEMENT', settlement: { ...state.settlement, settlementDayType: v as 'BUSINESS_DAYS' | 'CALENDAR_DAYS' } })}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUSINESS_DAYS">Días hábiles</SelectItem>
                      <SelectItem value="CALENDAR_DAYS">Días naturales</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Hora de corte</Label>
                  <Input value={state.settlement.cutoffTime} onChange={e => dispatch({ type: 'SET_SETTLEMENT', settlement: { ...state.settlement, cutoffTime: e.target.value } })} placeholder="23:00" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Zona horaria</Label>
                  <Input value={state.settlement.cutoffTimezone} onChange={e => dispatch({ type: 'SET_SETTLEMENT', settlement: { ...state.settlement, cutoffTimezone: e.target.value } })} placeholder="America/Mexico_City" className="h-10" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Vigente desde</Label>
                  <Input type="date" value={state.settlement.effectiveFrom} onChange={e => dispatch({ type: 'SET_SETTLEMENT', settlement: { ...state.settlement, effectiveFrom: e.target.value } })} className="h-10" />
                </div>
              </div>
            )}
          </Section>
        )

      case 'revenueShare':
        return (
          <Section
            title="Reparto Avoqado / agregador (opcional)"
            icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}
          >
            <p className="text-xs text-muted-foreground">
              Define cómo se reparte la ganancia entre Avoqado y el agregador para este merchant.
              Si dejas "Configurar después", el comportamiento es el legacy: 100% del margen va a Avoqado.
              Lo puedes editar después en <strong>Superadmin → Agregadores → Reporte de revenue-share</strong>.
            </p>
            <label className="flex items-center gap-2 cursor-pointer text-sm">
              <Checkbox
                checked={state.revenueShare.skipped}
                onCheckedChange={c =>
                  dispatch({
                    type: 'SET_REVENUE_SHARE',
                    revenueShare: { ...state.revenueShare, skipped: !!c },
                  })
                }
              />
              Configurar después
            </label>

            {!state.revenueShare.skipped && (
              <div className="space-y-4">
                {/* ¿Hay agregador en medio? */}
                <label className="flex items-center gap-2 cursor-pointer text-sm">
                  <Checkbox
                    checked={state.revenueShare.useAggregator}
                    onCheckedChange={c =>
                      dispatch({
                        type: 'SET_REVENUE_SHARE',
                        revenueShare: { ...state.revenueShare, useAggregator: !!c },
                      })
                    }
                  />
                  <span>
                    Hay un <strong>agregador</strong> intermediario (ej. Moneygiver) entre Avoqado y el
                    venue
                  </span>
                </label>

                {/* Tarifas del agregador (cuando aplica) */}
                {state.revenueShare.useAggregator && (
                  <div className="space-y-2 rounded-lg border border-input p-3">
                    <Label className="text-xs">Tarifas del agregador → Avoqado (%)</Label>
                    <div className="grid grid-cols-2 gap-3">
                      <PercentField
                        label="Débito"
                        value={state.revenueShare.aggregatorDebitRate}
                        onChange={v =>
                          dispatch({
                            type: 'SET_REVENUE_SHARE',
                            revenueShare: { ...state.revenueShare, aggregatorDebitRate: v },
                          })
                        }
                      />
                      <PercentField
                        label="Crédito"
                        value={state.revenueShare.aggregatorCreditRate}
                        onChange={v =>
                          dispatch({
                            type: 'SET_REVENUE_SHARE',
                            revenueShare: { ...state.revenueShare, aggregatorCreditRate: v },
                          })
                        }
                      />
                      <PercentField
                        label="Amex"
                        value={state.revenueShare.aggregatorAmexRate}
                        onChange={v =>
                          dispatch({
                            type: 'SET_REVENUE_SHARE',
                            revenueShare: { ...state.revenueShare, aggregatorAmexRate: v },
                          })
                        }
                      />
                      <PercentField
                        label="Internacional"
                        value={state.revenueShare.aggregatorInternationalRate}
                        onChange={v =>
                          dispatch({
                            type: 'SET_REVENUE_SHARE',
                            revenueShare: { ...state.revenueShare, aggregatorInternationalRate: v },
                          })
                        }
                      />
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer text-xs">
                      <Checkbox
                        checked={state.revenueShare.aggregatorPriceIncludesTax}
                        onCheckedChange={c =>
                          dispatch({
                            type: 'SET_REVENUE_SHARE',
                            revenueShare: {
                              ...state.revenueShare,
                              aggregatorPriceIncludesTax: !!c,
                            },
                          })
                        }
                      />
                      Las tasas del agregador ya incluyen IVA
                    </label>
                  </div>
                )}

                {/* Splits (slider-style number inputs) */}
                <div className="space-y-2 rounded-lg border border-input p-3">
                  <Label className="text-xs">
                    % que se queda Avoqado del margen{' '}
                    <span className="text-muted-foreground">
                      (provider → {state.revenueShare.useAggregator ? 'agregador' : 'venue'})
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={decimalToPercent(state.revenueShare.avoqadoShareOfProviderMargin)}
                    onChange={e => {
                      const raw = e.target.value
                      const pct = raw === '' ? 0 : parseFloat(raw)
                      dispatch({
                        type: 'SET_REVENUE_SHARE',
                        revenueShare: {
                          ...state.revenueShare,
                          avoqadoShareOfProviderMargin: Math.max(0, Math.min(1, percentToDecimal(pct))),
                        },
                      })
                    }}
                    className="h-10"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    50 = Avoqado y la contraparte se reparten 50/50 ese margen. 100 = todo el margen a
                    Avoqado.
                  </p>
                </div>

                {state.revenueShare.useAggregator && (
                  <div className="space-y-2 rounded-lg border border-input p-3">
                    <Label className="text-xs">
                      % que se queda Avoqado del margen{' '}
                      <span className="text-muted-foreground">(agregador → venue)</span>
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={decimalToPercent(state.revenueShare.avoqadoShareOfAggregatorMargin ?? 0.5)}
                      onChange={e => {
                        const raw = e.target.value
                        const pct = raw === '' ? 0 : parseFloat(raw)
                        dispatch({
                          type: 'SET_REVENUE_SHARE',
                          revenueShare: {
                            ...state.revenueShare,
                            avoqadoShareOfAggregatorMargin: Math.max(
                              0,
                              Math.min(1, percentToDecimal(pct)),
                            ),
                          },
                        })
                      }}
                      className="h-10"
                    />
                  </div>
                )}

                {/* Tax rate */}
                <div className="space-y-2 rounded-lg border border-input p-3">
                  <Label className="text-xs">IVA (%)</Label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step={0.01}
                    value={decimalToPercent(state.revenueShare.taxRate)}
                    onChange={e => {
                      const raw = e.target.value
                      const pct = raw === '' ? 0 : parseFloat(raw)
                      dispatch({
                        type: 'SET_REVENUE_SHARE',
                        revenueShare: {
                          ...state.revenueShare,
                          taxRate: Math.max(0, Math.min(1, percentToDecimal(pct))),
                        },
                      })
                    }}
                    className="h-10"
                  />
                </div>
              </div>
            )}
          </Section>
        )

      case 'summary':
        return (
          <Section title="Confirmar" icon={<CheckCircle2 className="w-4 h-4 text-muted-foreground" />}>
            <p className="text-sm text-muted-foreground">
              Revisa el resumen a la derecha. Al confirmar, todo se crea en una sola operación.
            </p>
          </Section>
        )
    }
  }

  // ----- Summary panel -----
  const summaryRow = (label: string, value: React.ReactNode) => (
    <div className="flex items-start justify-between gap-3 py-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{value}</span>
    </div>
  )

  const pendingBadge = <Badge variant="outline" className="text-[10px]">Pendiente</Badge>

  // ----- Footer actions -----
  const isLast = step === STEPS.length - 1
  const actions = (
    <div className="flex items-center gap-2">
      <Button variant="ghost" onClick={handleClose} disabled={mutation.isPending}>
        Cancelar
      </Button>
      {step > 0 && (
        <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={mutation.isPending}>
          Atrás
        </Button>
      )}
      {isLast ? (
        <Button onClick={() => mutation.mutate(buildPayload())} disabled={mutation.isPending}>
          {mutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
          Confirmar y crear
        </Button>
      ) : (
        <Button onClick={() => setStep(s => s + 1)} disabled={!canAdvance}>
          Siguiente
        </Button>
      )}
    </div>
  )

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title="Agregar cuenta AngelPay"
      subtitle={state.venue?.name}
      actions={actions}
      contentClassName="bg-muted/30"
    >
      <div className="mx-auto max-w-5xl p-6">
        {/* Step indicator */}
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {STEPS.map((s, i) => (
            <div
              key={s.key}
              className={cn(
                'flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px]',
                i === step && 'bg-foreground text-background',
                i !== step && i < step && 'bg-muted text-foreground',
                i !== step && i > step && 'bg-muted/50 text-muted-foreground',
              )}
            >
              <span>{i + 1}.</span>
              <span>{s.title}</span>
              {s.optional && i !== step && <span className="opacity-60">(opc)</span>}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6">
          {/* Step content */}
          <div>{renderStep()}</div>

          {/* Live summary panel */}
          <div className="rounded-2xl border border-input bg-card p-5 h-fit">
            <h3 className="font-semibold text-sm mb-2">Resumen</h3>
            {summaryRow('Venue', state.venue?.name || pendingBadge)}
            {summaryRow(
              'Login',
              state.login.mode === 'existing'
                ? activeLogins.find(l => l.id === (state.login as any).angelpayUserAccountId)?.email || 'Existente'
                : state.login.email || pendingBadge,
            )}
            {summaryRow(
              'Merchant',
              state.merchant.mode === 'existing'
                ? state.merchant.existingMerchantLabel || 'Existente'
                : state.merchant.displayName || state.merchant.externalMerchantId || pendingBadge,
            )}
            {summaryRow(
              'Slot',
              <>
                {state.slot.accountType}
                {state.slot.mode === 'replace' && <span className="text-amber-600"> (reemplazo)</span>}
              </>,
            )}
            {summaryRow(
              'Terminales',
              state.terminals.skipped ? pendingBadge : state.terminals.terminalIds.length || pendingBadge,
            )}
            {summaryRow('Costo', state.cost.skipped ? pendingBadge : <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" />)}
            {summaryRow('Precio', state.pricing.skipped ? pendingBadge : <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" />)}
            {summaryRow('Liquidación', state.settlement.skipped ? pendingBadge : <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline" />)}
            {summaryRow(
              'Reparto',
              state.revenueShare.skipped ? (
                pendingBadge
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 inline mr-1" />
                  <span className="text-[10px] text-muted-foreground">
                    {state.revenueShare.useAggregator ? 'con agregador' : 'directo'}
                  </span>
                </>
              ),
            )}
          </div>
        </div>
      </div>

      {/* Details/delete dialog — opens on top of the FullScreenModal (Radix portals it). */}
      {managingAccount && (
        <AngelPayAccountDetailsDialog
          open
          account={managingAccount}
          onOpenChange={o => !o && setManagingAccount(null)}
          onDeleted={() => queryClient.invalidateQueries({ queryKey: ['angelpay-logins', venueId] })}
        />
      )}

      {/* Create NEXGO terminal inline — opens from the Merchant step. */}
      {venueId && (
        <AngelPayCreateTerminalDialog
          open={createTerminalOpen}
          onOpenChange={setCreateTerminalOpen}
          venueId={venueId}
          venueName={state.venue?.name}
          onCreated={handleTerminalCreated}
        />
      )}

      {/* Inline "Crear agregador" — desde el paso de Costo. Diálogo minimal:
          solo nombre + IVA. baseFees plano queda en 0 (legacy fallback no usado);
          las tasas reales por proveedor se configuran después por merchant. */}
      <Dialog open={createAggOpen} onOpenChange={setCreateAggOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Crear agregador</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1">
              <Label className="text-xs">Nombre *</Label>
              <Input
                placeholder="ej. Moneygiver"
                value={newAggName}
                onChange={e => setNewAggName(e.target.value)}
                className="h-10"
                autoFocus
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Tasa IVA (%)</Label>
              <Input
                type="number"
                placeholder="16"
                step="0.01"
                value={newAggIva}
                onChange={e => setNewAggIva(e.target.value)}
                className="h-10"
              />
              <p className="text-[11px] text-muted-foreground">Default 16% (IVA MX).</p>
            </div>
            <p className="text-[11px] text-muted-foreground">
              Las tasas reales por proveedor se configuran después en{' '}
              <strong>Superadmin → Agregadores</strong> o por merchant.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateAggOpen(false)}
              disabled={createAggMutation.isPending}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() =>
                createAggMutation.mutate({
                  name: newAggName,
                  ivaRate: newAggIva.trim() === '' ? 0.16 : parseFloat(newAggIva) / 100,
                })
              }
              disabled={createAggMutation.isPending || !newAggName.trim()}
            >
              {createAggMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Crear
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </FullScreenModal>
  )
}

export default AngelPayWizard
