import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { McpConnectGuide } from '@/components/mcp/McpConnectGuide'

interface McpConnectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * The "Connect your AI to Avoqado" dialog: header + the shared `McpConnectGuide`
 * (Claude / Codex tabs). One component so every entry point on Home — the
 * "what's new" banner and the card that replaced the legacy chatbot — opens the
 * exact same guide. Integrations keeps its own FullScreenModal on purpose (that
 * page follows the create/edit pattern; here a plain Dialog is enough because
 * the user is one click away from what they were doing).
 */
export function McpConnectDialog({ open, onOpenChange }: McpConnectDialogProps) {
  const { t } = useTranslation('home')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] w-[calc(100%-2rem)] overflow-y-auto overflow-x-hidden">
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
  )
}
