/**
 * AngelPayAccountSection — Section B of the AngelPay onboarding wizard
 * (Task 54). Inline replacement for the old "Cuenta AngelPay no activa →
 * open AngelPayConnectDialog" pattern.
 *
 * Two render states:
 *   1. No active account (null or non-ACTIVE) — embed the create form
 *      directly (email + optional 6-digit PIN + QA/PROD environment) so
 *      operator never leaves the wizard.
 *   2. ACTIVE account — compact status row (green "Conectada" chip + email
 *      + environment) plus a link to the dedicated page for advanced ops
 *      (rotate PIN, suspend, delete, audit).
 *
 * The page-level component (`pages/Superadmin/Venues/AngelPayAccount.tsx`)
 * remains the source of truth for advanced management. This section
 * intentionally omits all that complexity — onboarding only.
 *
 * Mutation is owned by the parent (`ManualAccountDialog`) so the dialog
 * can invalidate query keys consistently with the rest of its flow.
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, ExternalLink, Loader2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type {
  AngelPayEnvironment,
  AngelPayUserAccount,
} from '@/services/superadmin-angelpay-user-account.service'

const PIN_REGEX = /^\d{6}$/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export interface AngelPayAccountSectionProps {
  venueId: string
  account: AngelPayUserAccount | null | undefined
  isLoading: boolean
  isPending: boolean
  onConnect: (payload: { email: string; pin?: string; environment: AngelPayEnvironment }) => void
}

export function AngelPayAccountSection({
  venueId,
  account,
  isLoading,
  isPending,
  onConnect,
}: AngelPayAccountSectionProps) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [environment, setEnvironment] = useState<AngelPayEnvironment>('QA')
  const [errors, setErrors] = useState<{ email?: string; pin?: string }>({})

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-3">
        <Loader2 className="w-4 h-4 animate-spin" />
        Cargando cuenta AngelPay…
      </div>
    )
  }

  // ACTIVE — compact status row + advanced-management link.
  if (account?.status === 'ACTIVE') {
    return (
      <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              <CheckCircle2 className="w-3 h-3 mr-1" />
              Conectada
            </Badge>
            <span className="font-mono text-sm">{account.email}</span>
            <Badge variant="outline" className="text-xs">
              {account.environment}
            </Badge>
          </div>
        </div>
        <Link
          to={`/superadmin/venues/${venueId}/angelpay-account`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          <ExternalLink className="w-3 h-3" />
          Gestionar cuenta (rotar PIN, suspender)
        </Link>
      </div>
    )
  }

  // Not ACTIVE — inline connect form. Mirrors `AngelPayConnectDialog` but
  // embedded (no nested dialog overlay).
  const handleSubmit = () => {
    const next: { email?: string; pin?: string } = {}
    if (!email.trim()) next.email = 'Requerido'
    else if (!EMAIL_REGEX.test(email.trim())) next.email = 'Correo inválido'
    if (pin && !PIN_REGEX.test(pin)) next.pin = 'El PIN debe tener exactamente 6 dígitos'
    if (next.email || next.pin) {
      setErrors(next)
      return
    }
    onConnect({ email: email.trim(), pin: pin || undefined, environment })
  }

  return (
    <div className="space-y-3">
      {account && account.status !== 'ACTIVE' && (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Cuenta existente en estado <strong>{account.status}</strong>. Conectar reemplazará el PIN actual.
        </p>
      )}
      {!account && (
        <p className="text-xs text-muted-foreground">
          Ingresa el correo y PIN que AngelPay generó para este venue. Si dejas el PIN vacío, la cuenta queda en{' '}
          <code className="bg-muted px-1 py-0.5 rounded font-mono text-[10px]">PENDING_PIN</code> hasta que se
          establezca.
        </p>
      )}

      <div className="grid sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="angelpay-section-email">Email</Label>
          <Input
            id="angelpay-section-email"
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setErrors((p) => ({ ...p, email: undefined }))
            }}
            placeholder="ops+venue@avoqado.io"
            autoComplete="off"
            data-1p-ignore
            className="bg-background border-input"
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="angelpay-section-pin">PIN (6 dígitos, opcional)</Label>
          <Input
            id="angelpay-section-pin"
            type="text"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setErrors((p) => ({ ...p, pin: undefined }))
            }}
            placeholder="123456"
            autoComplete="off"
            className="bg-background border-input font-mono"
          />
          {errors.pin && <p className="text-xs text-destructive">{errors.pin}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="angelpay-section-env">Ambiente</Label>
        <Select value={environment} onValueChange={(v) => setEnvironment(v as AngelPayEnvironment)}>
          <SelectTrigger id="angelpay-section-env" className="bg-background border-input w-full sm:w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="QA">QA</SelectItem>
            <SelectItem value="PROD">PROD</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Button type="button" onClick={handleSubmit} disabled={isPending}>
        {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
        Conectar cuenta
      </Button>
    </div>
  )
}

export default AngelPayAccountSection
