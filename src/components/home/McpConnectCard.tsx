import { useEffect, useMemo, useState, type KeyboardEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Sparkles } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { McpConnectDialog } from '@/components/mcp/McpConnectDialog'

const ROTATE_EVERY_MS = 3500

/**
 * Home card that replaced the legacy chatbot input. The in-dashboard assistant
 * (`ChatBubble`) has been unmounted since 2026-06-18, so the old input dispatched
 * `chatbot:openWithMessage` into the void: the user typed, hit Enter, nothing
 * happened. The card keeps the rotating example questions — they are the best
 * pitch for what your AI can ask once connected — and ANY click opens the
 * "Connect your AI" guide (Claude / Codex), the same dialog the banner opens.
 *
 * It is a single button (role=button on the Card) rather than a card with a
 * nested button: nested interactive elements are an a11y violation and the whole
 * surface is one action anyway. Mirrors the "Liquidación de hoy" card next to it.
 */
export function McpConnectCard() {
  const { t } = useTranslation('home')
  const [open, setOpen] = useState(false)
  const [index, setIndex] = useState(0)
  const [tourActive, setTourActive] = useState(() => typeof document !== 'undefined' && document.body.classList.contains('tour-active'))

  // Follow the `tour-active` flag driver.js sets on <body>. The rotation is
  // frozen while a tour runs: re-mounting the animated span makes the tour
  // overlay repaint and it reads as a full-screen flash.
  useEffect(() => {
    const update = () => setTourActive(document.body.classList.contains('tour-active'))
    update()
    const observer = new MutationObserver(update)
    observer.observe(document.body, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  // Example questions come from the i18n bundle (`returnObjects`). Empty pool
  // if the key is not an array (e.g. mid hot-reload) — the CTA still renders.
  const examples = useMemo<string[]>(() => {
    const raw = t('newHome.chatbot.placeholders', { returnObjects: true })
    return Array.isArray(raw) ? (raw as string[]) : []
  }, [t])

  useEffect(() => {
    if (examples.length <= 1 || tourActive || open) return
    const interval = window.setInterval(() => setIndex(prev => (prev + 1) % examples.length), ROTATE_EVERY_MS)
    return () => window.clearInterval(interval)
  }, [examples.length, tourActive, open])

  const example = examples.length > 0 ? examples[index % examples.length] : null

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      setOpen(true)
    }
  }

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-label={t('mcpAnnouncement.dialogTitle')}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyDown}
        className="h-full cursor-pointer rounded-2xl border-input transition-colors hover:bg-muted/30"
        data-tour="home-chatbot-overview"
      >
        <CardContent className="flex h-full items-center gap-3 px-5 py-5">
          <div className="min-w-0 flex-1 text-base text-muted-foreground/80">
            {example && (
              <div key={example} aria-hidden="true" className="animate-in fade-in slide-in-from-bottom-1 duration-500">
                <span className="block truncate">{example}</span>
              </div>
            )}
          </div>
          <span
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-3.5 py-2 text-sm font-medium text-primary-foreground"
            data-tour="home-mcp-connect-cta"
          >
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            <span>{t('newHome.chatbot.connectCta')}</span>
          </span>
        </CardContent>
      </Card>

      <McpConnectDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
