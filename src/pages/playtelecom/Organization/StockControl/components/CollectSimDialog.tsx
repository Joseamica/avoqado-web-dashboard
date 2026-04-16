/**
 * CollectSimDialog — modal that collects a SIM from Promoter or Supervisor.
 *
 * Reason is required (plan §1.4 contract). The caller decides which endpoint
 * to hit — the dialog just gathers inputs and invokes `onConfirm`.
 */
import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { toast } from '@/hooks/use-toast'
import type { SimCustodyCollectionReason } from '@/services/simCustody.service'

export type CollectFrom = 'promoter' | 'supervisor'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  serialNumber: string
  from: CollectFrom
  onConfirm: (reason: SimCustodyCollectionReason) => Promise<void>
  /** Optional label shown above the reason selector (e.g. "Pedro Gómez"). */
  contextLabel?: string
}

const REASON_OPTIONS: { value: SimCustodyCollectionReason; label: string }[] = [
  { value: 'STAFF_TERMINATED', label: 'Baja de empleado' },
  { value: 'DAMAGED_SIM', label: 'SIM defectuoso' },
]

export function CollectSimDialog({ open, onOpenChange, serialNumber, from, onConfirm, contextLabel }: Props) {
  const [reason, setReason] = useState<SimCustodyCollectionReason | ''>('')
  const queryClient = useQueryClient()

  const mutation = useMutation({
    mutationFn: async () => {
      if (!reason) throw new Error('Motivo requerido')
      await onConfirm(reason)
    },
    onSuccess: () => {
      toast({ title: 'SIM recolectado correctamente' })
      setReason('')
      onOpenChange(false)
      queryClient.invalidateQueries({ queryKey: ['org-stock-control'] })
      queryClient.invalidateQueries({ queryKey: ['sim-custody-events'] })
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } }; message?: string })?.response?.data?.message
        ?? (err as Error)?.message
        ?? 'No se pudo recolectar el SIM'
      toast({ title: msg, variant: 'destructive' })
    },
  })

  const title = from === 'promoter' ? 'Recolectar del Promotor' : 'Recolectar del Supervisor'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>
            ICCID <span className="font-mono">{serialNumber}</span>
            {contextLabel ? ` — ${contextLabel}` : ''}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <label className="text-sm font-medium">Motivo de recolección</label>
          <Select value={reason} onValueChange={v => setReason(v as SimCustodyCollectionReason)}>
            <SelectTrigger>
              <SelectValue placeholder="Selecciona un motivo" />
            </SelectTrigger>
            <SelectContent>
              {REASON_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button onClick={() => mutation.mutate()} disabled={!reason || mutation.isPending}>
            {mutation.isPending ? 'Recolectando…' : 'Recolectar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
