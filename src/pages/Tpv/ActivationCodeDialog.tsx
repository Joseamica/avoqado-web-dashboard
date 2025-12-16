import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Check, Copy, Terminal } from 'lucide-react'

interface ActivationCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activationData: {
    activationCode: string
    expiresAt: string
    expiresIn: number
    serialNumber: string
    venueName: string
  } | null
}

export function ActivationCodeDialog({ open, onOpenChange, activationData }: ActivationCodeDialogProps) {
  const { t } = useTranslation('tpv')
  const { toast } = useToast()
  const { formatDate } = useVenueDateTime()
  const [copied, setCopied] = useState(false)

  const handleCopyCode = async () => {
    if (!activationData?.activationCode) return

    try {
      await navigator.clipboard.writeText(activationData.activationCode)
      setCopied(true)
      toast({
        title: t('activation.copied'),
        duration: 2000,
      })

      // Reset copied state after 2 seconds
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: 'Error',
        description: 'Failed to copy code to clipboard',
        variant: 'destructive',
      })
    }
  }

  if (!activationData) return null

  const daysUntilExpiry = Math.ceil(activationData.expiresIn / (24 * 60 * 60))

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Terminal className="h-5 w-5" />
            {t('activation.title')}
          </DialogTitle>
          <DialogDescription>{t('activation.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Activation Code Display */}
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">{t('activation.code')}</label>
                <div className="flex items-center justify-between gap-2 rounded-lg border bg-muted p-4">
                  <code className="text-3xl font-bold tracking-wider">{activationData.activationCode}</code>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={handleCopyCode}
                    className="flex-shrink-0"
                  >
                    {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              {/* Expiry Info */}
              <div className="mt-4 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">{t('activation.expiresAt')}:</span>
                  <span className="text-sm font-medium">{formatDate(activationData.expiresAt)}</span>
                </div>
                <Badge variant="outline" className="w-full justify-center">
                  {t('activation.expiresIn', { days: daysUntilExpiry })}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Instructions */}
          <div className="space-y-2 rounded-lg border bg-muted/50 p-4">
            <h4 className="font-semibold text-sm">{t('activation.instructions.title')}</h4>
            <ol className="space-y-1 text-sm text-muted-foreground">
              <li>{t('activation.instructions.step1')}</li>
              <li>{t('activation.instructions.step2', { serialNumber: activationData.serialNumber })}</li>
              <li>{t('activation.instructions.step3')}</li>
              <li>{t('activation.instructions.step4')}</li>
            </ol>
          </div>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('activation.close')}
          </Button>
          <Button onClick={handleCopyCode}>{copied ? t('activation.copied') : t('activation.copyCode')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
