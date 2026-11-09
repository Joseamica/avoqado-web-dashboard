import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { renameTpv } from '@/services/tpv.service'

interface RenameDeviceDialogProps {
  venueId: string
  device: { id: string; name: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Cambiar el nombre de un aparato: manda sólo `{ name }`, sin tocar serie ni config. */
export function RenameDeviceDialog({ venueId, device, open, onOpenChange }: RenameDeviceDialogProps) {
  const { t } = useTranslation('tpv')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [name, setName] = useState(device.name)
  const trimmed = name.trim()
  const sending = useRef(false) // isPending tarda un render: dos clics en el mismo instante pasarían los dos

  const rename = useMutation({
    mutationFn: () => renameTpv(venueId, device.id, trimmed),
    onSettled: () => {
      sending.current = false
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, device.id] })
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      toast({ title: t('device.rename.saved') })
      onOpenChange(false)
    },
  })

  const save = () => {
    if (!trimmed || sending.current) return
    sending.current = true
    rename.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent aria-describedby={undefined}>
        <form
          onSubmit={e => {
            e.preventDefault()
            save()
          }}
          className="space-y-4"
        >
          <DialogHeader>
            <DialogTitle>{t('device.rename.title')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rename-device-name">{t('device.rename.label')}</Label>
            <Input id="rename-device-name" value={name} onChange={e => setName(e.target.value)} autoFocus />
            {rename.isError && (
              <p role="alert" className="text-sm text-destructive">
                {t('device.rename.error')}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t('device.rename.cancel')}
            </Button>
            <Button type="submit" disabled={!trimmed || rename.isPending}>
              {t('device.rename.save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
