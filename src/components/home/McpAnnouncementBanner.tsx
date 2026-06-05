import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { McpConnectGuide } from '@/components/mcp/McpConnectGuide'

const STORAGE_KEY = 'avoqado-mcp-announcement-dismissed'

/**
 * "What's new" banner on Home: invites the operator to connect their AI
 * (Claude / ChatGPT) to Avoqado. Plain language on purpose — customers don't
 * know "MCP". The CTA opens an in-place dialog explaining how to connect
 * (no navigation). Dismissible, persisted in localStorage so it shows once.
 */
export function McpAnnouncementBanner() {
  const { t } = useTranslation('home')
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })
  const [open, setOpen] = useState(false)

  if (dismissed) return null

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, '1')
    } catch {
      // ignore — private mode etc.
    }
    setDismissed(true)
  }

  return (
    <>
      <div className="relative mb-4 flex flex-col gap-3 rounded-xl border border-input bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="shrink-0 rounded-full bg-background p-2">
            <Sparkles className="h-5 w-5 text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-foreground">{t('mcpAnnouncement.title')}</p>
            <p className="text-sm text-muted-foreground">{t('mcpAnnouncement.body')}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end sm:self-auto">
          <Button size="sm" onClick={() => setOpen(true)} data-tour="mcp-announcement-cta">
            {t('mcpAnnouncement.cta')}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={dismiss} className="h-8 w-8 cursor-pointer" aria-label={t('mcpAnnouncement.dismiss')}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-foreground" />
              {t('mcpAnnouncement.dialogTitle')}
            </DialogTitle>
            <DialogDescription className="sr-only">{t('mcpAnnouncement.body')}</DialogDescription>
          </DialogHeader>
          <McpConnectGuide />
        </DialogContent>
      </Dialog>
    </>
  )
}
