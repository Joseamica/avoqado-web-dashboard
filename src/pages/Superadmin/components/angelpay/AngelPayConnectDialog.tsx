/**
 * Shared "Conectar cuenta AngelPay" dialog.
 *
 * Extracted from `pages/Superadmin/Venues/AngelPayAccount.tsx`
 * (`CreateAccountDialog`) so the same form can be reused inline from the
 * MerchantAccount creation flow without the operator having to navigate away
 * to the dedicated venue subpage.
 *
 * Naming: "connect" rather than "create" — AngelPay provisions the user on
 * their side and hands us the credentials; we're vinculating, not creating
 * the underlying account.
 *
 * Props are deliberately presentational: callers own the mutation + venue
 * scope. The dialog only collects + validates the payload.
 */
import { useState } from 'react'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

import type { AngelPayEnvironment } from '@/services/superadmin-angelpay-user-account.service'

const PIN_REGEX = /^\d{6}$/

export interface AngelPayConnectDialogProps {
  open: boolean
  onOpenChange: (v: boolean) => void
  isPending: boolean
  onSubmit: (payload: { email: string; pin?: string; environment: AngelPayEnvironment }) => void
}

export function AngelPayConnectDialog({ open, onOpenChange, isPending, onSubmit }: AngelPayConnectDialogProps) {
  const [email, setEmail] = useState('')
  const [pin, setPin] = useState('')
  const [environment, setEnvironment] = useState<AngelPayEnvironment>('QA')
  const [errors, setErrors] = useState<{ email?: string; pin?: string }>({})

  const reset = () => {
    setEmail('')
    setPin('')
    setEnvironment('QA')
    setErrors({})
  }

  const handleSubmit = () => {
    const next: { email?: string; pin?: string } = {}
    if (!email.trim()) next.email = 'Requerido'
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) next.email = 'Correo inválido'
    if (pin && !PIN_REGEX.test(pin)) next.pin = 'El PIN debe tener exactamente 6 dígitos'
    if (next.email || next.pin) {
      setErrors(next)
      return
    }
    onSubmit({ email: email.trim(), pin: pin || undefined, environment })
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
          <DialogTitle>Conectar cuenta AngelPay</DialogTitle>
          <DialogDescription>
            Ingresa el correo y PIN que AngelPay generó para este venue. Si dejas el PIN vacío, la cuenta queda en
            `PENDING_PIN` hasta que se establezca.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="angelpay-email">Email</Label>
            <Input
              id="angelpay-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="ops+venue@avoqado.io"
              autoComplete="off"
            />
            {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="angelpay-pin">PIN (opcional, 6 dígitos)</Label>
            <Input
              id="angelpay-pin"
              type="text"
              inputMode="numeric"
              pattern="[0-9]{6}"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              placeholder="123456"
              autoComplete="off"
            />
            {errors.pin && <p className="text-xs text-destructive">{errors.pin}</p>}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="angelpay-env">Ambiente</Label>
            <Select value={environment} onValueChange={(v) => setEnvironment(v as AngelPayEnvironment)}>
              <SelectTrigger id="angelpay-env">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="QA">QA</SelectItem>
                <SelectItem value="PROD">PROD</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Conectar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default AngelPayConnectDialog
