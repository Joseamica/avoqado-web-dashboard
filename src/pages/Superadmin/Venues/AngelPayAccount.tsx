/**
 * AngelPay account management page (Task 16 — Phase 2 dashboard).
 *
 * Operator UX for the per-venue AngelPay user account row managed by the
 * backend service in `avoqado-server/src/services/superadmin/angelpayUserAccount.service.ts`.
 *
 * URL: `/superadmin/venues/:venueId/angelpay-account`
 *
 * Two render states:
 *  1. Empty state — no AngelPay account exists for the venue. Shows a single
 *     "Crear cuenta AngelPay" CTA that opens a Create dialog (email +
 *     optional 6-digit PIN + QA/PROD environment selector).
 *  2. Existing account state — header with email + colored StatusChip,
 *     read-only detail card, and status-gated action buttons (rotate PIN,
 *     mark for rotation, suspend, delete).
 *
 * NOT exposed on purpose:
 *  - DELETED → ACTIVE restore: by design, this requires `setPin()` which is
 *    audit-worthy and goes through the rotate-PIN dialog (after recreating
 *    the row if it was DELETED).
 *  - Status transition to ACTIVE: only the backend `setPin()` endpoint can
 *    transition to ACTIVE; the UI never exposes an "Activate" button.
 *
 * Spec ref: §5.1, §18.2.
 */

import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, ShieldAlert, ShieldOff, Trash2, XCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'

import {
  angelpayUserAccountAPI,
  type AngelPayAccountStatus,
  type AngelPayEnvironment,
  type AngelPayUserAccount,
  type AngelPayVenuePaymentSlot,
} from '@/services/superadmin-angelpay-user-account.service'
import { paymentProviderAPI, type MerchantAccount, type VenuePaymentConfig } from '@/services/paymentProvider.service'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AngelPayConnectDialog } from '../components/angelpay/AngelPayConnectDialog'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_LABELS: Record<AngelPayAccountStatus, string> = {
  ACTIVE: 'Activa',
  PENDING_PIN: 'PIN pendiente',
  PIN_ROTATION_REQUIRED: 'Rotación de PIN requerida',
  SUSPENDED: 'Suspendida',
  DELETED: 'Eliminada',
}

const STATUS_CHIP_CLASSES: Record<AngelPayAccountStatus, string> = {
  ACTIVE: 'bg-green-100 text-green-800 hover:bg-green-100',
  PENDING_PIN: 'bg-gray-100 text-gray-700 hover:bg-gray-100',
  PIN_ROTATION_REQUIRED: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  SUSPENDED: 'bg-red-100 text-red-800 hover:bg-red-100',
  DELETED: 'bg-gray-50 text-gray-500 hover:bg-gray-50',
}

const PIN_REGEX = /^\d{6}$/

function StatusChip({ status }: { status: AngelPayAccountStatus }) {
  return <Badge className={STATUS_CHIP_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'Sin registro'
  try {
    return formatDistanceToNow(new Date(iso), { addSuffix: true, locale: es })
  } catch {
    return iso
  }
}

function formatAbsolute(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleString('es-MX')
  } catch {
    return iso
  }
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AngelPayAccount() {
  const { venueId } = useParams<{ venueId: string }>()
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [createOpen, setCreateOpen] = useState(false)
  const [rotateOpen, setRotateOpen] = useState(false)
  const [markRotationOpen, setMarkRotationOpen] = useState(false)
  const [suspendOpen, setSuspendOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showFullError, setShowFullError] = useState(false)

  const {
    data: account,
    isLoading,
    isError,
    error,
  } = useQuery<AngelPayUserAccount | null>({
    queryKey: ['angelpay-account', venueId],
    queryFn: () => angelpayUserAccountAPI.get(venueId!),
    enabled: !!venueId,
  })

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['angelpay-account', venueId] })

  const handleApiError = (err: unknown, fallbackTitle: string) => {
    const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
    toast({
      title: fallbackTitle,
      description: anyErr?.response?.data?.message || anyErr?.message || 'Error desconocido',
      variant: 'destructive',
    })
  }

  // -------------------- Mutations --------------------
  const createMutation = useMutation({
    mutationFn: (payload: { email: string; pin?: string; environment: AngelPayEnvironment }) =>
      angelpayUserAccountAPI.create(venueId!, payload),
    onSuccess: () => {
      toast({ title: 'Cuenta AngelPay creada' })
      setCreateOpen(false)
      invalidate()
    },
    onError: (err) => handleApiError(err, 'No se pudo crear la cuenta AngelPay'),
  })

  const setPinMutation = useMutation({
    mutationFn: (pin: string) => angelpayUserAccountAPI.setPin(account!.id, pin),
    onSuccess: () => {
      toast({ title: 'PIN actualizado', description: 'La cuenta queda activa.' })
      setRotateOpen(false)
      invalidate()
    },
    onError: (err) => handleApiError(err, 'No se pudo actualizar el PIN'),
  })

  const markRotationMutation = useMutation({
    mutationFn: (reason: string) => angelpayUserAccountAPI.markRotationRequired(account!.id, reason),
    onSuccess: () => {
      toast({ title: 'PIN marcado para rotación' })
      setMarkRotationOpen(false)
      invalidate()
    },
    onError: (err) => handleApiError(err, 'No se pudo marcar el PIN para rotación'),
  })

  const suspendMutation = useMutation({
    mutationFn: (reason: string) => angelpayUserAccountAPI.suspend(account!.id, reason),
    onSuccess: () => {
      toast({ title: 'Cuenta suspendida' })
      setSuspendOpen(false)
      invalidate()
    },
    onError: (err) => handleApiError(err, 'No se pudo suspender la cuenta'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => angelpayUserAccountAPI.delete(account!.id),
    onSuccess: () => {
      toast({ title: 'Cuenta eliminada' })
      setDeleteOpen(false)
      invalidate()
    },
    onError: (err) => handleApiError(err, 'No se pudo eliminar la cuenta'),
  })

  // -------------------- Render --------------------

  if (!venueId) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Falta el parámetro `venueId` en la URL.
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="w-5 h-5" />
              Error al cargar la cuenta AngelPay
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            {(error as Error | undefined)?.message || 'Error desconocido'}
          </CardContent>
        </Card>
      </div>
    )
  }

  // ---- Empty state ----
  if (!account) {
    return (
      <div className="p-6 max-w-3xl mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Sin cuenta AngelPay</CardTitle>
            <CardDescription>
              Este venue aún no tiene una cuenta AngelPay configurada. Crea una para empezar a procesar pagos en terminales
              Nexgo.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => setCreateOpen(true)}>Crear cuenta AngelPay</Button>
          </CardContent>
        </Card>

        <AngelPayConnectDialog
          open={createOpen}
          onOpenChange={setCreateOpen}
          isPending={createMutation.isPending}
          onSubmit={(payload) => createMutation.mutate(payload)}
        />
      </div>
    )
  }

  // ---- Existing account state ----
  const status = account.status
  const canSetPin = status === 'PENDING_PIN' || status === 'PIN_ROTATION_REQUIRED' || status === 'ACTIVE'
  const canMarkRotation = status === 'ACTIVE'
  const canSuspend = status !== 'SUSPENDED' && status !== 'DELETED'
  const canDelete = status !== 'DELETED'

  const pinDisplay = status === 'PENDING_PIN' ? 'No configurado' : '••••••'
  const lastErr = account.lastValidationErr
  const errIsLong = !!lastErr && lastErr.length > 120
  const errPreview = errIsLong && !showFullError ? `${lastErr!.slice(0, 120)}…` : lastErr || 'Sin errores'

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">{account.email}</h1>
          <p className="text-sm text-muted-foreground mt-1">Cuenta AngelPay del venue</p>
        </div>
        <StatusChip status={status} />
      </div>

      {/* Detail card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalles</CardTitle>
          <CardDescription>
            Para cambiar el correo, elimina la cuenta y crea una nueva. Por seguridad, no se permite editar el email.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 sm:grid-cols-[200px_1fr] gap-x-6 gap-y-3 text-sm">
            <dt className="text-muted-foreground">Email</dt>
            <dd className="font-mono">{account.email}</dd>

            <dt className="text-muted-foreground">Ambiente</dt>
            <dd>
              <Badge variant="outline">{account.environment}</Badge>
            </dd>

            <dt className="text-muted-foreground">PIN</dt>
            <dd className="font-mono">{pinDisplay}</dd>

            <dt className="text-muted-foreground">Última validación</dt>
            <dd>
              {account.lastValidatedAt ? (
                <span title={formatAbsolute(account.lastValidatedAt)}>{formatRelative(account.lastValidatedAt)}</span>
              ) : (
                <span className="text-muted-foreground">Sin registro</span>
              )}
            </dd>

            <dt className="text-muted-foreground">Último error de validación</dt>
            <dd className="break-words">
              <span className={lastErr ? 'text-destructive' : 'text-muted-foreground'}>{errPreview}</span>
              {errIsLong && (
                <button
                  type="button"
                  className="ml-2 text-xs text-primary underline"
                  onClick={() => setShowFullError((v) => !v)}
                >
                  {showFullError ? 'Contraer' : 'Ver completo'}
                </button>
              )}
            </dd>

            <dt className="text-muted-foreground">Cambio de estado</dt>
            <dd>
              {account.statusChangedAt ? (
                <span title={formatAbsolute(account.statusChangedAt)}>
                  {formatRelative(account.statusChangedAt)}
                  {account.statusChangedBy ? (
                    <span className="text-muted-foreground"> · por {account.statusChangedBy}</span>
                  ) : null}
                </span>
              ) : (
                <span className="text-muted-foreground">Sin registro</span>
              )}
            </dd>

            {account.statusReason && (
              <>
                <dt className="text-muted-foreground">Razón del estado</dt>
                <dd className="break-words">{account.statusReason}</dd>
              </>
            )}

            {account.externalUserId != null && (
              <>
                <dt className="text-muted-foreground">User ID AngelPay</dt>
                <dd className="font-mono">{account.externalUserId}</dd>
              </>
            )}
          </dl>
        </CardContent>
      </Card>

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Acciones</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="default" disabled={!canSetPin} onClick={() => setRotateOpen(true)}>
            <KeyRound className="w-4 h-4 mr-2" />
            Rotar PIN
          </Button>
          <Button variant="outline" disabled={!canMarkRotation} onClick={() => setMarkRotationOpen(true)}>
            <ShieldAlert className="w-4 h-4 mr-2" />
            Marcar PIN para rotación
          </Button>
          <Button variant="outline" disabled={!canSuspend} onClick={() => setSuspendOpen(true)}>
            <ShieldOff className="w-4 h-4 mr-2" />
            Suspender
          </Button>
          <Button variant="destructive" disabled={!canDelete} onClick={() => setDeleteOpen(true)}>
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar cuenta
          </Button>
        </CardContent>
      </Card>

      {/* Dialogs */}
      <RotatePinDialog
        open={rotateOpen}
        onOpenChange={setRotateOpen}
        isPending={setPinMutation.isPending}
        onSubmit={(pin) => setPinMutation.mutate(pin)}
      />

      <ReasonDialog
        open={markRotationOpen}
        onOpenChange={setMarkRotationOpen}
        title="Marcar PIN para rotación"
        description="La TPV rechazará autenticación hasta que ops establezca un nuevo PIN. Describe el motivo (queda en bitácora)."
        confirmLabel="Marcar para rotación"
        isPending={markRotationMutation.isPending}
        onSubmit={(reason) => markRotationMutation.mutate(reason)}
      />

      <ReasonDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Suspender cuenta AngelPay"
        description="La cuenta no podrá procesar pagos. Para reactivarla, ops debe rotar el PIN. Describe el motivo (queda en bitácora)."
        confirmLabel="Suspender"
        confirmVariant="destructive"
        isPending={suspendMutation.isPending}
        onSubmit={(reason) => suspendMutation.mutate(reason)}
      />

      {/* Option B workaround: merchants auto-discovered by the TPV via
          AngelPaySDK.getUserMerchants() — pending admin approval. Only
          rendered when the AngelPay account is ACTIVE (TPVs only report
          after successful SDK auth). */}
      {status === 'ACTIVE' && <DiscoveredMerchantsSection venueId={venueId} />}

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar la cuenta AngelPay?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción soft-deletea la cuenta. Los merchant accounts AngelPay del venue se desactivan. Para reactivar,
              contacta a AngelPay.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                deleteMutation.mutate()
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Sub-components (co-located; <300 line page when accounting for these)
// ---------------------------------------------------------------------------

function RotatePinDialog({
  open,
  onOpenChange,
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  isPending: boolean
  onSubmit: (pin: string) => void
}) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setPin('')
    setError(null)
  }

  const handleSubmit = () => {
    if (!PIN_REGEX.test(pin)) {
      setError('El PIN debe tener exactamente 6 dígitos')
      return
    }
    onSubmit(pin)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rotar PIN</DialogTitle>
          <DialogDescription>
            Ingresa el nuevo PIN de 6 dígitos. La cuenta quedará en estado ACTIVE y los errores previos se limpiarán.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="rotate-pin">Nuevo PIN</Label>
          <Input
            id="rotate-pin"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setError(null)
            }}
            placeholder="123456"
            autoComplete="off"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Guardar PIN
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ---------------------------------------------------------------------------
// Option B workaround: Discovered AngelPay merchants section
// ---------------------------------------------------------------------------
//
// The TPV calls `POST /tpv/angelpay/report-discovered-merchants` after every
// successful SDK auth (and after every successful merchant switch). The
// backend upserts `MerchantAccount` rows with `active=false` for new merchants
// it has never seen before — those land here pending admin approval.
//
// Approve = PATCH MerchantAccount with `active: true` (flips the row from
// PENDING to APPROVED so it becomes routable once an admin also wires it
// into a `VenuePaymentConfig` slot). Reject = DELETE the row (it can be
// re-discovered on the TPV's next auth if the merchant still exists in the
// AngelPay user's list).
//
// NOTE on filtering: `MerchantAccount` has no `venueId` column on the
// backend — the Venue ↔ MerchantAccount link lives in `VenuePaymentConfig`.
// AngelPay merchant rows are part of a global pool keyed by
// (providerCode=ANGELPAY, externalMerchantId). We fetch every PENDING
// AngelPay merchant globally and show them on every venue's AngelPay page
// for now (intentional MVP shortcut: the cardinality stays small in
// practice — each AngelPay user reports their own merchants, and admins
// approve based on context). Filtering by venue would require either a new
// `discoveredAt` audit table or persisting the `venueId` from the reporting
// terminal on first-discovery — both out of scope for the workaround.
//
function DiscoveredMerchantsSection({ venueId }: { venueId: string }) {
  // Task 53 (Option B closure): the approve flow now mirrors Blumon —
  // approving a discovered merchant atomically flips active=true AND wires
  // the merchant into a VenuePaymentConfig slot via the backend's new
  // dedicated endpoint. Default slot is PRIMARY; admin can override per row.
  // The list itself is still global per provider (cardinality stays small).
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const { data: providers = [] } = useQuery({
    queryKey: ['payment-providers-for-angelpay-discovery'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders({ active: true }),
  })
  const angelpayProvider = providers.find((p) => p.code === 'ANGELPAY')

  const {
    data: pendingMerchants = [],
    isLoading,
    isError,
    error,
  } = useQuery<MerchantAccount[]>({
    queryKey: ['merchant-accounts-discovered-angelpay', angelpayProvider?.id],
    queryFn: () =>
      paymentProviderAPI.getAllMerchantAccounts({
        providerId: angelpayProvider!.id,
        active: false,
      }),
    enabled: !!angelpayProvider?.id,
  })

  // Current slot occupancy — surfaced as a top banner so the admin sees
  // which slots are taken BEFORE choosing a slot in the per-row picker.
  // Returns null when the venue has no payment config yet (a fresh venue —
  // first approval MUST be PRIMARY to seed the config; backend enforces).
  const { data: venuePaymentConfig } = useQuery<VenuePaymentConfig | null>({
    queryKey: ['venue-payment-config-for-angelpay-approval', venueId],
    queryFn: () => paymentProviderAPI.getVenuePaymentConfig(venueId),
    enabled: !!venueId,
  })

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts-discovered-angelpay'] })
    // Refresh the slot occupancy banner immediately after approval.
    queryClient.invalidateQueries({ queryKey: ['venue-payment-config-for-angelpay-approval', venueId] })
    // Also invalidate the main MerchantAccounts list so an approved merchant
    // appears immediately on the global page after the admin clicks Aprobar.
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
    queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
    // VenuePaymentConfig changes — refresh anywhere it's read globally.
    queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
  }

  const approveMutation = useMutation({
    mutationFn: ({ merchantAccountId, slot }: { merchantAccountId: string; slot: AngelPayVenuePaymentSlot }) =>
      angelpayUserAccountAPI.approveDiscoveredMerchant({ venueId, merchantAccountId, slot }),
    onSuccess: (_data, variables) => {
      toast({
        title: 'Merchant aprobado',
        description: `Asignado al slot ${SLOT_LABELS[variables.slot]} del venue.`,
      })
      invalidate()
    },
    onError: (err) => {
      const anyErr = err as { response?: { data?: { message?: string }; status?: number }; message?: string }
      const status = anyErr?.response?.status
      const baseMsg = anyErr?.response?.data?.message || anyErr?.message || 'Error desconocido'
      // 409 = slot collision; surface a hint about choosing another slot.
      const description = status === 409 ? `${baseMsg} Prueba con otro slot.` : baseMsg
      toast({
        title: status === 409 ? 'Slot ocupado' : 'No se pudo aprobar',
        description,
        variant: 'destructive',
      })
    },
  })

  const rejectMutation = useMutation({
    mutationFn: (id: string) => paymentProviderAPI.deleteMerchantAccount(id),
    onSuccess: () => {
      toast({ title: 'Merchant rechazado', description: 'La cuenta fue eliminada.' })
      invalidate()
    },
    onError: (err) => {
      const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
      toast({
        title: 'No se pudo rechazar',
        description: anyErr?.response?.data?.message || anyErr?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Merchants descubiertos</CardTitle>
        <CardDescription>
          Comercios reportados por TPVs autenticadas. Revisa y aprueba para activarlos en la TPV.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <SlotOccupancyBanner config={venuePaymentConfig ?? null} />
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-4 h-4 animate-spin" />
            Cargando merchants pendientes…
          </div>
        )}
        {isError && (
          <p className="text-sm text-destructive">
            Error al cargar: {(error as Error | undefined)?.message || 'desconocido'}
          </p>
        )}
        {!isLoading && !isError && pendingMerchants.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Ningún merchant descubierto aún. Una vez que una TPV Nexgo autentique con esta cuenta,
            los comercios asociados aparecerán aquí pendientes de aprobación.
          </p>
        )}
        {pendingMerchants.map((m) => (
          <DiscoveredMerchantRow
            key={m.id}
            merchant={m}
            hasVenueConfig={!!venuePaymentConfig}
            isApproving={
              approveMutation.isPending && approveMutation.variables?.merchantAccountId === m.id
            }
            isRejecting={rejectMutation.isPending && rejectMutation.variables === m.id}
            onApprove={(slot) => approveMutation.mutate({ merchantAccountId: m.id, slot })}
            onReject={() => rejectMutation.mutate(m.id)}
          />
        ))}
      </CardContent>
    </Card>
  )
}

const SLOT_LABELS: Record<AngelPayVenuePaymentSlot, string> = {
  PRIMARY: 'Principal',
  SECONDARY: 'Secundario',
  TERTIARY: 'Terciario',
}

function SlotOccupancyBanner({ config }: { config: VenuePaymentConfig | null }) {
  if (!config) {
    return (
      <Alert>
        <AlertTitle className="text-sm">Slots de pago del venue</AlertTitle>
        <AlertDescription className="text-xs">
          Este venue aún no tiene configuración de pagos. La primera aprobación deberá ser al slot
          <strong> Principal</strong> (el backend rechazará Secundario/Terciario hasta que exista el Principal).
        </AlertDescription>
      </Alert>
    )
  }
  return (
    <Alert>
      <AlertTitle className="text-sm">Slots de pago del venue</AlertTitle>
      <AlertDescription>
        <ul className="text-xs space-y-0.5 mt-1">
          <li>
            <strong>Principal:</strong>{' '}
            {config.primaryAccount?.displayName ?? <span className="italic">vacío</span>}
          </li>
          <li>
            <strong>Secundario:</strong>{' '}
            {config.secondaryAccount?.displayName ?? <span className="italic">vacío</span>}
          </li>
          <li>
            <strong>Terciario:</strong>{' '}
            {config.tertiaryAccount?.displayName ?? <span className="italic">vacío</span>}
          </li>
        </ul>
      </AlertDescription>
    </Alert>
  )
}

function DiscoveredMerchantRow({
  merchant,
  hasVenueConfig,
  isApproving,
  isRejecting,
  onApprove,
  onReject,
}: {
  merchant: MerchantAccount
  hasVenueConfig: boolean
  isApproving: boolean
  isRejecting: boolean
  onApprove: (slot: AngelPayVenuePaymentSlot) => void
  onReject: () => void
}) {
  const displayName = merchant.angelpayMerchantName || merchant.displayName || 'Sin nombre'
  const affiliation = merchant.angelpayAffiliation || '—'
  const externalId = merchant.externalMerchantId
  // Default to PRIMARY (matches Blumon's "always attach" default behavior).
  const [slot, setSlot] = useState<AngelPayVenuePaymentSlot>('PRIMARY')

  return (
    <div className="flex items-center justify-between gap-4 p-3 border rounded-md bg-muted/30 flex-wrap">
      <div className="flex flex-col gap-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium truncate">{displayName}</span>
          <Badge className="bg-yellow-100 text-yellow-800 hover:bg-yellow-100">PENDIENTE</Badge>
        </div>
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-4 gap-y-1">
          <span>
            Afiliación: <span className="font-mono">{affiliation}</span>
          </span>
          <span>
            AngelPay ID: <span className="font-mono">{externalId}</span>
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <Select
          value={slot}
          onValueChange={(v) => setSlot(v as AngelPayVenuePaymentSlot)}
          disabled={isApproving || isRejecting}
        >
          <SelectTrigger className="h-9 w-[150px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="PRIMARY">Slot principal</SelectItem>
            <SelectItem
              value="SECONDARY"
              disabled={!hasVenueConfig}
              title={!hasVenueConfig ? 'Requiere slot principal seedeado primero' : undefined}
            >
              Slot secundario
            </SelectItem>
            <SelectItem
              value="TERTIARY"
              disabled={!hasVenueConfig}
              title={!hasVenueConfig ? 'Requiere slot principal seedeado primero' : undefined}
            >
              Slot terciario
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="outline"
          size="sm"
          className="text-green-700 border-green-300 hover:bg-green-50"
          disabled={isApproving || isRejecting}
          onClick={() => onApprove(slot)}
        >
          {isApproving ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <CheckCircle2 className="w-4 h-4 mr-1" />
          )}
          Aprobar
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="text-red-700 border-red-300 hover:bg-red-50"
          disabled={isApproving || isRejecting}
          onClick={onReject}
        >
          {isRejecting ? (
            <Loader2 className="w-4 h-4 mr-1 animate-spin" />
          ) : (
            <XCircle className="w-4 h-4 mr-1" />
          )}
          Rechazar
        </Button>
      </div>
    </div>
  )
}

function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  confirmVariant = 'default',
  isPending,
  onSubmit,
}: {
  open: boolean
  onOpenChange: (v: boolean) => void
  title: string
  description: string
  confirmLabel: string
  confirmVariant?: 'default' | 'destructive'
  isPending: boolean
  onSubmit: (reason: string) => void
}) {
  const [reason, setReason] = useState('')
  const [error, setError] = useState<string | null>(null)

  const reset = () => {
    setReason('')
    setError(null)
  }

  const handleSubmit = () => {
    if (!reason.trim()) {
      setError('Describe el motivo (queda en bitácora)')
      return
    }
    onSubmit(reason.trim())
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) reset()
        onOpenChange(v)
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label htmlFor="reason-input">Motivo</Label>
          <Textarea
            id="reason-input"
            rows={3}
            value={reason}
            onChange={(e) => {
              setReason(e.target.value)
              setError(null)
            }}
            placeholder="Ej. PIN comprometido reportado por ops"
          />
          {error && <p className="text-xs text-destructive">{error}</p>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button
            variant={confirmVariant}
            className={confirmVariant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            onClick={handleSubmit}
            disabled={isPending}
          >
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
