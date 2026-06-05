import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCancelCfdi } from '@/hooks/use-cfdi'
import type { Cfdi, CancelMotivo } from '@/services/cfdi.service'

const MOTIVOS: CancelMotivo[] = ['01', '02', '03', '04']

interface CancelCfdiDialogProps {
  /** When set, the dialog opens for this CFDI. Null = closed. */
  cfdi: Cfdi | null
  onOpenChange: (open: boolean) => void
}

export function CancelCfdiDialog({ cfdi, onOpenChange }: CancelCfdiDialogProps) {
  const { t } = useTranslation('cfdi')
  const cancelMutation = useCancelCfdi()

  const [motivo, setMotivo] = useState<CancelMotivo>('02')
  const [substituteUuid, setSubstituteUuid] = useState('')

  // Reset the form whenever a new target opens.
  useEffect(() => {
    if (cfdi) {
      setMotivo('02')
      setSubstituteUuid('')
    }
  }, [cfdi])

  const requiresSubstitute = motivo === '01'
  const canSubmit = !cancelMutation.isPending && (!requiresSubstitute || substituteUuid.trim().length > 0)

  const handleConfirm = () => {
    if (!cfdi) return
    cancelMutation.mutate(
      {
        cfdiId: cfdi.id,
        data: {
          motivo,
          ...(requiresSubstitute && { substituteUuid: substituteUuid.trim() }),
        },
      },
      { onSuccess: () => onOpenChange(false) },
    )
  }

  return (
    <AlertDialog open={!!cfdi} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('cancelDialog.title')}</AlertDialogTitle>
          <AlertDialogDescription>{t('cancelDialog.description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>{t('cancelDialog.motivoLabel')}</Label>
            <Select value={motivo} onValueChange={v => setMotivo(v as CancelMotivo)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOTIVOS.map(m => (
                  <SelectItem key={m} value={m}>
                    {t(`cancelDialog.motivo${m}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {requiresSubstitute && (
            <div className="space-y-2">
              <Label>{t('cancelDialog.substituteUuidLabel')}</Label>
              <Input
                value={substituteUuid}
                onChange={e => setSubstituteUuid(e.target.value)}
                placeholder={t('cancelDialog.substituteUuidPlaceholder')}
              />
              <p className="text-xs text-muted-foreground">{t('cancelDialog.substituteUuidHint')}</p>
            </div>
          )}
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel disabled={cancelMutation.isPending}>{t('cancelDialog.cancel')}</AlertDialogCancel>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canSubmit}>
            {cancelMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {t('cancelDialog.confirm')}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
