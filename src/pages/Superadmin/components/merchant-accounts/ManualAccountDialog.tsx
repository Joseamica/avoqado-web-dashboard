import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import {
  angelpayUserAccountAPI,
  type AngelPayEnvironment,
} from '@/services/superadmin-angelpay-user-account.service'
import { paymentProviderAPI, type MerchantAccount, type MerchantAccountCredentials } from '@/services/paymentProvider.service'
import { getAllVenues } from '@/services/superadmin.service'
import { terminalAPI, type CreateTerminalRequest } from '@/services/superadmin-terminals.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, CreditCard, Eye, EyeOff, Loader2 } from 'lucide-react'
import React, { useEffect, useMemo, useState } from 'react'
import { TerminalDialog } from '../TerminalDialog'
import { AngelPayAccountSection } from './AngelPayAccountSection'
import { AngelPayFields } from './AngelPayFields'
import { AttachTerminalDialog } from './AttachTerminalDialog'
import { DiscoveredMerchantsSubsection } from './DiscoveredMerchantsSubsection'
import { TerminalsSubsection } from './TerminalsSubsection'
// Note: DeviceCompatibilityBanner removed from this dialog in Task 54.
// TerminalsSubsection's empty-state already conveys "no NEXGO terminals"
// with two actionable buttons. The banner component still exists for any
// future caller that wants a standalone presence check.

interface ManualAccountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  onSave: (data: any) => Promise<void>
  /**
   * Task 17: when supplied, AngelPay creates a device-compatibility banner
   * + prerequisite check (`AngelPayUserAccount` must be ACTIVE) AND the
   * payload posted to the server includes `venueId`, which the Task 10
   * service-side guard requires for the ANGELPAY branch. Editing existing
   * accounts continues to work without a venue context.
   */
  venueId?: string
}

export const ManualAccountDialog: React.FC<ManualAccountDialogProps> = ({ open, onOpenChange, account, onSave, venueId }) => {
  const [loading, setLoading] = useState(false)
  const [showCredentials, setShowCredentials] = useState(false)
  // Nested dialogs:
  //   - terminalDialogOpen: TerminalDialog so the operator can register a
  //     NEXGO terminal inline (Section A "Crear terminal nueva").
  //   - attachTerminalOpen (Task 54): AttachTerminalDialog re-parents an
  //     existing terminal from another venue (Section A "Anexar existente").
  //
  // The pre-Task-54 AngelPayConnectDialog mount was deleted because Section B
  // (`<AngelPayAccountSection>`) inlines the connect form directly.
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false)
  const [attachTerminalOpen, setAttachTerminalOpen] = useState(false)
  // Wizard-gate state (Task 54). Section A reports terminal-presence;
  // Section B's ACTIVE chip is derived from the existing angelpayAccount
  // query; Section C only renders when both gates are satisfied.
  const [terminalsReady, setTerminalsReady] = useState(false)
  const [pendingMerchantsCount, setPendingMerchantsCount] = useState(0)
  // Section C → "Crear manualmente (avanzado)" collapsible. Default COLLAPSED
  // always — the manual form is a true escape hatch, not the primary path.
  // The primary path is TPV auto-discovery. Auto-expanding on no-pending was
  // confusing because operators thought the form was required. After admin
  // clicks the chevron, their choice sticks.
  const [manualExpanded, setManualExpanded] = useState(false)
  const [manualToggled, setManualToggled] = useState(false)
  const queryClient = useQueryClient()
  const { toast } = useToast()
  // UX polish on top of Task 17: when the operator opens this dialog from the
  // "Todos" page-level filter (i.e. no `venueId` prop), we render an inline
  // venue picker for the ANGELPAY path so they don't have to cancel, change
  // the page filter, and reopen. The `effectiveVenueId` below is what every
  // AngelPay-aware piece of UI (banner, prereq lookup, payload) consumes.
  const [internalSelectedVenueId, setInternalSelectedVenueId] = useState<string | null>(null)

  const [formData, setFormData] = useState({
    providerId: '',
    externalMerchantId: '',
    alias: '',
    displayName: '',
    active: true,
    displayOrder: 0,
    merchantId: '',
    apiKey: '',
    customerId: '',
    terminalId: '',
    providerConfig: '',
    // Blumon-specific fields
    blumonSerialNumber: '',
    blumonEnvironment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    blumonBrand: 'PAX',
    blumonModel: 'A910S',
    // AngelPay-specific fields (Task 17 — SDK 1.0.5 model)
    // Credentials moved to AngelPayUserAccount (per-venue email + PIN). The
    // MerchantAccount only needs the merchant numeric id + affiliation +
    // optional display override.
    angelpayAffiliation: '',
    angelpayMerchantName: '',
  })

  // Fetch providers for dropdown
  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-list'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
    enabled: open,
  })

  // Detect provider type
  const selectedProvider = providers.find(p => p.id === formData.providerId)
  const isBlumon = selectedProvider?.code?.toLowerCase().includes('blumon')
  const isAngelPay = selectedProvider?.code?.toUpperCase() === 'ANGELPAY'
  const isGenericProvider = !isBlumon && !isAngelPay
  // True when the External Merchant ID is auto-derived from another field
  // (Blumon serial, AngelPay afiliación or email). The user shouldn't see
  // the raw input in the main form — it's noise. The advanced section still
  // exposes it for power-user override.
  // For AngelPay we now bind `externalMerchantId` directly to the dedicated
  // numeric input inside <AngelPayFields>, so the legacy auto-derive (from
  // email / afiliación) no longer applies. Blumon keeps its auto-derive from
  // the serial number.
  const isAutoDerivedExternalId = isBlumon && !!formData.blumonSerialNumber

  // Inline venue picker: only shown when the operator opened the dialog
  // without a preset venue (i.e. from the page-level "Todos" filter) and
  // they picked the ANGELPAY processor (which needs a venue context).
  const showInlineVenuePicker = isAngelPay && !account && !venueId
  const effectiveVenueId = venueId ?? internalSelectedVenueId ?? undefined

  // Fetch venues for the inline picker. Only enabled when we actually need
  // to show it — keeps the dialog cheap to open for Blumon / other paths.
  const { data: venuesList = [], isLoading: venuesLoading } = useQuery({
    queryKey: ['superadmin-venues', 'manual-account-dialog'],
    queryFn: () => getAllVenues(true), // includeDemos — match MerchantAccounts page behavior
    enabled: open && showInlineVenuePicker,
  })

  // Reset the internal selection whenever the dialog closes or the operator
  // switches away from AngelPay. Avoids stale selections leaking across
  // separate "Crear Manual" sessions.
  useEffect(() => {
    if (!open || !isAngelPay) {
      setInternalSelectedVenueId(null)
      setTerminalsReady(false)
      setPendingMerchantsCount(0)
      setManualExpanded(false)
      setManualToggled(false)
    }
  }, [open, isAngelPay])

  // Task 54: when there's nothing to approve in Section C, default the
  // manual-entry collapsible stays COLLAPSED by default. The intended flow
  // is auto-discovery (TPV authenticates → reports merchants → admin approves
  // in this dialog). Manual entry is a true escape hatch — only expanded
  // when admin explicitly clicks the chevron. Auto-expanding on the no-pending
  // case was confusing because it made the manual form look required.
  useEffect(() => {
    if (!isAngelPay || manualToggled) return
    setManualExpanded(false)
  }, [isAngelPay, manualToggled])

  // Task 17: AngelPay requires an ACTIVE AngelPayUserAccount on the venue
  // before any MerchantAccount can be created (the server enforces this in
  // `createMerchantAccount` and returns 400). Fetch on demand only when the
  // operator picks ANGELPAY + a venue is in scope + we're creating (editing
  // existing accounts doesn't re-trip the gate). Returns `null` if the venue
  // has never been provisioned.
  const {
    data: angelpayAccount,
    isLoading: isLoadingAngelpayAccount,
  } = useQuery({
    queryKey: ['superadmin-angelpay-user-account', effectiveVenueId, 'manual-account-dialog'],
    queryFn: () => angelpayUserAccountAPI.get(effectiveVenueId as string),
    enabled: open && isAngelPay && !account && !!effectiveVenueId,
  })
  const angelpayPrereqOk = isAngelPay ? angelpayAccount?.status === 'ACTIVE' : true

  // Inline create-terminal mutation. Used by the "Registrar terminal NEXGO"
  // CTA inside DeviceCompatibilityBanner so the operator can satisfy the
  // hardware prereq without leaving this dialog. On success we invalidate
  // every terminals cache key so DeviceCompatibilityBanner re-fetches and
  // updates `deviceCompatible` automatically.
  const createTerminalMutation = useMutation({
    mutationFn: (data: CreateTerminalRequest) => terminalAPI.createTerminal(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      toast({ title: 'Terminal registrada' })
      setTerminalDialogOpen(false)
    },
    onError: (err: any) => {
      toast({
        title: 'Error al registrar terminal',
        description: err?.response?.data?.message || err?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  // Inline AngelPayUserAccount provisioning. Mirrors
  // `pages/Superadmin/Venues/AngelPayAccount.tsx` so the prereq alert in this
  // dialog can resolve without sending the operator to that subpage. On
  // success we invalidate every angelpay-account cache key so the prereq
  // Alert disappears automatically.
  const createAngelPayAccountMutation = useMutation({
    mutationFn: (payload: { email: string; pin?: string; environment: AngelPayEnvironment }) =>
      angelpayUserAccountAPI.create(effectiveVenueId!, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['superadmin-angelpay-user-account', effectiveVenueId] })
      queryClient.invalidateQueries({ queryKey: ['angelpay-account', effectiveVenueId] })
      toast({ title: 'Cuenta AngelPay conectada' })
      // No dialog to close — Section B's inline form is part of the wizard
      // body; the query invalidation above flips it to the "Conectada" chip
      // state automatically on the next render.
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo conectar la cuenta AngelPay',
        description: err?.response?.data?.message || err?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  useEffect(() => {
    if (account) {
      setFormData({
        providerId: account.providerId,
        externalMerchantId: account.externalMerchantId,
        alias: account.alias || '',
        displayName: account.displayName || '',
        active: account.active,
        displayOrder: account.displayOrder || 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: account.providerConfig ? JSON.stringify(account.providerConfig, null, 2) : '',
        blumonSerialNumber: account.blumonSerialNumber || '',
        blumonEnvironment: (account.blumonEnvironment as 'SANDBOX' | 'PRODUCTION') || 'SANDBOX',
        blumonBrand: (account.providerConfig as any)?.brand || 'PAX',
        blumonModel: (account.providerConfig as any)?.model || 'A910S',
        // For editing, hydrate the AngelPay fields from the stored
        // providerConfig (Task 17 schema) — falling back to legacy keys for
        // accounts created before the cutover.
        angelpayAffiliation:
          (account.providerConfig as any)?.angelpayAffiliation ?? (account.providerConfig as any)?.afiliacion ?? '',
        angelpayMerchantName:
          (account.providerConfig as any)?.angelpayMerchantName ?? (account.providerConfig as any)?.merchantName ?? '',
      })
    } else {
      setFormData({
        providerId: '',
        externalMerchantId: '',
        alias: '',
        displayName: '',
        active: true,
        displayOrder: 0,
        merchantId: '',
        apiKey: '',
        customerId: '',
        terminalId: '',
        providerConfig: '',
        blumonSerialNumber: '',
        blumonEnvironment: 'SANDBOX',
        blumonBrand: 'PAX',
        blumonModel: 'A910S',
        angelpayAffiliation: '',
        angelpayMerchantName: '',
      })
    }
  }, [account, open])

  const handleSubmit = async () => {
    if (!formData.providerId || !formData.externalMerchantId) return

    // Provider-specific validation
    if (!account) {
      if (isBlumon && !formData.blumonSerialNumber) return
      // Task 17: AngelPay creds live on AngelPayUserAccount (per-venue
      // email + PIN). The MerchantAccount form only needs the numeric
      // merchant id (already covered by `externalMerchantId` above) and
      // an affiliation number.
      if (isAngelPay && !formData.angelpayAffiliation) return
      if (isGenericProvider && (!formData.merchantId || !formData.apiKey)) return
    }

    setLoading(true)
    try {
      let credentials: MerchantAccountCredentials | undefined
      let providerConfig: any = undefined

      if (formData.providerConfig) {
        try {
          providerConfig = JSON.parse(formData.providerConfig)
        } catch {
          alert('JSON inválido en provider config')
          setLoading(false)
          return
        }
      }

      if (isAngelPay) {
        // Task 17 / SDK 1.0.5 cutover: credentials no longer live on
        // MerchantAccount — they're per-venue email+PIN on AngelPayUserAccount
        // (managed via /superadmin/venues/:venueId/angelpay-account, Task 16).
        // The backend ANGELPAY branch in createMerchantAccount detects the
        // provider code and stores a placeholder { encrypted, iv } blob; any
        // credentials sent from the client are intentionally ignored, but we
        // omit them entirely to keep the payload self-documenting.
        credentials = undefined
        providerConfig = {
          ...providerConfig,
          processor: 'ANGELPAY',
          angelpayAffiliation: formData.angelpayAffiliation,
          ...(formData.angelpayMerchantName ? { angelpayMerchantName: formData.angelpayMerchantName } : {}),
        }
      } else if (isBlumon) {
        credentials =
          formData.merchantId || formData.apiKey
            ? {
                merchantId: formData.merchantId,
                apiKey: formData.apiKey,
                customerId: formData.customerId || undefined,
                terminalId: formData.terminalId || undefined,
              }
            : undefined
        providerConfig = {
          ...providerConfig,
          brand: formData.blumonBrand,
          model: formData.blumonModel,
          environment: formData.blumonEnvironment,
          serialNumber: formData.blumonSerialNumber,
          manuallyCreated: true,
          status: 'PENDING_AFFILIATION',
        }
      } else {
        credentials = {
          merchantId: formData.merchantId,
          apiKey: formData.apiKey,
          customerId: formData.customerId || undefined,
          terminalId: formData.terminalId || undefined,
        }
      }

      const payload: any = {
        providerId: formData.providerId,
        externalMerchantId: formData.externalMerchantId,
        alias: formData.alias || undefined,
        // For AngelPay, prefer the operator-supplied merchant name as the
        // displayName when present; otherwise fall back to the existing
        // displayName field. This keeps backend `displayName` and the new
        // `providerConfig.angelpayMerchantName` consistent.
        displayName:
          (isAngelPay && formData.angelpayMerchantName) || formData.displayName || undefined,
        active: formData.active,
        displayOrder: formData.displayOrder,
        credentials,
        providerConfig,
      }

      // Task 17: forward venueId for any AngelPay creation. The backend
      // service-level guard (Task 10) requires it for the ANGELPAY branch
      // (assertVenueHasCompatibleTerminal + ACTIVE-AngelPayUserAccount check).
      // Blumon still works without venueId — legacy behavior preserved.
      // Uses `effectiveVenueId` so the inline picker selection (when the
      // dialog was opened from the "Todos" filter) is honored.
      if (effectiveVenueId && !account) {
        payload.venueId = effectiveVenueId
      }

      // Add Blumon-specific fields to payload
      if (isBlumon && formData.blumonSerialNumber) {
        payload.blumonSerialNumber = formData.blumonSerialNumber
        payload.blumonEnvironment = formData.blumonEnvironment
        payload.blumonMerchantId = formData.externalMerchantId
      }

      await onSave(payload)
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving account:', error)
    } finally {
      setLoading(false)
    }
  }

  // Task 54: AngelPay manual-entry detection. The wizard's primary path is
  // auto-discovery (operator clicks Approve per row in Section C — no
  // submit needed). The submit button only fires the legacy createMutation
  // when the operator filled the "Crear manualmente (avanzado)" fallback.
  // We detect that via the AngelPay-specific field set being populated.
  const isAngelPayManualPath = useMemo(
    () => isAngelPay && !account && !!formData.angelpayAffiliation && /^\d+$/.test(formData.externalMerchantId),
    [isAngelPay, account, formData.angelpayAffiliation, formData.externalMerchantId],
  )

  // Validation for submit button
  const isSubmitDisabled = () => {
    if (loading || !formData.providerId) return true
    if (account) return false // Editing — credentials already exist
    if (isBlumon) return !formData.externalMerchantId || !formData.blumonSerialNumber
    if (isAngelPay) {
      // Task 54: in the new wizard, submit is only meaningful when the
      // operator opted into the manual fallback in Section C. If they
      // didn't, the dialog acts as a viewer — the auto-discovery flow
      // commits per-row via Approve and never round-trips this submit.
      if (!isAngelPayManualPath) return true
      // Manual path — backend ANGELPAY branch still requires the legacy
      // gates (Task 10): numeric ID, venueId, ACTIVE AngelPayUserAccount,
      // and a compatible terminal. We've already filtered the wizard so
      // both terminals and account are ready, but defense in depth.
      if (!effectiveVenueId) return true
      if (!angelpayPrereqOk) return true
      if (!terminalsReady) return true
      return false
    }
    if (!formData.externalMerchantId) return true
    return !formData.merchantId || !formData.apiKey
  }

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* AngelPay wizard is wider (3 stacked sections) — give it more room. */}
      <DialogContent
        className={`${
          isAngelPay && !account ? 'sm:max-w-[760px]' : 'sm:max-w-[600px]'
        } max-h-[90vh] overflow-y-auto bg-background`}
      >
        <div>
          <DialogHeader>
            <DialogTitle>
              {account
                ? 'Editar Cuenta'
                : isAngelPay
                  ? 'Conectar Cuenta AngelPay'
                  : 'Crear Cuenta Manual'}
            </DialogTitle>
            <DialogDescription>
              {account
                ? 'Actualiza la información de la cuenta'
                : isAngelPay
                  ? 'Sigue los 3 pasos. La TPV descubrirá los merchants automáticamente; aquí los apruebas y asignas al slot.'
                  : 'Ingresa las credenciales manualmente'}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Provider */}
            <div className="grid gap-2">
              <Label>
                Procesador de Pago <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.providerId}
                onValueChange={value => setFormData({ ...formData, providerId: value })}
                disabled={!!account}
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue placeholder="Seleccionar procesador..." />
                </SelectTrigger>
                <SelectContent>
                  {providers
                    // Stripe Connect cannot be configured manually — it requires hosted
                    // onboarding per venue. Direct admins to the per-venue ecommerce flow.
                    .filter(provider => provider.code !== 'STRIPE_CONNECT')
                    .map(provider => (
                      <SelectItem key={provider.id} value={provider.id}>
                        {provider.name} ({provider.code})
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                ¿Buscas Stripe Connect? Se configura desde la página del venue en{' '}
                <span className="underline">/venues/&lt;slug&gt;/ecommerce-merchants</span>.
              </p>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* BLUMON-SPECIFIC FIELDS                             */}
            {/* ═══════════════════════════════════════════════════ */}
            {isBlumon && (
              <div className="border border-amber-500/30 rounded-lg p-4 space-y-4 bg-amber-500/5">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <CreditCard className="h-4 w-4" />
                  <span className="text-sm font-medium">Configuración Blumon</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Estos campos son necesarios para que la terminal encuentre esta cuenta. Puedes crearla ahora y cuando llegue la afiliación
                  usar "Auto-Fetch" para obtener las credenciales OAuth.
                </p>

                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label>
                      Serial Number del Terminal <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      value={formData.blumonSerialNumber}
                      onChange={e => {
                        const serial = e.target.value
                        setFormData({
                          ...formData,
                          blumonSerialNumber: serial,
                          externalMerchantId: serial ? `blumon_${serial}` : formData.externalMerchantId,
                          displayName: serial ? `Blumon ${formData.blumonBrand} ${formData.blumonModel} - ${serial}` : formData.displayName,
                        })
                      }}
                      placeholder="Ej: 2841548417"
                      className="bg-background border-input font-mono text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="grid gap-2">
                      <Label>Marca</Label>
                      <Select value={formData.blumonBrand} onValueChange={value => setFormData({ ...formData, blumonBrand: value })}>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAX">PAX</SelectItem>
                          <SelectItem value="Verifone">Verifone</SelectItem>
                          <SelectItem value="Ingenico">Ingenico</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Modelo</Label>
                      <Select value={formData.blumonModel} onValueChange={value => setFormData({ ...formData, blumonModel: value })}>
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A910S">A910S</SelectItem>
                          <SelectItem value="A920">A920</SelectItem>
                          <SelectItem value="A920Pro">A920Pro</SelectItem>
                          <SelectItem value="A77">A77</SelectItem>
                          <SelectItem value="IM30">IM30</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="grid gap-2">
                      <Label>Ambiente</Label>
                      <Select
                        value={formData.blumonEnvironment}
                        onValueChange={value => setFormData({ ...formData, blumonEnvironment: value as 'SANDBOX' | 'PRODUCTION' })}
                      >
                        <SelectTrigger className="bg-background border-input">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="SANDBOX">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-yellow-500" />
                              Sandbox
                            </span>
                          </SelectItem>
                          <SelectItem value="PRODUCTION">
                            <span className="flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-green-500" />
                              Producción
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* ANGELPAY-SPECIFIC PATH (Task 54 — inline 3-section wizard) */}
            {/*                                                       */}
            {/* Section A: Venue picker + Terminals list + create/    */}
            {/*            attach buttons. Operator never bounces to  */}
            {/*            the Terminals page.                        */}
            {/* Section B: AngelPay account connect form (inline)     */}
            {/*            OR compact "Conectada" status row.         */}
            {/* Section C: Discovered merchants (slot picker + approve) */}
            {/*            with "Crear manualmente" fallback as a     */}
            {/*            collapsible bypass.                        */}
            {/*                                                       */}
            {/* The standalone DeviceCompatibilityBanner from the old */}
            {/* Task 17 UX is now redundant in this path — the empty- */}
            {/* state of the terminals subsection already conveys     */}
            {/* "no NEXGO terminals" with actionable buttons.         */}
            {/* ═══════════════════════════════════════════════════ */}
            {isAngelPay && !account && (
              <div className="space-y-4">
                {/* SECTION A — Venue + Terminales */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">1. Venue y terminales</CardTitle>
                    <CardDescription className="text-xs">
                      AngelPay solo opera en terminales NEXGO. Asegura que este venue tenga al menos una.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {showInlineVenuePicker && (
                      <div className="grid gap-2">
                        <Label htmlFor="angelpay-venue-picker">
                          Venue <span className="text-destructive">*</span>
                        </Label>
                        <Select
                          value={internalSelectedVenueId ?? ''}
                          onValueChange={value => setInternalSelectedVenueId(value || null)}
                          disabled={venuesLoading}
                        >
                          <SelectTrigger id="angelpay-venue-picker" className="bg-background border-input">
                            <SelectValue placeholder={venuesLoading ? 'Cargando venues...' : 'Selecciona un venue'} />
                          </SelectTrigger>
                          <SelectContent>
                            {venuesList.map(v => (
                              <SelectItem key={v.id} value={v.id}>
                                {v.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {!effectiveVenueId && (
                      <Alert variant="destructive">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Selecciona un venue primero</AlertTitle>
                        <AlertDescription>
                          AngelPay requiere asociar la cuenta a un venue.
                          {showInlineVenuePicker
                            ? ' Usa el selector arriba.'
                            : ' Usa el filtro de venue para acotar el contexto antes de crear la cuenta.'}
                        </AlertDescription>
                      </Alert>
                    )}

                    {effectiveVenueId && (
                      <TerminalsSubsection
                        venueId={effectiveVenueId}
                        brand="NEXGO"
                        onReadyChange={setTerminalsReady}
                        onCreateTerminal={() => setTerminalDialogOpen(true)}
                        onAttachTerminal={() => setAttachTerminalOpen(true)}
                      />
                    )}
                  </CardContent>
                </Card>

                {/* SECTION B — Cuenta AngelPay (only after a venue is picked) */}
                {effectiveVenueId && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">2. Cuenta AngelPay</CardTitle>
                      <CardDescription className="text-xs">
                        Vincula el correo + PIN que AngelPay generó para este venue.
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <AngelPayAccountSection
                        venueId={effectiveVenueId}
                        account={angelpayAccount}
                        isLoading={isLoadingAngelpayAccount}
                        isPending={createAngelPayAccountMutation.isPending}
                        onConnect={(payload) => createAngelPayAccountMutation.mutate(payload)}
                      />
                    </CardContent>
                  </Card>
                )}

                {/* SECTION C — Merchants. Only renders when both gates pass. */}
                {effectiveVenueId && terminalsReady && angelpayPrereqOk && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">3. Merchants</CardTitle>
                      <CardDescription className="text-xs">
                        La TPV descubrirá los comercios automáticamente al primer cobro. Apruébalos y asígnalos a un slot.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <DiscoveredMerchantsSubsection
                        venueId={effectiveVenueId}
                        onPendingCountChange={setPendingMerchantsCount}
                      />

                      {/* Manual-entry fallback. Default open when no
                          discovered merchants are pending (operator needs a
                          path forward); collapsed once discovery kicks in. */}
                      <Collapsible
                        open={manualExpanded}
                        onOpenChange={(v) => {
                          setManualExpanded(v)
                          setManualToggled(true)
                        }}
                      >
                        <CollapsibleTrigger asChild>
                          <button
                            type="button"
                            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full text-left"
                          >
                            {manualExpanded ? (
                              <ChevronDown className="w-4 h-4" />
                            ) : (
                              <ChevronRight className="w-4 h-4" />
                            )}
                            Crear manualmente (avanzado)
                          </button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="mt-3 space-y-3">
                          <AngelPayFields
                            externalMerchantId={formData.externalMerchantId}
                            setExternalMerchantId={value => setFormData(prev => ({ ...prev, externalMerchantId: value }))}
                            angelpayAffiliation={formData.angelpayAffiliation}
                            setAngelpayAffiliation={value => setFormData(prev => ({ ...prev, angelpayAffiliation: value }))}
                            angelpayMerchantName={formData.angelpayMerchantName}
                            setAngelpayMerchantName={value => setFormData(prev => ({ ...prev, angelpayMerchantName: value }))}
                          />
                          <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                              <Label>Alias (interno)</Label>
                              <Input
                                value={formData.alias}
                                onChange={e => setFormData({ ...formData, alias: e.target.value })}
                                placeholder="Ej: cuenta-principal"
                                className="bg-background border-input"
                                autoComplete="off"
                                data-1p-ignore
                              />
                            </div>
                            <div className="grid gap-2">
                              <Label>Nombre para mostrar</Label>
                              <Input
                                value={formData.displayName}
                                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                                placeholder="Ej: Cuenta Caja 1"
                                className="bg-background border-input"
                                autoComplete="off"
                                data-1p-ignore
                              />
                            </div>
                          </div>
                        </CollapsibleContent>
                      </Collapsible>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Editing an existing AngelPay account: show a short read-only summary
                instead of the full form. PIN / email rotation is done via the
                AngelPayUserAccount page, not this dialog. */}
            {isAngelPay && account && (
              <Alert variant="default">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>Cuenta AngelPay existente</AlertTitle>
                <AlertDescription>
                  Para rotar PIN, cambiar correo o suspender la cuenta usa la página de cuenta AngelPay del venue.
                </AlertDescription>
              </Alert>
            )}

            {/* External Merchant ID
                Hidden in the main form when:
                  - It's auto-derivable from a Blumon serial; or
                  - The provider is AngelPay (AngelPayFields owns the input
                    inline with its other required fields and enforces digits-only).
                For those cases the user gets a read-only summary instead and
                the editable input only appears in "Configuración avanzada"
                below for power-user override. */}
            {!isAutoDerivedExternalId && !isAngelPay && (
              <div className="grid gap-2">
                <Label>
                  External Merchant ID <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.externalMerchantId}
                  onChange={e => setFormData({ ...formData, externalMerchantId: e.target.value })}
                  placeholder="ID único del comercio en el procesador"
                  className="bg-background border-input font-mono text-sm"
                  autoComplete="off"
                  data-1p-ignore
                />
              </div>
            )}
            {isAutoDerivedExternalId && formData.externalMerchantId && (
              <div className="text-xs text-muted-foreground">
                ID externo: <code className="bg-muted px-1 py-0.5 rounded font-mono">{formData.externalMerchantId}</code>{' '}
                <span className="opacity-60">(auto)</span>
              </div>
            )}

            {/* Alias + Display Name. Hidden for AngelPay create flow —
                the wizard's Section C "Crear manualmente (avanzado)"
                collapsible owns those fields. Always shown for editing,
                Blumon, and other providers. */}
            {(!isAngelPay || !!account) && (
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label>Alias (interno)</Label>
                  <Input
                    value={formData.alias}
                    onChange={e => setFormData({ ...formData, alias: e.target.value })}
                    placeholder="Ej: cuenta-principal"
                    className="bg-background border-input"
                    autoComplete="off"
                    data-1p-ignore
                  />
                </div>

                {/* Display Name — autoComplete off so the browser doesn't autofill the
                    logged-in user's email/name into a merchant display field. */}
                <div className="grid gap-2">
                  <Label>Nombre para mostrar</Label>
                  <Input
                    value={formData.displayName}
                    onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="Ej: Cuenta Caja 1"
                    className="bg-background border-input"
                    autoComplete="off"
                    data-1p-ignore
                  />
                </div>
              </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* GENERIC CREDENTIALS (Blumon optional / Other required) */}
            {/* Hidden for AngelPay — uses its own section above      */}
            {/* ═══════════════════════════════════════════════════ */}
            {!isAngelPay && (
              <div className="border border-border rounded-lg p-4 space-y-4 bg-muted/30">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">
                    Credenciales {isBlumon && <span className="text-muted-foreground font-normal">(Opcionales para Blumon)</span>}
                  </Label>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setShowCredentials(!showCredentials)}>
                    {showCredentials ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>

                {isBlumon && !account && (
                  <div className="flex items-start space-x-2 text-sm bg-amber-50 dark:bg-amber-950/50 p-3 rounded-md border border-amber-200 dark:border-amber-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-amber-600 dark:text-amber-400" />
                    <div className="text-amber-700 dark:text-amber-300">
                      <p className="font-medium">Para Blumon, las credenciales son opcionales</p>
                      <p className="text-xs mt-1">
                        Cuando llegue la afiliación, usa "Blumon Auto-Fetch" para obtener las credenciales OAuth automáticamente.
                      </p>
                    </div>
                  </div>
                )}

                {isGenericProvider && !account && (
                  <div className="flex items-start space-x-2 text-sm bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
                    <AlertCircle className="h-4 w-4 mt-0.5 shrink-0 text-blue-600 dark:text-blue-400" />
                    <p className="text-blue-700 dark:text-blue-300">Las credenciales se encriptarán automáticamente (AES-256-CBC)</p>
                  </div>
                )}

                <div className="grid gap-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Merchant ID {!account && isGenericProvider && <span className="text-destructive">*</span>}</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.merchantId}
                        onChange={e => setFormData({ ...formData, merchantId: e.target.value })}
                        placeholder={isBlumon ? 'Opcional - se obtiene con Auto-Fetch' : '••••••••'}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>API Key {!account && isGenericProvider && <span className="text-destructive">*</span>}</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.apiKey}
                        onChange={e => setFormData({ ...formData, apiKey: e.target.value })}
                        placeholder={isBlumon ? 'Opcional - se obtiene con Auto-Fetch' : '••••••••'}
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label>Customer ID (opcional)</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.customerId}
                        onChange={e => setFormData({ ...formData, customerId: e.target.value })}
                        placeholder="••••••••"
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>

                    <div className="grid gap-2">
                      <Label>Terminal ID (opcional)</Label>
                      <Input
                        type={showCredentials ? 'text' : 'password'}
                        value={formData.terminalId}
                        onChange={e => setFormData({ ...formData, terminalId: e.target.value })}
                        placeholder="••••••••"
                        className="bg-background border-input font-mono text-sm"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Provider Config (JSON) */}
            <Collapsible>
              <CollapsibleTrigger asChild>
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="w-4 h-4 transition-transform ui-expanded:rotate-90" />
                  Configuración avanzada
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3 space-y-3">
                {/* External Merchant ID override — shown in advanced for the
                    rare case where the user needs to override the auto-derived
                    value (e.g. afiliación changed but the legacy account in
                    the processor's portal kept a different ID). For Blumon
                    and AngelPay the field is hidden from the main form. */}
                {isAutoDerivedExternalId && (
                  <div className="grid gap-2">
                    <Label>External Merchant ID (override)</Label>
                    <Input
                      value={formData.externalMerchantId}
                      onChange={e => setFormData({ ...formData, externalMerchantId: e.target.value })}
                      placeholder={isBlumon ? 'blumon_SERIAL' : 'auto-generado'}
                      className="bg-background border-input font-mono text-xs"
                    />
                    <p className="text-xs text-muted-foreground">
                      Solo modifica esto si el ID auto-generado no coincide con el comercio registrado en el procesador.
                    </p>
                  </div>
                )}

                <div className="grid gap-2">
                  <Label>Provider Config (JSON)</Label>
                  <Textarea
                    value={formData.providerConfig}
                    onChange={e => setFormData({ ...formData, providerConfig: e.target.value })}
                    placeholder='{"webhookSecret": "whsec_...", "mode": "live"}'
                    rows={3}
                    className="bg-background border-input font-mono text-xs"
                  />
                </div>

                <div className="grid gap-2">
                  <Label>Orden de visualización</Label>
                  <Input
                    type="number"
                    value={formData.displayOrder}
                    onChange={e => setFormData({ ...formData, displayOrder: parseInt(e.target.value) || 0 })}
                    className="bg-background border-input w-24"
                  />
                </div>

                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="active"
                    checked={formData.active}
                    onCheckedChange={(checked: boolean) => setFormData({ ...formData, active: checked })}
                  />
                  <label htmlFor="active" className="text-sm font-medium cursor-pointer">
                    Cuenta activa
                  </label>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {/* Task 54: in the AngelPay wizard, the primary completion path
                  is per-row Approve in Section C (no submit). "Cerrar" is
                  more honest than "Cancelar" because there's nothing to
                  cancel — work is already committed. */}
              {isAngelPay && !account ? 'Cerrar' : 'Cancelar'}
            </Button>
            {/* Submit button is hidden in the AngelPay wizard until the
                operator opts into manual entry. Avoids the dead "Conectar"
                button that confused operators during the Task 17 era. */}
            {(!isAngelPay || !!account || isAngelPayManualPath) && (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitDisabled()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {account
                  ? 'Guardar Cambios'
                  : isAngelPay
                    ? 'Conectar manualmente'
                    : 'Crear Cuenta'}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    {/* Inline TerminalDialog — launched from Section A "Crear terminal
        nueva" CTA. TerminalDialog has its own venue picker (we can't
        pre-fill via prop), but the createTerminalMutation handles the save
        and TerminalsSubsection re-fetches via query invalidation. */}
    <TerminalDialog
      open={terminalDialogOpen}
      onOpenChange={setTerminalDialogOpen}
      terminal={null}
      onSave={async (data) => {
        await createTerminalMutation.mutateAsync(data)
      }}
    />

    {/* Task 54: AttachTerminalDialog — re-parent an existing NEXGO terminal
        from another venue. Replaces the previous "no compatible terminals"
        dead-end with an actionable second option. The old
        AngelPayConnectDialog mount was removed because Section B inlines
        the connect form via <AngelPayAccountSection>. */}
    {effectiveVenueId && (
      <AttachTerminalDialog
        open={attachTerminalOpen}
        onOpenChange={setAttachTerminalOpen}
        targetVenueId={effectiveVenueId}
        targetBrand="NEXGO"
      />
    )}
    </>
  )
}
