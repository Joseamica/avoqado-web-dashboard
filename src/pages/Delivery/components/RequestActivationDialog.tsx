import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { createActivationRequest } from '@/services/delivery.service'
import { providerLabel } from '../providerLabels'

/** Brand platforms an owner can request. DELIVERECT (the adapter) is never offered here — see providerLabels.ts. */
const REQUESTABLE_CHANNELS = ['UBER_EATS', 'RAPPI', 'DIDI_FOOD'] as const

interface RequestActivationDialogProps {
  venueId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * TEASER state's CTA target. The owner self-serves the INTENT (which platforms they have/want +
 * an optional note); ops does the actual CONNECTION manually (design spec §2 — "self-serve en la
 * intención, ops en la conexión"). On success, invalidates the exact `['deliveryActivation', venueId]`
 * query key `useDeliveryStatus` reads, which flips the page from TEASER to PENDING.
 */
export function RequestActivationDialog({ venueId, open, onOpenChange }: RequestActivationDialogProps) {
  const { t } = useTranslation('delivery')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selected, setSelected] = useState<string[]>([])
  const [note, setNote] = useState('')

  // Reset the form every time the dialog opens fresh (mirrors CancelCfdiDialog's reset-on-open pattern).
  useEffect(() => {
    if (open) {
      setSelected([])
      setNote('')
    }
  }, [open])

  const mutation = useMutation({
    mutationFn: () => createActivationRequest(venueId, { requestedChannels: selected, note: note.trim() || undefined }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['deliveryActivation', venueId] })
      toast({ title: t('requestDialog.toastSuccess') })
      onOpenChange(false)
    },
    onError: (err: any) => {
      toast({
        title: t('requestDialog.toastError'),
        description: err?.response?.data?.message ?? err?.message ?? '',
        variant: 'destructive',
      })
    },
  })

  const toggleChannel = (channel: string, checked: boolean) => {
    setSelected(prev => (checked ? [...prev, channel] : prev.filter(c => c !== channel)))
  }

  const canSubmit = selected.length > 0 && !mutation.isPending

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('requestDialog.title')}</DialogTitle>
          <DialogDescription>{t('requestDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-3">
            <Label>{t('requestDialog.channelsLabel')}</Label>
            {REQUESTABLE_CHANNELS.map(channel => (
              <div key={channel} className="flex items-center gap-2">
                <Checkbox
                  id={`delivery-channel-${channel}`}
                  className="cursor-pointer"
                  checked={selected.includes(channel)}
                  onCheckedChange={checked => toggleChannel(channel, checked === true)}
                />
                <Label htmlFor={`delivery-channel-${channel}`} className="cursor-pointer font-normal">
                  {providerLabel(channel)}
                </Label>
              </div>
            ))}
            {selected.length === 0 && <p className="text-xs text-muted-foreground">{t('requestDialog.validationHint')}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="delivery-activation-note">{t('requestDialog.noteLabel')}</Label>
            <Textarea
              id="delivery-activation-note"
              value={note}
              onChange={e => setNote(e.target.value)}
              placeholder={t('requestDialog.notePlaceholder')}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
            {t('requestDialog.cancel')}
          </Button>
          <Button type="button" onClick={() => mutation.mutate()} disabled={!canSubmit}>
            {mutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('requestDialog.submit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
