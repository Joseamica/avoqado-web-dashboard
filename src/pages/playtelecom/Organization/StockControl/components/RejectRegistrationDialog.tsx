import { useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useRejectSimRegistration } from '../hooks/useSimRegistrationRequests'

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  orgId: string
  requestId: string
  serialNumbers?: string[]
}

export function RejectRegistrationDialog({ open, onOpenChange, orgId, requestId, serialNumbers }: Props) {
  const [reason, setReason] = useState('')
  const reject = useRejectSimRegistration(orgId)

  const handleConfirm = () => {
    reject.mutate(
      { requestId, reason: reason.trim(), serialNumbers },
      {
        onSuccess: () => {
          setReason('')
          onOpenChange(false)
        },
      },
    )
  }

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next)
    if (!next) setReason('')
  }

  const trimmedReason = reason.trim()

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rechazar solicitud</DialogTitle>
          <DialogDescription>
            {serialNumbers && serialNumbers.length > 0
              ? `Se rechazarán ${serialNumbers.length} SIM${serialNumbers.length === 1 ? '' : 's'} seleccionados.`
              : 'Se rechazará la solicitud completa.'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-reason">Motivo del rechazo</Label>
          <Textarea
            id="reject-reason"
            placeholder="Escribe el motivo del rechazo..."
            value={reason}
            onChange={e => setReason(e.target.value)}
            rows={3}
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={reject.isPending}>
            Cancelar
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={reject.isPending || !trimmedReason}>
            {reject.isPending ? 'Rechazando…' : 'Rechazar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
