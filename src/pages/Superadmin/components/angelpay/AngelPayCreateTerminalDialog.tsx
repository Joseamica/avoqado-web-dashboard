import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { terminalAPI, type ActivationCodeResponse, type CreateTerminalRequest } from '@/services/superadmin-terminals.service'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, Copy, Loader2, Smartphone, Tablet } from 'lucide-react'
import React, { useState } from 'react'

interface AngelPayCreateTerminalDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Venue the new terminal will belong to. Hardcoded — no venue picker (we're
   *  inside the AngelPay wizard which already scoped to a venue). */
  venueId: string
  /** Human-readable venue name shown in the activation card. */
  venueName?: string
  /** Fires after a successful create so the parent can refresh lists. */
  onCreated?: () => void
}

type NexgoModel = 'N62' | 'N86' | 'N3'

/**
 * AngelPay-specific terminal creation dialog. Replaces the generic TerminalDialog
 * for the AngelPay onboarding wizard because that one defaulted to brand=PAX,
 * showed Blumon merchant assignment (irrelevant for NEXGO), and required the
 * operator to set every field correctly. This one:
 *
 *   - hardcodes brand=NEXGO + type=TPV_ANDROID + venue=current
 *   - asks ONLY for serial + name + model
 *   - auto-generates an activation code on create
 *   - shows the activation code prominently with a copy button so the operator
 *     can paste it into the TPV first-boot flow
 *   - invalidates the parent's terminal queries on close
 */
export const AngelPayCreateTerminalDialog: React.FC<AngelPayCreateTerminalDialogProps> = ({
  open,
  onOpenChange,
  venueId,
  venueName,
  onCreated,
}) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const [serialNumber, setSerialNumber] = useState('')
  const [name, setName] = useState('')
  const [model, setModel] = useState<NexgoModel>('N62')
  const [activationCode, setActivationCode] = useState<ActivationCodeResponse | null>(null)
  const [copied, setCopied] = useState(false)

  const resetForm = () => {
    setSerialNumber('')
    setName('')
    setModel('N62')
    setActivationCode(null)
    setCopied(false)
  }

  const handleClose = (next: boolean) => {
    if (!next) {
      // On close, ensure parent queries refresh — covers the case where the
      // operator created the terminal but closed before any explicit refetch
      // (e.g., didn't copy the activation code, just dismissed).
      if (activationCode) {
        queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
        queryClient.refetchQueries({ queryKey: ['superadmin-terminals'] })
        onCreated?.()
      }
      resetForm()
    }
    onOpenChange(next)
  }

  const createMutation = useMutation({
    mutationFn: (payload: CreateTerminalRequest) => terminalAPI.createTerminal(payload),
    onSuccess: (data) => {
      setActivationCode(data.activationCode ?? null)
      // Refresh immediately so Section 1 of the parent wizard shows the new
      // terminal even before the operator closes this dialog.
      queryClient.invalidateQueries({ queryKey: ['superadmin-terminals'] })
      queryClient.refetchQueries({ queryKey: ['superadmin-terminals'] })
      onCreated?.()
      if (!data.activationCode) {
        toast({
          title: 'Terminal creada',
          description: 'Sin código de activación generado.',
        })
        handleClose(false)
      }
    },
    onError: (err: any) => {
      toast({
        title: 'No se pudo crear la terminal',
        description: err?.response?.data?.message || err?.message || 'Error desconocido',
        variant: 'destructive',
      })
    },
  })

  const submit = () => {
    const trimmedSerial = serialNumber.trim()
    if (!trimmedSerial) {
      toast({ title: 'Número de serie requerido', variant: 'destructive' })
      return
    }
    if (!name.trim()) {
      toast({ title: 'Nombre de terminal requerido', variant: 'destructive' })
      return
    }
    const fullSerial = trimmedSerial.startsWith('AVQD-') ? trimmedSerial : `AVQD-${trimmedSerial}`
    createMutation.mutate({
      venueId,
      serialNumber: fullSerial,
      name: name.trim(),
      type: 'TPV_ANDROID',
      brand: 'NEXGO',
      model,
      assignedMerchantIds: [],
      generateActivationCode: true,
    })
  }

  const copyActivationCode = async () => {
    if (!activationCode) return
    try {
      await navigator.clipboard.writeText(activationCode.activationCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({ title: 'No se pudo copiar', variant: 'destructive' })
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[480px] bg-background">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tablet className="w-5 h-5 text-primary" />
            Crear terminal NEXGO
          </DialogTitle>
          <DialogDescription>
            {activationCode
              ? `Terminal creada en ${venueName ?? 'el venue'}. Copia el código de activación y úsalo en la TPV.`
              : `La terminal se registrará en ${venueName ?? 'este venue'} con brand NEXGO. Se generará un código de activación automáticamente.`}
          </DialogDescription>
        </DialogHeader>

        {/* ───── Step 1: form (hidden once we have an activation code) ───── */}
        {!activationCode && (
          <div className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="ngx-terminal-serial">Número de serie <span className="text-destructive">*</span></Label>
              <Input
                id="ngx-terminal-serial"
                value={serialNumber}
                onChange={(e) => setSerialNumber(e.target.value)}
                placeholder="N620W100220 (el prefijo AVQD- se agrega solo)"
                className="bg-background border-input font-mono"
                autoComplete="off"
              />
              <p className="text-xs text-muted-foreground">
                El número de serie físico de la NEXGO. Si no incluyes <code>AVQD-</code> lo agregamos automáticamente.
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ngx-terminal-name">Nombre <span className="text-destructive">*</span></Label>
              <Input
                id="ngx-terminal-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej: Caja Principal"
                className="bg-background border-input"
                autoComplete="off"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ngx-terminal-model">Modelo</Label>
              <Select value={model} onValueChange={(v) => setModel(v as NexgoModel)}>
                <SelectTrigger id="ngx-terminal-model" className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="N62">N62</SelectItem>
                  <SelectItem value="N86">N86</SelectItem>
                  <SelectItem value="N3">N3</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-md border border-dashed border-muted-foreground/30 bg-muted/30 p-3 text-xs text-muted-foreground flex items-start gap-2">
              <Smartphone className="w-4 h-4 mt-0.5 shrink-0" />
              <div>
                <p className="font-medium text-foreground">Auto-configurado para AngelPay:</p>
                <ul className="mt-1 space-y-0.5 list-disc list-inside">
                  <li>Brand: <span className="font-mono">NEXGO</span></li>
                  <li>Type: <span className="font-mono">TPV_ANDROID</span></li>
                  <li>Venue: <span className="font-mono">{venueName ?? venueId}</span></li>
                  <li>Código de activación: se genera automáticamente</li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* ───── Step 2: activation code display (after create) ───── */}
        {activationCode && (
          <div className="space-y-4">
            <div className="rounded-md border border-primary/50 bg-primary/5 p-4 space-y-3">
              <div className="space-y-1">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Código de activación</Label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-3xl font-bold tracking-widest bg-background border border-input rounded px-3 py-2 text-center">
                    {activationCode.activationCode}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={copyActivationCode}
                    title={copied ? 'Copiado' : 'Copiar al portapapeles'}
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground space-y-1">
                <p>
                  Serial: <span className="font-mono">{activationCode.serialNumber}</span>
                </p>
                <p>
                  Venue: <span className="font-mono">{activationCode.venueName}</span>
                </p>
                <p>
                  Expira: <span className="font-mono">{new Date(activationCode.expiresAt).toLocaleString('es-MX')}</span>
                  {' '}({Math.round(activationCode.expiresIn / 60)} min)
                </p>
              </div>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <p className="font-medium text-foreground">Próximos pasos:</p>
              <ol className="list-decimal list-inside space-y-0.5">
                <li>Enciende la NEXGO con la app Avoqado TPV instalada</li>
                <li>Ingresa el código de arriba cuando la app lo pida</li>
                <li>La terminal se vinculará a {venueName ?? 'este venue'} automáticamente</li>
                <li>Cuando autentique con AngelPay, los merchants se descubren solos</li>
              </ol>
            </div>
          </div>
        )}

        <DialogFooter>
          {!activationCode ? (
            <>
              <Button type="button" variant="outline" onClick={() => handleClose(false)} disabled={createMutation.isPending}>
                Cancelar
              </Button>
              <Button type="button" onClick={submit} disabled={createMutation.isPending}>
                {createMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Crear y generar código
              </Button>
            </>
          ) : (
            <Button type="button" onClick={() => handleClose(false)}>
              Listo
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
