import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { InboxOrder, RejectReason } from '@/types/onlineOrdering'

const REASONS: RejectReason[] = ['OUT_OF_ITEMS', 'CLOSED', 'TOO_BUSY', 'OTHER']
const NOTE_MAX = 200 // el mismo tope del servidor

export function RejectDialog({
  order,
  onClose,
  onReject,
}: {
  order: InboxOrder
  onClose: () => void
  onReject: (reason: RejectReason, note?: string) => void
}) {
  const { t } = useTranslation('onlineOrdering')
  const [reason, setReason] = useState<RejectReason | null>(null)
  const [note, setNote] = useState('')

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('inbox.reject.title', { number: order.orderNumber })}</DialogTitle>
          <DialogDescription>{t('inbox.reject.description')}</DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2">
          {REASONS.map(r => (
            <Button key={r} type="button" variant={reason === r ? 'default' : 'outline'} aria-pressed={reason === r} onClick={() => setReason(r)}>
              {t(`inbox.reject.reasons.${r}`)}
            </Button>
          ))}
        </div>
        <div className="space-y-2">
          <Label htmlFor="online-reject-note">{t('inbox.reject.note')}</Label>
          <Textarea id="online-reject-note" maxLength={NOTE_MAX} value={note} onChange={e => setNote(e.target.value)} />
          <p className="text-right text-xs text-muted-foreground">
            {note.length}/{NOTE_MAX}
          </p>
        </div>
        <DialogFooter>
          <Button variant="destructive" disabled={!reason} onClick={() => reason && onReject(reason, note.trim() || undefined)}>
            {t('inbox.reject.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
