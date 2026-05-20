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
  type AngelPayUserAccount,
  type AngelPayVenuePaymentSlot,
} from '@/services/superadmin-angelpay-user-account.service'
import { paymentProviderAPI, type MerchantAccount, type MerchantAccountCredentials } from '@/services/paymentProvider.service'
import { getAllVenues } from '@/services/superadmin.service'
import { terminalAPI, type CreateTerminalRequest } from '@/services/superadmin-terminals.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertCircle, AlertTriangle, CheckCircle2, ChevronRight, CreditCard, Eye, EyeOff, Loader2, RefreshCw, Settings2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import React, { useEffect, useMemo, useState } from 'react'
import { TerminalDialog } from '../TerminalDialog'
import { AngelPayCreateTerminalDialog } from '../angelpay/AngelPayCreateTerminalDialog'
import { AngelPayAccountManageSheet } from '../angelpay/AngelPayAccountManageSheet'
import { AngelPayAccountSection } from './AngelPayAccountSection'
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
  /**
   * Returns the created/updated MerchantAccount (or void on update paths that
   * don't surface a return). The AngelPay manual path consumes `created.id`
   * to chain `approveDiscoveredMerchant` for slot assignment.
   */
  onSave: (data: any) => Promise<MerchantAccount | void>
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
  // Slot picker for the manual-entry AngelPay path. After createMutation creates
  // the MerchantAccount row, we chain a call to approveDiscoveredAngelPayMerchant
  // with this slot so the new merchant is atomically assigned to a
  // VenuePaymentConfig slot. Without this step the merchant exists in the DB
  // but isn't routable from the TPV (the /tpv/terminals/:serial/config endpoint
  // only returns merchants attached to a slot).
  const [manualSlot, setManualSlot] = useState<AngelPayVenuePaymentSlot>('PRIMARY')

  // State for the AngelPay "Reservar slot" placeholder flow (replaces manual
  // entry which was impossible to use — admins don't have the real Merchant ID
  // / Affiliation numbers, those come from AngelPay/TPV).
  const [reserveSlotChoice, setReserveSlotChoice] = useState<'AUTO' | AngelPayVenuePaymentSlot>('AUTO')
  const [reserveDisplayName, setReserveDisplayName] = useState('')
  // Multi-account: when venue has >1 AngelPay account, admin picks WHICH
  // account the placeholder belongs to. Empty string = no account link
  // (legacy path — placeholder gets upgraded by whichever account the TPV
  // authenticates with first).
  const [reserveAccountId, setReserveAccountId] = useState<string>('')
  // Multi-AngelPay accounts per venue (2026-05-18). When true, the connect
  // form is rendered alongside the existing account list so the operator can
  // add another login from the same dialog. Default false when there's at
  // least one existing account (list is shown); auto-true when there are none
  // (no list to render, so the form is the primary CTA).
  const [angelpayAddMode, setAngelpayAddMode] = useState(false)
  // Consolidated AngelPay account management (2026-05-19). Replaces the
  // legacy "Gestionar" link to the standalone /superadmin/venues/:id/angelpay-account
  // page. When set, AngelPayAccountManageSheet opens on top of this dialog
  // with rotate-PIN, force-rotation, suspend, and delete actions.
  const [manageSheetAccount, setManageSheetAccount] = useState<AngelPayUserAccount | null>(null)
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
  // effectiveVenueId resolution order:
  //   1. explicit prop (passed by MerchantAccounts page when a venue filter is set)
  //   2. inline picker selection (operator picked from "Todos" page filter)
  //   3. for AngelPay edit: derive from the account's linked AngelPayUserAccount
  //      (so "Pedir merchants" + account list lookups work without re-passing venueId)
  const editModeVenueId = (account as any)?.angelpayUserAccount?.venueId as string | undefined
  const effectiveVenueId = venueId ?? internalSelectedVenueId ?? editModeVenueId ?? undefined

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

  // Manual-entry collapsible auto-expand logic.
  //
  // The intended primary path is auto-discovery (TPV authenticates → reports
  // merchants → admin approves in Section C). Manual entry is the escape hatch.
  //
  // But when there's NOTHING to approve in Section C (no discovered merchants
  // yet — typical first-time onboarding, OR when the TPV's discovery flow can't
  // fire yet for any reason), the admin's ONLY path forward is manual entry.
  // Auto-expand in that case to surface the form immediately — otherwise the
  // dialog looks like a dead-end with no actionable "Crear" button.
  //
  // After admin clicks the chevron explicitly, their choice sticks
  // (manualToggled flag) — we don't fight their preference.
  useEffect(() => {
    if (!isAngelPay || manualToggled) return
    setManualExpanded(pendingMerchantsCount === 0)
  }, [isAngelPay, pendingMerchantsCount, manualToggled])

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
  // Multi-AngelPay accounts per venue (2026-05-18). Lists every AngelPay
  // user account assigned to this venue so the operator can manage more than
  // one login from the wizard. The legacy singular `angelpayAccount` query
  // above is kept for the wizard gates that still ask "is there an ACTIVE
  // account?" — the answer logically reduces to "any ACTIVE in the list".
  const {
    data: angelpayAccounts,
    isLoading: isLoadingAngelpayAccounts,
  } = useQuery({
    queryKey: ['superadmin-angelpay-accounts', effectiveVenueId],
    queryFn: () => angelpayUserAccountAPI.listForVenue(effectiveVenueId as string),
    // Enabled in both create AND edit flows. In edit mode the operator needs
    // to see the linked AngelPay account email + use "Pedir merchants" to
    // upgrade placeholders. effectiveVenueId may need to be derived from the
    // account's venue in edit mode if not passed as prop.
    enabled: open && isAngelPay && !!effectiveVenueId,
  })
  const angelpayAccountsList = angelpayAccounts ?? []
  // Wizard gate: ANY ACTIVE account satisfies the prereq (multi-account aware).
  // Fallback to the legacy singular field when the new list endpoint hasn't
  // populated yet (preserves behavior on the first render before the new
  // query resolves).
  const angelpayHasActive = angelpayAccountsList.some(acc => acc.status === 'ACTIVE')
  const angelpayPrereqOk = isAngelPay
    ? angelpayHasActive || angelpayAccount?.status === 'ACTIVE'
    : true

  // Inline create-terminal mutation. Used by the "Registrar terminal NEXGO"
  // CTA inside DeviceCompatibilityBanner so the operator can satisfy the
  // hardware prereq without leaving this dialog. On success we invalidate
  // every terminals cache key so DeviceCompatibilityBanner re-fetches and
  // updates `deviceCompatible` automatically.
  const createTerminalMutation = useMutation({
    mutationFn: (data: CreateTerminalRequest) => terminalAPI.createTerminal(data),
    onSuccess: () => {
      // Invalidate all known terminal query keys (with/without venue scoping)
      // so Section 1's TerminalsSubsection refreshes immediately.
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals', { venueId: effectiveVenueId }] })
      queryClient.invalidateQueries({ queryKey: ['terminals'] })
      queryClient.refetchQueries({ queryKey: ['superadmin-terminals'] })
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
      // Multi-AngelPay accounts per venue (2026-05-18) — also refresh the
      // multi-account list and collapse add-mode so the operator sees the new
      // account in the list immediately.
      queryClient.invalidateQueries({ queryKey: ['superadmin-angelpay-accounts', effectiveVenueId] })
      setAngelpayAddMode(false)
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

  // Multi-AngelPay accounts per venue (2026-05-18). Dispatches a
  // FETCH_ANGELPAY_MERCHANTS socket command to the venue's NEXGO terminal so
  // the TPV switches to the selected AngelPay account and re-reports its
  // merchants. We poll the discovered-merchants query for 30s after dispatch
  // (handled implicitly by react-query refetch on the Section C subsection
  // — invalidation here forces an immediate fetch).
  // Discovery-in-flight tracker: persistent loader UX after the dispatch HTTP
  // ACK returns. The dispatch is async (TPV picks up command via heartbeat ≤30s,
  // does SDK auth which takes ~5-30s, then POSTs report-discovered-merchants
  // back to backend). The dispatch mutation's `isPending` is true only for the
  // ~200ms POST → it'd clear the spinner before the merchants actually land.
  // This timestamp keeps the spinner up + the OTHER account's buttons disabled
  // until either: (a) we observe the merchants land in queries via the polling
  // sweeps below, or (b) a 90s fallback timer expires (covers worst-case
  // heartbeat + AngelPay QA timeout). Reset on any "Pedir merchants" click.
  const [pendingFetchUntil, setPendingFetchUntil] = useState<{
    accountId: string
    until: number
    startedAt: number
  } | null>(null)

  // Watch the global merchant-accounts list — when this query refetches with
  // fresher data than our pending click, the discovery has landed and we can
  // drop the spinner immediately instead of waiting for the 90s fallback. The
  // staleTime: 0 + the invalidate burst in fetchMerchantsMutation.onSuccess
  // (3, 6, 10, 15, 25, 45, 60s) drive frequent refetches, so the useEffect
  // below typically fires within ~10s of the TPV completing. Reproduced 2026-
  // 05-20: TPV reported 3 merchants at 11:10:37 → backend persisted at
  // 11:10:38 → without this effect the dashboard spinner stayed up for the
  // full 90s even though the merchants were already visible in the dialog.
  const {
    data: allMerchantAccounts = [],
    dataUpdatedAt: merchantAccountsUpdatedAt,
  } = useQuery({
    queryKey: ['merchant-accounts-all'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: open && isAngelPay,
    staleTime: 0,
  })

  useEffect(() => {
    if (!pendingFetchUntil) return
    // Require the cached data to have been refreshed strictly AFTER the click
    // (with a 1.5s grace to filter out the in-flight POST race that the
    // invalidateAll() inside onSuccess kicks off). Without the grace, the
    // very first invalidation immediately after dispatch ACK clears the
    // spinner BEFORE the TPV has even started authenticating — defeating the
    // whole point of the persistent loader.
    if (merchantAccountsUpdatedAt <= pendingFetchUntil.startedAt + 1500) return
    // Belt + suspenders: also require ≥1 merchant linked to this AngelPay
    // account. If the TPV reports 0 merchants (stale session, AngelPay error)
    // the spinner stays up until the 90s fallback timer — operator gets
    // visible feedback that something went wrong instead of a deceptive
    // "everything's fine" state.
    const linkedCount = allMerchantAccounts.filter(
      (ma: any) => ma.angelpayUserAccountId === pendingFetchUntil.accountId && ma.active,
    ).length
    if (linkedCount === 0) return
    setPendingFetchUntil(null)
  }, [pendingFetchUntil, merchantAccountsUpdatedAt, allMerchantAccounts])

  const fetchMerchantsMutation = useMutation({
    mutationFn: (angelpayUserAccountId: string) =>
      angelpayUserAccountAPI.fetchMerchantsFromTpv({
        venueId: effectiveVenueId as string,
        angelpayUserAccountId,
      }),
    onMutate: (angelpayUserAccountId: string) => {
      // 90s window covers: heartbeat receive (≤30s) + SDK 7-step auth + retries
      // + report POST + Prisma write. Adjust if AngelPay QA gets slower again.
      // `startedAt` is consumed by the observe-and-clear useEffect above so we
      // know which clicks have been satisfied by fresh server data.
      const now = Date.now()
      setPendingFetchUntil({ accountId: angelpayUserAccountId, until: now + 90_000, startedAt: now })
    },
    onSuccess: () => {
      toast({
        title: 'Comando enviado a TPV',
        description:
          'La TPV está autenticando; los merchants aparecerán automáticamente en ~10-30 seg.',
      })
      // Multi-key invalidation — TPV → backend report is async, so we hit
      // both the immediate paths AND a delayed sweep to catch the post-upsert
      // state. The schedule covers typical heartbeat receive (≤30s) + SDK
      // auth (2-30s w/ retries) + report POST (1s) + Prisma write (sub-second)
      // round-trips. Aggressive cadence so the operator sees merchants land
      // without manually refreshing.
      const invalidateAll = () => {
        queryClient.invalidateQueries({ queryKey: ['superadmin-discovered-merchants', effectiveVenueId] })
        queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
        queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
        queryClient.invalidateQueries({ queryKey: ['superadmin-angelpay-accounts', effectiveVenueId] })
        queryClient.invalidateQueries({ queryKey: ['venue-payment-config', effectiveVenueId] })
      }
      invalidateAll()
      // Burst at 3, 6, 10, 15, 25, 45, 60s — cheap because cached + 304
      ;[3, 6, 10, 15, 25, 45, 60].forEach(s => window.setTimeout(invalidateAll, s * 1000))
      // Fallback clear of the loader at 90s — by then merchants either
      // landed (loader already cleared by observed state — see useEffect)
      // or AngelPay QA is timing out and we should let the operator retry.
      window.setTimeout(() => {
        setPendingFetchUntil(prev => (prev && Date.now() >= prev.until ? null : prev))
      }, 90_000)
    },
    onError: (err: any) => {
      setPendingFetchUntil(null)
      toast({
        title: 'No se pudo enviar el comando',
        description: err?.response?.data?.message || err?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  const isAnyFetchInFlight =
    fetchMerchantsMutation.isPending ||
    (pendingFetchUntil != null && pendingFetchUntil.until > Date.now())

  // Reserve-slot mutation: creates a placeholder MerchantAccount + atomically
  // attaches to the chosen (or first empty) VenuePaymentConfig slot. The TPV
  // later upgrades the placeholder with real Merchant ID / Affiliation when
  // discovery fires.
  const reserveSlotMutation = useMutation({
    mutationFn: () => {
      if (!effectiveVenueId) {
        return Promise.reject(new Error('No venue selected'))
      }
      return angelpayUserAccountAPI.reserveSlot({
        venueId: effectiveVenueId,
        slot: reserveSlotChoice === 'AUTO' ? undefined : reserveSlotChoice,
        displayName: reserveDisplayName.trim() || undefined,
        angelpayUserAccountId: reserveAccountId || undefined,
      })
    },
    onSuccess: (data) => {
      // Force-refetch ALL relevant queries so the dialog reflects the new
      // placeholder immediately (slot occupancy banner + discovered list +
      // accounts list + merchant accounts list).
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config', effectiveVenueId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-discovered-merchants', effectiveVenueId] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-angelpay-accounts', effectiveVenueId] })
      queryClient.refetchQueries({ queryKey: ['superadmin-discovered-merchants', effectiveVenueId] })
      toast({
        title: 'Slot reservado',
        description: `Placeholder creado en slot ${data.slot}. Cuando la TPV autentique, los datos del comercio se autocompletarán aquí.`,
      })
      // Reset form so admin can immediately reserve another (e.g., for a different account).
      setReserveDisplayName('')
      // Keep reserveSlotChoice as-is (likely AUTO) so consecutive clicks just work.
      setReserveDisplayName('')
      setReserveSlotChoice('AUTO')
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || err?.message || 'Error desconocido'
      toast({
        title: err?.response?.status === 409 ? 'Slot ocupado' : 'No se pudo reservar el slot',
        description: msg,
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

      const created = await onSave(payload)

      // AngelPay manual path: after createMerchantAccount succeeds, atomically
      // assign the new MerchantAccount to the chosen VenuePaymentConfig slot.
      // Without this, the merchant exists in the DB but isn't routable from the
      // TPV — the /tpv/terminals/:serial/config endpoint only returns merchants
      // attached to a slot.
      //
      // We use the same approve endpoint as the discovered flow so all slot
      // assignment paths converge on a single backend transaction (atomic
      // flip-active + slot write + per-terminal assignment).
      // Narrow `void | MerchantAccount` to MerchantAccount — TS won't do this
      // through optional chaining on a union containing void, so we destructure.
      const createdAccount: MerchantAccount | undefined =
        created && typeof created === 'object' && 'id' in created ? created : undefined

      if (isAngelPay && !account && effectiveVenueId && createdAccount) {
        try {
          await angelpayUserAccountAPI.approveDiscoveredMerchant({
            venueId: effectiveVenueId,
            merchantAccountId: createdAccount.id,
            slot: manualSlot,
          })
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
          queryClient.invalidateQueries({ queryKey: ['venue-payment-config', effectiveVenueId] })
          toast({
            title: 'Merchant creado y asignado',
            description: `Asignado al slot ${manualSlot} del venue.`,
          })
        } catch (err: any) {
          const msg = err?.response?.data?.message || err?.message || 'Error desconocido'
          if (err?.response?.status === 409) {
            toast({
              title: 'Slot ocupado',
              description: `${msg}. El merchant se creó pero no se asignó — escoge otro slot y vuelve a intentar.`,
              variant: 'destructive',
            })
          } else {
            toast({
              title: 'Merchant creado, error asignando slot',
              description: msg,
              variant: 'destructive',
            })
          }
          // Don't close the dialog — let admin retry the slot assignment.
          return
        }
      }

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
              {/* Stripe hint only when provider isn't already an inline-managed one.
                  For AngelPay (wizard handles everything inline) and Blumon (auto-fetch
                  flow), the Stripe reference is noise. */}
              {!isAngelPay && !isBlumon && (
                <p className="text-xs text-muted-foreground">
                  ¿Buscas Stripe Connect? Se configura desde la página del venue en{' '}
                  <span className="underline">/venues/&lt;slug&gt;/ecommerce-merchants</span>.
                </p>
              )}
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

                {/* SECTION B — Cuentas AngelPay (only after a venue is picked).
                    Multi-AngelPay accounts per venue (2026-05-18): renders the
                    full list of AngelPayUserAccount rows for the venue with a
                    "Pedir merchants" button per row (dispatches the
                    FETCH_ANGELPAY_MERCHANTS socket command) and a "Gestionar"
                    link to the dedicated page for advanced ops. The legacy
                    `AngelPayAccountSection` connect form is kept as the
                    primary CTA when the list is empty AND as a togglable
                    "add another" form below the list when ≥1 already exists. */}
                {effectiveVenueId && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">2. Cuentas AngelPay</CardTitle>
                      <CardDescription className="text-xs">
                        Vincula uno o varios correos + PIN que AngelPay generó para este venue.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {isLoadingAngelpayAccounts && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Cargando cuentas AngelPay…
                        </div>
                      )}

                      {!isLoadingAngelpayAccounts && angelpayAccountsList.length > 0 && (
                        <div className="space-y-2">
                          {angelpayAccountsList.map(acc => {
                            const statusBadgeClass =
                              acc.status === 'ACTIVE'
                                ? 'bg-green-100 text-green-800 hover:bg-green-100'
                                : acc.status === 'PENDING_PIN'
                                ? 'bg-amber-100 text-amber-800 hover:bg-amber-100'
                                : acc.status === 'SUSPENDED' || acc.status === 'DELETED'
                                ? 'bg-red-100 text-red-800 hover:bg-red-100'
                                : 'bg-muted text-muted-foreground hover:bg-muted'
                            // "Fetching this" now includes the persistent 90s window
                            // after dispatch ACK (not just the dispatch HTTP call) so
                            // the spinner stays up while the TPV does the real work.
                            const isFetchingThis =
                              (fetchMerchantsMutation.isPending && fetchMerchantsMutation.variables === acc.id) ||
                              pendingFetchUntil?.accountId === acc.id
                            return (
                              <div
                                key={acc.id}
                                className="rounded-md border border-border bg-background p-3 space-y-2"
                              >
                                <div className="flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <Badge className={statusBadgeClass}>
                                      {acc.status === 'ACTIVE' && <CheckCircle2 className="w-3 h-3 mr-1" />}
                                      {acc.status}
                                    </Badge>
                                    <span className="font-mono text-sm truncate">{acc.email}</span>
                                    <Badge variant="outline" className="text-xs">
                                      {acc.environment}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="outline"
                                    // Disable ALL Pedir buttons (this one + every
                                    // other account's) while ANY request is in flight.
                                    // Prevents the operator from queueing multiple
                                    // account switches that would step on each other's
                                    // SDK session and cause the cross-account race we
                                    // hit yesterday (contacto@ switch interrupting
                                    // ventas@'s in-flight auth).
                                    disabled={acc.status !== 'ACTIVE' || isAnyFetchInFlight}
                                    onClick={() => fetchMerchantsMutation.mutate(acc.id)}
                                    title={
                                      acc.status !== 'ACTIVE'
                                        ? 'La cuenta debe estar ACTIVE para pedir merchants'
                                        : isAnyFetchInFlight && !isFetchingThis
                                        ? 'Espera a que termine el comando en flight de otra cuenta'
                                        : 'Pide a la TPV que cambie a esta cuenta y reporte sus merchants'
                                    }
                                  >
                                    {isFetchingThis ? (
                                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    ) : (
                                      <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                    )}
                                    Pedir merchants
                                  </Button>
                                  <Button
                                    type="button"
                                    size="sm"
                                    variant="ghost"
                                    className="text-xs h-8 px-2 text-primary hover:text-primary"
                                    onClick={() => setManageSheetAccount(acc)}
                                    title="Rotar PIN, suspender o eliminar esta cuenta"
                                  >
                                    <Settings2 className="w-3.5 h-3.5 mr-1.5" />
                                    Gestionar
                                  </Button>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}

                      {!isLoadingAngelpayAccounts && (angelpayAccountsList.length === 0 || angelpayAddMode) && (
                        <div className="rounded-md border border-dashed border-muted-foreground/30 p-3">
                          {angelpayAccountsList.length > 0 && (
                            <p className="text-xs text-muted-foreground mb-2">
                              Añadir otra cuenta AngelPay para este venue (multi-login).
                            </p>
                          )}
                          <AngelPayAccountSection
                            venueId={effectiveVenueId}
                            // Pass null so AngelPayAccountSection always renders
                            // the connect form (multi-account list above handles
                            // the "Conectada" status row for existing accounts).
                            account={null}
                            isLoading={false}
                            isPending={createAngelPayAccountMutation.isPending}
                            onConnect={payload => createAngelPayAccountMutation.mutate(payload)}
                          />
                        </div>
                      )}

                      {!isLoadingAngelpayAccounts && angelpayAccountsList.length > 0 && !angelpayAddMode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setAngelpayAddMode(true)}
                        >
                          + Añadir otra cuenta AngelPay
                        </Button>
                      )}
                      {!isLoadingAngelpayAccounts && angelpayAccountsList.length > 0 && angelpayAddMode && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="w-full"
                          onClick={() => setAngelpayAddMode(false)}
                        >
                          Cancelar
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                )}

                {/* SECTION C teaser — visible when gates AREN'T satisfied yet so
                    operator sees the full 3-step path from the start (matches the
                    "Sigue los 3 pasos" promise in the dialog subtitle). */}
                {effectiveVenueId && (!terminalsReady || !angelpayPrereqOk) && (
                  <Card className="opacity-60">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base text-muted-foreground">3. Merchants <span className="text-xs font-normal">(disponible después)</span></CardTitle>
                      <CardDescription className="text-xs">
                        {!terminalsReady && !angelpayPrereqOk
                          ? 'Disponible después de registrar una terminal NEXGO y conectar una cuenta AngelPay.'
                          : !terminalsReady
                          ? 'Disponible después de registrar una terminal NEXGO arriba.'
                          : 'Disponible después de conectar al menos una cuenta AngelPay arriba.'}
                      </CardDescription>
                    </CardHeader>
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

                      {/* Reserve-slot button: admin clicks ONE button to create
                          a placeholder MerchantAccount + atomically attach to a
                          slot. No fields required (admin doesn't have the real
                          Merchant ID / Affiliation — those come from AngelPay
                          itself). When the TPV authenticates + reports, the
                          backend upserts the placeholder in-place with the
                          real numeric ID, affiliation, name, and flips active=true.
                          The slot assignment is preserved across the upgrade.

                          For multi-merchant venues (login has N>1 merchants),
                          admin can click Reservar multiple times to reserve N
                          slots; TPV upgrades them in discovery order. */}
                      <div className="rounded-md border border-dashed border-muted-foreground/30 p-4 space-y-3">
                        <div className="space-y-1">
                          <Label className="text-sm font-semibold">Reservar slot AngelPay</Label>
                          <p className="text-xs text-muted-foreground">
                            Crea un placeholder en el siguiente slot vacío del venue. Los datos del comercio
                            (Merchant ID, Afiliación) se autocompletan cuando la TPV autentica con AngelPay.
                            Si tu cuenta tiene varios comercios, haz click una vez por cada slot que necesites.
                          </p>
                        </div>
                        {/* Account picker — only shown when there are 2+
                            ACTIVE accounts. Single-account venues fall through
                            to the legacy "no link" path (placeholder takes
                            whatever account TPV authenticates with). */}
                        {angelpayAccountsList.filter(a => a.status === 'ACTIVE').length > 1 && (
                          <div className="grid gap-2">
                            <Label className="text-xs">Cuenta AngelPay *</Label>
                            <Select
                              value={reserveAccountId || ''}
                              onValueChange={(v) => setReserveAccountId(v)}
                            >
                              <SelectTrigger className="bg-background border-input">
                                <SelectValue placeholder="Selecciona la cuenta a vincular" />
                              </SelectTrigger>
                              <SelectContent>
                                {angelpayAccountsList
                                  .filter(a => a.status === 'ACTIVE')
                                  .map(a => (
                                    <SelectItem key={a.id} value={a.id}>
                                      {a.email} ({a.environment})
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>
                            <p className="text-xs text-muted-foreground">
                              Cada placeholder se vincula a una cuenta AngelPay. La TPV solo
                              completará placeholders cuya cuenta coincida con la que está autenticada.
                            </p>
                          </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                          <div className="grid gap-2">
                            <Label className="text-xs">Slot (opcional)</Label>
                            <Select
                              value={reserveSlotChoice}
                              onValueChange={(v) => setReserveSlotChoice(v as 'AUTO' | AngelPayVenuePaymentSlot)}
                            >
                              <SelectTrigger className="bg-background border-input">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="AUTO">Auto (primer vacío)</SelectItem>
                                <SelectItem value="PRIMARY">Principal</SelectItem>
                                <SelectItem value="SECONDARY">Secundario</SelectItem>
                                <SelectItem value="TERTIARY">Terciario</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label className="text-xs">Etiqueta (opcional)</Label>
                            <Input
                              value={reserveDisplayName}
                              onChange={(e) => setReserveDisplayName(e.target.value)}
                              placeholder="Ej: Madre Café Rooftop"
                              className="bg-background border-input"
                            />
                          </div>
                        </div>
                        <Button
                          type="button"
                          onClick={() => reserveSlotMutation.mutate()}
                          disabled={
                            reserveSlotMutation.isPending ||
                            (angelpayAccountsList.filter(a => a.status === 'ACTIVE').length > 1 && !reserveAccountId)
                          }
                          className="w-full"
                        >
                          {reserveSlotMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                          + Reservar slot AngelPay
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}

            {/* Editing an existing AngelPay merchant: show read-only summary
                with all relevant info (placeholder vs real, linked account,
                affiliation, slot). The legacy "Use the AngelPay page" alert
                hid this critical info — admin had no way to verify what they
                were actually editing. PIN/account rotation still happens via
                the management sheet (in the parent flow). */}
            {isAngelPay && account && (() => {
              const isPlaceholder = account.externalMerchantId?.startsWith('AWAITING_') ?? false
              const linkedAccountId = (account as any).angelpayUserAccountId as string | null | undefined
              return (
                <div className="space-y-3">
                  {isPlaceholder ? (
                    <Alert variant="default" className="border-amber-500/40 bg-amber-500/10">
                      <AlertCircle className="h-4 w-4 text-amber-600" />
                      <AlertTitle className="text-amber-700 dark:text-amber-300">Placeholder — esperando TPV</AlertTitle>
                      <AlertDescription className="text-xs space-y-1">
                        <p>Este es un slot reservado, sin datos reales de AngelPay todavía.</p>
                        <p>Cuando la TPV autentique con la cuenta AngelPay vinculada, este placeholder se completará automáticamente con el Merchant ID y Afiliación reales, y pasará a estado <strong>Activo</strong>.</p>
                        <p className="text-muted-foreground">Para forzar la actualización ahora: usa el botón <strong>"Pedir merchants"</strong> en la cuenta AngelPay vinculada (Section 2 del wizard).</p>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Alert variant="default">
                      <AlertCircle className="h-4 w-4" />
                      <AlertTitle>Merchant AngelPay real</AlertTitle>
                      <AlertDescription className="text-xs">
                        Para rotar PIN / suspender la cuenta AngelPay, usa el botón "Gestionar" en Section 2 del wizard.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Read-only summary panel */}
                  <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Merchant ID</Label>
                        <p className="font-mono mt-0.5 break-all">
                          {isPlaceholder ? (
                            <span className="text-amber-700 dark:text-amber-300">
                              {account.externalMerchantId} <span className="text-muted-foreground">(placeholder)</span>
                            </span>
                          ) : (
                            account.externalMerchantId
                          )}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Afiliación</Label>
                        <p className="font-mono mt-0.5">
                          {(account as any).angelpayAffiliation === 'PENDING' || !(account as any).angelpayAffiliation
                            ? <span className="text-amber-700 dark:text-amber-300">PENDING</span>
                            : (account as any).angelpayAffiliation}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Cuenta AngelPay vinculada</Label>
                        <p className="font-mono mt-0.5 break-all">
                          {(() => {
                            // Three sources, in order: backend include (most reliable
                            // in edit mode), in-memory accounts list (only populated
                            // when venueId is in scope), raw FK id (worst-case
                            // fallback so admin at least sees SOMETHING).
                            const includedEmail = (account as any).angelpayUserAccount?.email as string | undefined
                            const listEmail = linkedAccountId
                              ? angelpayAccountsList.find(a => a.id === linkedAccountId)?.email
                              : undefined
                            const email = includedEmail || listEmail
                            if (email) return email
                            if (linkedAccountId) return <span className="text-muted-foreground">{linkedAccountId} (id)</span>
                            return <span className="text-muted-foreground">Sin vincular (auto-discovery)</span>
                          })()}
                        </p>
                      </div>
                      <div>
                        <Label className="text-[10px] uppercase tracking-wide text-muted-foreground">Estado</Label>
                        <p className="mt-0.5">
                          {account.active
                            ? <span className="text-emerald-600">Activo</span>
                            : <span className="text-amber-700 dark:text-amber-300">Esperando TPV</span>}
                        </p>
                      </div>
                    </div>

                  </div>

                  {/* Cuentas AngelPay del venue — full list (not just the linked
                      one) so the operator can manage any of them from the merchant
                      edit dialog without context-switching back to the AngelPay
                      wizard. Each row exposes a "Gestionar" CTA that opens the
                      AngelPayAccountManageSheet (rotate PIN, force rotation,
                      suspend, delete + merchants asociados list). The currently-
                      linked account is highlighted with a "Vinculada" badge so
                      the operator can quickly see which one owns this merchant. */}
                  {angelpayAccountsList.length > 0 && (
                    <div className="rounded-md border bg-card p-3 space-y-2">
                      <div className="flex items-baseline justify-between">
                        <Label className="text-xs font-semibold">Cuentas AngelPay del venue</Label>
                        <span className="text-[10px] text-muted-foreground">
                          {angelpayAccountsList.length} cuenta{angelpayAccountsList.length === 1 ? '' : 's'}
                        </span>
                      </div>
                      <div className="space-y-1.5">
                        {angelpayAccountsList.map(acct => {
                          const isLinked = acct.id === linkedAccountId
                          return (
                            <div
                              key={acct.id}
                              className={`flex items-center justify-between gap-2 rounded border px-2.5 py-1.5 text-xs ${
                                isLinked ? 'border-primary/40 bg-primary/5' : 'border-border'
                              }`}
                            >
                              <div className="min-w-0 flex-1 flex items-center gap-2">
                                <span className="font-mono truncate">{acct.email}</span>
                                <Badge variant="outline" className="text-[9px] h-4 px-1">
                                  {acct.environment}
                                </Badge>
                                {isLinked && (
                                  <Badge className="text-[9px] h-4 px-1 bg-primary/15 text-primary border-primary/30 hover:bg-primary/15">
                                    Vinculada
                                  </Badge>
                                )}
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-6 px-2"
                                onClick={() => setManageSheetAccount(acct)}
                              >
                                <Settings2 className="w-3 h-3 mr-1" />
                                <span className="text-[10px]">Gestionar</span>
                              </Button>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Inline "Pedir merchants" for placeholders — dashboard sends
                      socket command to TPV which switches to the linked account,
                      authenticates, reports merchants. Backend upgrades this
                      placeholder in-place with real IDs. Removes the need to
                      reopen the AngelPay wizard. */}
                  {isPlaceholder && linkedAccountId && (
                    <div className="rounded-md border border-primary/40 bg-primary/5 p-3 space-y-2">
                      <p className="text-xs">
                        Esta cuenta vinculada (<strong>{(account as any).angelpayUserAccount?.email ?? angelpayAccountsList.find(a => a.id === linkedAccountId)?.email ?? linkedAccountId}</strong>) puede activarse ahora si una TPV NEXGO está conectada al venue.
                      </p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={fetchMerchantsMutation.isPending}
                        onClick={() => fetchMerchantsMutation.mutate(linkedAccountId)}
                      >
                        {fetchMerchantsMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        Pedir merchants a la TPV ahora
                      </Button>
                      <p className="text-[10px] text-muted-foreground">
                        Manda un socket command a la TPV. La TPV cambia a la cuenta vinculada, autentica contra AngelPay, y reporta sus merchants. Backend upgradea este placeholder con los IDs reales (~10-15 seg).
                      </p>
                    </div>
                  )}

                  {/* Placeholder sin cuenta vinculada — surface the gap so admin
                      knows why "Pedir merchants" isn't available here. */}
                  {isPlaceholder && !linkedAccountId && (
                    <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs space-y-1">
                      <p className="font-medium text-amber-700 dark:text-amber-300">Placeholder sin cuenta AngelPay vinculada</p>
                      <p>
                        Este placeholder fue creado en modo "auto-discovery" — se actualizará con cualquier merchant que la TPV reporte primero. Si tienes varias cuentas AngelPay activas y quieres control específico, considera eliminarlo y crear uno vinculado a la cuenta correcta desde el wizard.
                      </p>
                    </div>
                  )}
                </div>
              )
            })()}

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

            {/* Provider Config (JSON) — hidden for AngelPay path which has its
                own dedicated configuration UI (reserve slot, account selector).
                The advanced section was a holdover from the generic dialog era. */}
            {!(isAngelPay && !account) && (
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
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              {/* Task 54: in the AngelPay wizard, the primary completion path
                  is per-row Approve in Section C (no submit). "Cerrar" is
                  more honest than "Cancelar" because there's nothing to
                  cancel — work is already committed. */}
              {isAngelPay && !account ? 'Cerrar' : 'Cancelar'}
            </Button>
            {/* For AngelPay (non-edit), there is no submit action at all —
                the only path to create merchants is auto-discovery from the
                TPV. The dialog is purely informational: shows venue/terminal/
                account status + discovered merchants. Operator closes when done.
                For all other providers (and AngelPay edit), keep the normal
                submit button. */}
            {!(isAngelPay && !account) && (
              <Button type="button" onClick={handleSubmit} disabled={isSubmitDisabled()}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {account ? 'Guardar Cambios' : 'Crear Cuenta'}
              </Button>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>

    {/* Crear terminal — two flavors:
        - AngelPay path: AngelPayCreateTerminalDialog hardcodes brand=NEXGO,
          venue=current, auto-generates activation code, no merchant assignment
          UI (irrelevant — merchants come from AngelPay discovery, not manual).
        - Other providers: generic TerminalDialog with full pickers.

        The generic dialog used to be used here for AngelPay too but it
        defaulted brand=PAX, which silently bypassed TerminalsSubsection's
        NEXGO filter and gave the appearance of "create succeeded but
        terminal not visible". */}
    {isAngelPay && effectiveVenueId ? (
      <AngelPayCreateTerminalDialog
        open={terminalDialogOpen}
        onOpenChange={setTerminalDialogOpen}
        venueId={effectiveVenueId}
        venueName={venuesList.find(v => v.id === effectiveVenueId)?.name}
        onCreated={() => {
          // Belt-and-suspenders: also force-refresh from the parent in case
          // any state in the wizard depends on the new terminal.
          queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
          queryClient.refetchQueries({ queryKey: ['superadmin-terminals'] })
        }}
      />
    ) : (
      <TerminalDialog
        open={terminalDialogOpen}
        onOpenChange={setTerminalDialogOpen}
        terminal={null}
        onSave={async (data) => {
          await createTerminalMutation.mutateAsync(data)
        }}
      />
    )}

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
        onSwitchToCreate={() => {
          // Empty-state escape hatch: when there are no other-venue NEXGO
          // terminals to attach, close the attach dialog + open the create one.
          // Eliminates the "close, then click the other button" dance.
          setAttachTerminalOpen(false)
          setTerminalDialogOpen(true)
        }}
      />
    )}

    {/* Consolidated AngelPay account management (2026-05-19). Replaces the
        deleted standalone page. Mutations invalidate the same multi-account
        list query the dialog reads from, so the row's status badge updates
        live without closing the sheet. */}
    {manageSheetAccount && (
      <AngelPayAccountManageSheet
        open={true}
        onOpenChange={v => {
          if (!v) setManageSheetAccount(null)
        }}
        account={manageSheetAccount}
        onChange={() => {
          queryClient.invalidateQueries({
            queryKey: ['superadmin-angelpay-accounts', effectiveVenueId],
          })
          // The legacy singular account query — kept for wizard gates.
          queryClient.invalidateQueries({
            queryKey: ['superadmin-angelpay-user-account', effectiveVenueId, 'manual-account-dialog'],
          })
          queryClient.invalidateQueries({ queryKey: ['angelpay-account', effectiveVenueId] })
          // MerchantAccount rows for the venue may go inactive when an AngelPay
          // account is suspended/deleted — keep the merchant lists fresh too.
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
          queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
        }}
      />
    )}
    </>
  )
}
