import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import { useUploadCsd } from '@/hooks/use-cfdi'
import type { Emisor } from '@/services/cfdi.service'

/** Read a File as base64 (without the data: URL prefix). Mirrors the repo's
 *  existing fileToBase64 pattern (see Superadmin/TpvUpdates.tsx). */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1] ?? '')
    }
    reader.onerror = () => reject(reader.error)
  })
}

interface UploadCsdModalProps {
  open: boolean
  onClose: () => void
  emisor: Emisor | null
}

export function UploadCsdModal({ open, onClose, emisor }: UploadCsdModalProps) {
  const { t } = useTranslation('cfdi')
  const { toast } = useToast()
  const uploadMutation = useUploadCsd()

  const [cerFile, setCerFile] = useState<File | null>(null)
  const [keyFile, setKeyFile] = useState<File | null>(null)
  const [password, setPassword] = useState('')

  useEffect(() => {
    if (open) {
      setCerFile(null)
      setKeyFile(null)
      setPassword('')
    }
  }, [open])

  const canSubmit = !uploadMutation.isPending && !!cerFile && !!keyFile && password.length > 0

  const handleSubmit = async () => {
    if (!emisor) return
    if (!cerFile || !keyFile) {
      toast({ title: t('csdDialog.missingFiles'), variant: 'destructive' })
      return
    }
    const [cerBase64, keyBase64] = await Promise.all([fileToBase64(cerFile), fileToBase64(keyFile)])
    uploadMutation.mutate(
      { emisorId: emisor.id, data: { cerBase64, keyBase64, password } },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('csdDialog.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={handleSubmit} disabled={!canSubmit}>
          {uploadMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('csdDialog.submit')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl p-6">
        <section className="rounded-2xl border border-input bg-card p-6 space-y-5">
          <p className="text-sm text-muted-foreground">{t('csdDialog.description')}</p>

          <div className="space-y-2">
            <Label>{t('csdDialog.cerLabel')}</Label>
            <Input type="file" accept=".cer" onChange={e => setCerFile(e.target.files?.[0] ?? null)} className="h-12" />
          </div>

          <div className="space-y-2">
            <Label>{t('csdDialog.keyLabel')}</Label>
            <Input type="file" accept=".key" onChange={e => setKeyFile(e.target.files?.[0] ?? null)} className="h-12" />
          </div>

          <div className="space-y-2">
            <Label>{t('csdDialog.passwordLabel')}</Label>
            <Input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={t('csdDialog.passwordPlaceholder')}
              className="h-12 text-base"
              autoComplete="off"
            />
          </div>
        </section>
      </div>
    </FullScreenModal>
  )
}
