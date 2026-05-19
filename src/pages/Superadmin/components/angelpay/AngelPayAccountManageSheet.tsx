/**
 * AngelPayAccountManageSheet — consolidated AngelPay user-account management.
 *
 * Replaces the standalone `/superadmin/venues/:venueId/angelpay-account`
 * page (deleted). Opens on top of the MerchantAccounts dialog so the
 * operator never leaves the consolidated AngelPay flow.
 *
 * Operations covered (1:1 with the deleted page's action set):
 *   - Rotate PIN  (POST .../pin)
 *   - Force PIN rotation (PATCH .../status → PIN_ROTATION_REQUIRED)
 *   - Suspend account (PATCH .../status → SUSPENDED)
 *   - Delete account (DELETE .../:id — soft-delete to DELETED)
 *
 * Status-based action gating mirrors the source-of-truth logic from the
 * deleted page (`canSetPin`, `canMarkRotation`, `canSuspend`, `canDelete`).
 *
 * Mutation success → toast + invalidate caches via parent `onChange` →
 * the dialog's account list rerenders with the new status badge.
 *
 * Audit metadata (statusChangedAt/By, lastValidatedAt, lastValidationErr,
 * externalUserId) is rendered read-only at the top, identical to the
 * deleted page's "Detalles" card.
 */

import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { KeyRound, Loader2, Pencil, ShieldAlert, ShieldOff, Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
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
import { useToast } from '@/hooks/use-toast'

import {
  angelpayUserAccountAPI,
  type AngelPayAccountStatus,
  type AngelPayEnvironment,
  type AngelPayUserAccount,
} from '@/services/superadmin-angelpay-user-account.service'

// ---------------------------------------------------------------------------
// Status presentation helpers (lifted verbatim from the deleted page)
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
  PENDING_PIN: 'bg-muted text-muted-foreground hover:bg-muted',
  PIN_ROTATION_REQUIRED: 'bg-yellow-100 text-yellow-800 hover:bg-yellow-100',
  SUSPENDED: 'bg-red-100 text-red-800 hover:bg-red-100',
  DELETED: 'bg-muted/50 text-muted-foreground/70 hover:bg-muted/50',
}

const PIN_REGEX = /^\d{6}$/

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
// Public API
// ---------------------------------------------------------------------------

export interface AngelPayAccountManageSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Account being managed. Re-rendered live as parent invalidates the list. */
  account: AngelPayUserAccount
  /** Fired after any mutation succeeds so the parent can invalidate caches. */
  onChange?: () => void
}

export function AngelPayAccountManageSheet({
  open,
  onOpenChange,
  account,
  onChange,
}: AngelPayAccountManageSheetProps) {
  const { toast } = useToast()

  // Inline action panels (one open at a time).
  type ActionPanel = null | 'rotate' | 'markRotation' | 'suspend' | 'editCredentials'
  const [activePanel, setActivePanel] = useState<ActionPanel>(null)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [showFullError, setShowFullError] = useState(false)

  // Form state for inline panels — kept locally so we can validate before
  // calling the mutations.
  const [pin, setPin] = useState('')
  const [pinError, setPinError] = useState<string | null>(null)
  const [reason, setReason] = useState('')
  const [reasonError, setReasonError] = useState<string | null>(null)
  // Delete confirmation requires retyping the email to prevent accidents.
  const [deleteEmailConfirm, setDeleteEmailConfirm] = useState('')
  // Edit-credentials form (only available on PENDING_PIN — once a PIN has
  // been set, the AngelPay SDK has likely validated the email, so changing
  // it would silently de-sync from AngelPay-side identity).
  const [editEmail, setEditEmail] = useState(account.email)
  const [editEnv, setEditEnv] = useState<AngelPayEnvironment>(account.environment)
  const [editEmailError, setEditEmailError] = useState<string | null>(null)

  const resetPanelForms = () => {
    setPin('')
    setPinError(null)
    setReason('')
    setReasonError(null)
    setEditEmail(account.email)
    setEditEnv(account.environment)
    setEditEmailError(null)
  }

  const handleApiError = (err: unknown, fallbackTitle: string) => {
    const anyErr = err as { response?: { data?: { message?: string } }; message?: string }
    toast({
      title: fallbackTitle,
      description: anyErr?.response?.data?.message || anyErr?.message || 'Error desconocido',
      variant: 'destructive',
    })
  }

  const notifyChange = () => {
    if (onChange) onChange()
  }

  // -------------------- Mutations --------------------
  const setPinMutation = useMutation({
    mutationFn: (newPin: string) => angelpayUserAccountAPI.setPin(account.id, newPin),
    onSuccess: () => {
      toast({ title: 'PIN actualizado', description: 'La cuenta queda activa.' })
      setActivePanel(null)
      resetPanelForms()
      notifyChange()
    },
    onError: err => handleApiError(err, 'No se pudo actualizar el PIN'),
  })

  const markRotationMutation = useMutation({
    mutationFn: (reasonText: string) =>
      angelpayUserAccountAPI.markRotationRequired(account.id, reasonText),
    onSuccess: () => {
      toast({ title: 'PIN marcado para rotación' })
      setActivePanel(null)
      resetPanelForms()
      notifyChange()
    },
    onError: err => handleApiError(err, 'No se pudo marcar el PIN para rotación'),
  })

  const suspendMutation = useMutation({
    mutationFn: (reasonText: string) => angelpayUserAccountAPI.suspend(account.id, reasonText),
    onSuccess: () => {
      toast({ title: 'Cuenta suspendida' })
      setActivePanel(null)
      resetPanelForms()
      notifyChange()
    },
    onError: err => handleApiError(err, 'No se pudo suspender la cuenta'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => angelpayUserAccountAPI.delete(account.id),
    onSuccess: () => {
      toast({ title: 'Cuenta eliminada' })
      setDeleteOpen(false)
      setDeleteEmailConfirm('')
      notifyChange()
      // Close the sheet entirely — the account row in the parent list
      // will rerender as DELETED but managing a soft-deleted account
      // from this sheet has no further actions available.
      onOpenChange(false)
    },
    onError: err => handleApiError(err, 'No se pudo eliminar la cuenta'),
  })

  const updateCredentialsMutation = useMutation({
    mutationFn: (updates: { email?: string; environment?: AngelPayEnvironment }) =>
      angelpayUserAccountAPI.updateCredentials(account.id, updates),
    onSuccess: () => {
      toast({
        title: 'Credenciales actualizadas',
        description: 'La cuenta sigue pendiente de PIN.',
      })
      setActivePanel(null)
      resetPanelForms()
      notifyChange()
    },
    onError: err => handleApiError(err, 'No se pudo actualizar las credenciales'),
  })

  // -------------------- Status-based action gating --------------------
  const status = account.status
  const canSetPin = status === 'PENDING_PIN' || status === 'PIN_ROTATION_REQUIRED' || status === 'ACTIVE'
  const canMarkRotation = status === 'ACTIVE'
  const canSuspend = status !== 'SUSPENDED' && status !== 'DELETED'
  const canDelete = status !== 'DELETED'
  // Edit email/env ONLY allowed while the account hasn't been confirmed (no
  // PIN set, no SDK validation yet). After PIN_ROTATION_REQUIRED / ACTIVE the
  // AngelPay SDK has likely already validated against the email
  // (externalUserId populated), so changing the email here would silently
  // de-sync the dashboard view from AngelPay-side identity.
  const canEditCredentials = status === 'PENDING_PIN'

  const pinDisplay = status === 'PENDING_PIN' ? 'No configurado' : '••••••'
  const lastErr = account.lastValidationErr
  const errIsLong = !!lastErr && lastErr.length > 120
  const errPreview = errIsLong && !showFullError ? `${lastErr!.slice(0, 120)}…` : lastErr || 'Sin errores'

  // -------------------- Inline panel handlers --------------------
  const submitRotate = () => {
    if (!PIN_REGEX.test(pin)) {
      setPinError('El PIN debe tener exactamente 6 dígitos')
      return
    }
    setPinMutation.mutate(pin)
  }

  const submitMarkRotation = () => {
    if (!reason.trim()) {
      setReasonError('Describe el motivo (queda en bitácora)')
      return
    }
    markRotationMutation.mutate(reason.trim())
  }

  const submitSuspend = () => {
    if (!reason.trim()) {
      setReasonError('Describe el motivo (queda en bitácora)')
      return
    }
    suspendMutation.mutate(reason.trim())
  }

  const openPanel = (panel: NonNullable<ActionPanel>) => {
    resetPanelForms()
    setActivePanel(panel)
  }

  const closePanel = () => {
    resetPanelForms()
    setActivePanel(null)
  }

  const anyPending =
    setPinMutation.isPending ||
    markRotationMutation.isPending ||
    suspendMutation.isPending ||
    deleteMutation.isPending ||
    updateCredentialsMutation.isPending

  return (
    <Sheet
      open={open}
      onOpenChange={v => {
        if (!v) {
          resetPanelForms()
          setActivePanel(null)
        }
        onOpenChange(v)
      }}
    >
      <SheetContent
        side="right"
        className="w-full sm:max-w-xl overflow-y-auto"
      >
        <SheetHeader>
          <SheetTitle className="flex items-center gap-3 flex-wrap">
            <span className="truncate">{account.email}</span>
            <Badge className={STATUS_CHIP_CLASSES[status]}>{STATUS_LABELS[status]}</Badge>
          </SheetTitle>
          <SheetDescription>
            Gestionar cuenta AngelPay del venue. Las acciones quedan registradas en bitácora.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* -------------------- Detalles (audit metadata) -------------------- */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Detalles</h3>
            <dl className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">ID</dt>
              <dd className="font-mono text-xs break-all">{account.id}</dd>

              <dt className="text-muted-foreground">Email</dt>
              <dd className="font-mono">{account.email}</dd>

              <dt className="text-muted-foreground">Ambiente</dt>
              <dd>
                <Badge variant="outline">{account.environment}</Badge>
              </dd>

              <dt className="text-muted-foreground">PIN</dt>
              <dd className="font-mono">{pinDisplay}</dd>

              <dt className="text-muted-foreground">Creada</dt>
              <dd>
                <span title={formatAbsolute(account.createdAt)}>
                  {formatRelative(account.createdAt)}
                </span>
              </dd>

              <dt className="text-muted-foreground">Última validación</dt>
              <dd>
                {account.lastValidatedAt ? (
                  <span title={formatAbsolute(account.lastValidatedAt)}>
                    {formatRelative(account.lastValidatedAt)}
                  </span>
                ) : (
                  <span className="text-muted-foreground">Sin registro</span>
                )}
              </dd>

              <dt className="text-muted-foreground">Último error de validación</dt>
              <dd className="break-words">
                <span className={lastErr ? 'text-destructive' : 'text-muted-foreground'}>
                  {errPreview}
                </span>
                {errIsLong && (
                  <button
                    type="button"
                    className="ml-2 text-xs text-primary underline"
                    onClick={() => setShowFullError(v => !v)}
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
          </section>

          {/* -------------------- Acciones -------------------- */}
          <section className="space-y-3">
            <h3 className="text-sm font-semibold">Acciones</h3>
            <div className="flex flex-wrap gap-2">
              {canEditCredentials && (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={anyPending}
                  onClick={() => openPanel('editCredentials')}
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar credenciales
                </Button>
              )}
              <Button
                variant="default"
                size="sm"
                disabled={!canSetPin || anyPending}
                onClick={() => openPanel('rotate')}
              >
                <KeyRound className="w-4 h-4 mr-2" />
                Rotar PIN
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canMarkRotation || anyPending}
                onClick={() => openPanel('markRotation')}
              >
                <ShieldAlert className="w-4 h-4 mr-2" />
                Forzar rotación de PIN
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={!canSuspend || anyPending}
                onClick={() => openPanel('suspend')}
              >
                <ShieldOff className="w-4 h-4 mr-2" />
                Suspender cuenta
              </Button>
              <Button
                variant="destructive"
                size="sm"
                disabled={!canDelete || anyPending}
                onClick={() => {
                  setDeleteEmailConfirm('')
                  setDeleteOpen(true)
                }}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar cuenta
              </Button>
            </div>

            {/* Inline panel — Editar credenciales (solo PENDING_PIN) */}
            {activePanel === 'editCredentials' && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Editar credenciales</h4>
                  <p className="text-xs text-muted-foreground">
                    Permitido sólo mientras la cuenta sigue en <code>PENDING_PIN</code>. Una vez establecido
                    el PIN, el SDK de AngelPay valida la cuenta y el correo queda bloqueado para evitar
                    desincronización.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-email-input">Correo</Label>
                  <Input
                    id="edit-email-input"
                    type="email"
                    value={editEmail}
                    onChange={e => {
                      setEditEmail(e.target.value)
                      setEditEmailError(null)
                    }}
                    placeholder="ops+venue@avoqado.io"
                    autoComplete="off"
                    className="bg-background"
                  />
                  {editEmailError && <p className="text-xs text-destructive">{editEmailError}</p>}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="edit-env-select">Ambiente</Label>
                  <select
                    id="edit-env-select"
                    value={editEnv}
                    onChange={e => setEditEnv(e.target.value as AngelPayEnvironment)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="QA">QA</option>
                    <option value="PROD">PROD</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closePanel}
                    disabled={updateCredentialsMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    disabled={updateCredentialsMutation.isPending}
                    onClick={() => {
                      const trimmed = editEmail.trim()
                      if (!trimmed) {
                        setEditEmailError('El correo no puede estar vacío')
                        return
                      }
                      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
                        setEditEmailError('Correo inválido')
                        return
                      }
                      const updates: { email?: string; environment?: AngelPayEnvironment } = {}
                      if (trimmed !== account.email) updates.email = trimmed
                      if (editEnv !== account.environment) updates.environment = editEnv
                      if (Object.keys(updates).length === 0) {
                        // Nothing changed — just close panel.
                        closePanel()
                        return
                      }
                      updateCredentialsMutation.mutate(updates)
                    }}
                  >
                    {updateCredentialsMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Guardar
                  </Button>
                </div>
              </div>
            )}

            {/* Inline panel — Rotar PIN */}
            {activePanel === 'rotate' && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Rotar PIN</h4>
                  <p className="text-xs text-muted-foreground">
                    Ingresa el nuevo PIN de 6 dígitos. La cuenta quedará en estado ACTIVE y los errores
                    previos se limpiarán.
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="rotate-pin-input">Nuevo PIN</Label>
                  <Input
                    id="rotate-pin-input"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]{6}"
                    maxLength={6}
                    value={pin}
                    onChange={e => {
                      setPin(e.target.value.replace(/\D/g, ''))
                      setPinError(null)
                    }}
                    placeholder="123456"
                    autoComplete="off"
                    className="font-mono bg-background"
                  />
                  {pinError && <p className="text-xs text-destructive">{pinError}</p>}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closePanel}
                    disabled={setPinMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={submitRotate} disabled={setPinMutation.isPending}>
                    {setPinMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Guardar PIN
                  </Button>
                </div>
              </div>
            )}

            {/* Inline panel — Forzar rotación */}
            {activePanel === 'markRotation' && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Forzar rotación de PIN</h4>
                  <p className="text-xs text-muted-foreground">
                    La TPV rechazará autenticación hasta que ops establezca un nuevo PIN. Describe el
                    motivo (queda en bitácora).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="mark-rotation-reason">Motivo</Label>
                  <Textarea
                    id="mark-rotation-reason"
                    rows={3}
                    value={reason}
                    onChange={e => {
                      setReason(e.target.value)
                      setReasonError(null)
                    }}
                    placeholder="Ej. PIN comprometido reportado por ops"
                    className="bg-background"
                  />
                  {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closePanel}
                    disabled={markRotationMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    size="sm"
                    onClick={submitMarkRotation}
                    disabled={markRotationMutation.isPending}
                  >
                    {markRotationMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Marcar para rotación
                  </Button>
                </div>
              </div>
            )}

            {/* Inline panel — Suspender */}
            {activePanel === 'suspend' && (
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-medium">Suspender cuenta AngelPay</h4>
                  <p className="text-xs text-muted-foreground">
                    La cuenta no podrá procesar pagos. Para reactivarla, ops debe rotar el PIN. Describe
                    el motivo (queda en bitácora).
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="suspend-reason">Motivo</Label>
                  <Textarea
                    id="suspend-reason"
                    rows={3}
                    value={reason}
                    onChange={e => {
                      setReason(e.target.value)
                      setReasonError(null)
                    }}
                    placeholder="Ej. cuenta dada de baja por AngelPay"
                    className="bg-background"
                  />
                  {reasonError && <p className="text-xs text-destructive">{reasonError}</p>}
                </div>
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={closePanel}
                    disabled={suspendMutation.isPending}
                  >
                    Cancelar
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={submitSuspend}
                    disabled={suspendMutation.isPending}
                  >
                    {suspendMutation.isPending && (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    )}
                    Suspender
                  </Button>
                </div>
              </div>
            )}
          </section>
        </div>

        {/* -------------------- Delete confirmation -------------------- */}
        <AlertDialog
          open={deleteOpen}
          onOpenChange={v => {
            setDeleteOpen(v)
            if (!v) setDeleteEmailConfirm('')
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar la cuenta AngelPay?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción soft-deletea la cuenta. Los merchant accounts AngelPay del venue se
                desactivan. Para reactivar, contacta a AngelPay. Escribe{' '}
                <code className="bg-muted px-1 py-0.5 rounded font-mono text-xs">
                  {account.email}
                </code>{' '}
                para confirmar.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-1.5">
              <Label htmlFor="delete-email-confirm">Email de la cuenta</Label>
              <Input
                id="delete-email-confirm"
                value={deleteEmailConfirm}
                onChange={e => setDeleteEmailConfirm(e.target.value)}
                placeholder={account.email}
                autoComplete="off"
                className="font-mono"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleteMutation.isPending}>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={e => {
                  e.preventDefault()
                  deleteMutation.mutate()
                }}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={
                  deleteMutation.isPending || deleteEmailConfirm.trim() !== account.email
                }
              >
                {deleteMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Eliminar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  )
}

export default AngelPayAccountManageSheet
