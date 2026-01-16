import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { QRCodeSVG } from 'qrcode.react'
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { Check, Copy, QrCode, Terminal, Keyboard } from 'lucide-react'

interface ActivationCodeDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  activationData: {
    activationCode: string
    expiresAt: string
    expiresIn: number
    serialNumber: string
    venueName: string
    venueId?: string
    terminalId?: string
  } | null
}

export function ActivationCodeDialog({ open, onOpenChange, activationData }: ActivationCodeDialogProps) {
  const { t } = useTranslation('tpv')
  const { toast } = useToast()
  const { formatDate } = useVenueDateTime()
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<'qr' | 'manual'>('qr')

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

  // QR code data structure for TPV to scan
  // SIMPLIFIED: Only essential data to make QR smaller and easier to scan
  // - "t": "a" = type: avoqado_activation (shortened)
  // - "c": activation code
  // The backend validates everything else (venueId, serialNumber, expiry)
  const qrData = JSON.stringify({
    t: 'a',
    c: activationData.activationCode,
  })

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
          {/* Tabs for QR and Manual activation */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'qr' | 'manual')}>
            <TabsList className="inline-flex h-10 w-full items-center justify-center rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
              <TabsTrigger
                value="qr"
                className="group flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
              >
                <QrCode className="h-4 w-4 mr-2" />
                {t('activation.qrCode')}
              </TabsTrigger>
              <TabsTrigger
                value="manual"
                className="group flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
              >
                <Keyboard className="h-4 w-4 mr-2" />
                {t('activation.manualCode')}
              </TabsTrigger>
            </TabsList>

            {/* QR Code Tab */}
            <TabsContent value="qr" className="mt-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex flex-col items-center space-y-4">
                    {/* QR codes require high contrast (black on white) for proper scanning */}
                    <div className="p-4 rounded-xl shadow-sm border border-border" style={{ backgroundColor: '#ffffff' }}>
                      <QRCodeSVG
                        value={qrData}
                        size={200}
                        level="M"
                        includeMargin={false}
                        bgColor="#ffffff"
                        fgColor="#000000"
                      />
                    </div>
                    <p className="text-sm text-muted-foreground text-center">
                      {t('activation.scanQrInstructions')}
                    </p>
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

              {/* QR Instructions */}
              <div className="mt-4 space-y-2 rounded-lg border bg-muted/50 p-4">
                <h4 className="font-semibold text-sm">{t('activation.qrInstructions.title')}</h4>
                <ol className="space-y-1 text-sm text-muted-foreground">
                  <li>{t('activation.qrInstructions.step1')}</li>
                  <li>{t('activation.qrInstructions.step2')}</li>
                  <li>{t('activation.qrInstructions.step3')}</li>
                </ol>
              </div>
            </TabsContent>

            {/* Manual Code Tab */}
            <TabsContent value="manual" className="mt-4">
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
                        className="flex-shrink-0 cursor-pointer"
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

              {/* Manual Instructions */}
              <div className="mt-4 space-y-2 rounded-lg border bg-muted/50 p-4">
                <h4 className="font-semibold text-sm">{t('activation.instructions.title')}</h4>
                <ol className="space-y-1 text-sm text-muted-foreground">
                  <li>{t('activation.instructions.step1')}</li>
                  <li>{t('activation.instructions.step2', { serialNumber: activationData.serialNumber })}</li>
                  <li>{t('activation.instructions.step3')}</li>
                  <li>{t('activation.instructions.step4')}</li>
                </ol>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="sm:justify-between">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t('activation.close')}
          </Button>
          {activeTab === 'manual' && (
            <Button onClick={handleCopyCode}>{copied ? t('activation.copied') : t('activation.copyCode')}</Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
