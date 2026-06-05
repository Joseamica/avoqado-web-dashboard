import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { ArrowRight, Sparkles, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useCurrentVenue } from '@/hooks/use-current-venue'

const STORAGE_KEY = 'avoqado-mcp-announcement-dismissed'

/**
 * "What's new" banner on Home: invites the operator to connect their AI
 * (Claude / ChatGPT) to Avoqado. Plain language on purpose — customers don't
 * know "MCP". Dismissible, persisted in localStorage so it shows once.
 */
export function McpAnnouncementBanner() {
  const { t } = useTranslation('home')
  const { fullBasePath } = useCurrentVenue()
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

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
        <Button asChild size="sm" data-tour="mcp-announcement-cta">
          <Link to={`${fullBasePath}/edit/integrations`}>
            {t('mcpAnnouncement.cta')}
            <ArrowRight className="ml-1.5 h-4 w-4" />
          </Link>
        </Button>
        <Button variant="ghost" size="icon" onClick={dismiss} className="h-8 w-8 cursor-pointer" aria-label={t('mcpAnnouncement.dismiss')}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
