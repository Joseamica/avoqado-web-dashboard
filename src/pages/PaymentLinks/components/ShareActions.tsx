import { Copy, Download, ExternalLink, MessageCircle, QrCode } from 'lucide-react'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

const CHECKOUT_BASE_URL = import.meta.env.VITE_CHECKOUT_URL || 'https://pay.avoqado.io'

interface ShareActionsProps {
  shortCode: string
  title: string
  /** If true, render as a dropdown button. Otherwise render inline buttons. */
  asDropdown?: boolean
}

function generateQrDataUrl(text: string, size = 256): string {
  // Simple QR placeholder — in production, use a QR library
  // For now, use a Google Charts API fallback
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`
}

export function ShareActions({ shortCode, title, asDropdown = false }: ShareActionsProps) {
  const { t } = useTranslation('paymentLinks')
  const { toast } = useToast()
  const [showQr, setShowQr] = useState(false)
  const linkRef = useRef<HTMLInputElement>(null)

  const url = `${CHECKOUT_BASE_URL}/${shortCode}`

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      toast({ title: t('share.copied') })
    } catch {
      // Fallback
      const input = linkRef.current
      if (input) {
        input.value = url
        input.select()
        document.execCommand('copy')
        toast({ title: t('share.copied') })
      }
    }
  }

  const handleWhatsApp = () => {
    const message = t('share.whatsappMessage', { title, url })
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank')
  }

  const handleDownloadQr = () => {
    const qrUrl = generateQrDataUrl(url, 512)
    const link = document.createElement('a')
    link.href = qrUrl
    link.download = `payment-link-${shortCode}.png`
    link.click()
  }

  if (asDropdown) {
    return (
      <>
        <input ref={linkRef} type="hidden" />
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="cursor-pointer">
              <ExternalLink className="h-4 w-4 mr-2" />
              {t('actions.share')}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleCopy} className="cursor-pointer">
              <Copy className="h-4 w-4 mr-2" />
              {t('share.copyLink')}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleWhatsApp} className="cursor-pointer">
              <MessageCircle className="h-4 w-4 mr-2" />
              {t('share.whatsapp')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setShowQr(true)} className="cursor-pointer">
              <QrCode className="h-4 w-4 mr-2" />
              {t('share.qrCode')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <Dialog open={showQr} onOpenChange={setShowQr}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>{t('share.qrCode')}</DialogTitle>
              <DialogDescription>{title}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center gap-4 py-4">
              <img
                src={generateQrDataUrl(url, 256)}
                alt="QR Code"
                className="w-64 h-64 rounded-lg"
              />
              <p className="text-sm text-muted-foreground break-all text-center">{url}</p>
              <Button onClick={handleDownloadQr} variant="outline" className="cursor-pointer">
                <Download className="h-4 w-4 mr-2" />
                {t('share.downloadQr')}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <input ref={linkRef} type="hidden" />
      <Button variant="outline" size="sm" onClick={handleCopy} className="cursor-pointer">
        <Copy className="h-4 w-4 mr-2" />
        {t('share.copyLink')}
      </Button>
      <Button variant="outline" size="sm" onClick={handleWhatsApp} className="cursor-pointer">
        <MessageCircle className="h-4 w-4 mr-2" />
        {t('share.whatsapp')}
      </Button>
      <Button variant="outline" size="sm" onClick={() => setShowQr(true)} className="cursor-pointer">
        <QrCode className="h-4 w-4 mr-2" />
        {t('share.qrCode')}
      </Button>

      <Dialog open={showQr} onOpenChange={setShowQr}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('share.qrCode')}</DialogTitle>
            <DialogDescription>{title}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4">
            <img
              src={generateQrDataUrl(url, 256)}
              alt="QR Code"
              className="w-64 h-64 rounded-lg"
            />
            <p className="text-sm text-muted-foreground break-all text-center">{url}</p>
            <Button onClick={handleDownloadQr} variant="outline" className="cursor-pointer">
              <Download className="h-4 w-4 mr-2" />
              {t('share.downloadQr')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
