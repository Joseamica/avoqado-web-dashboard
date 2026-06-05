import { useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const K = 'edit.integrations.mcp'

/** Numbered step row. Module-level → stable (no remount / no nested-component lint). */
function Step({ n, children }: { n: number; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">{n}</span>
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">{children}</div>
    </div>
  )
}

/**
 * Shared "how to connect your AI to Avoqado" guide. Two tabs — Claude (the
 * no-terminal connector flow + a visual mock of the "Add custom connector"
 * dialog) and Codex (two commands). Each tab also offers an auto-install prompt
 * the user can paste into a terminal agent (Claude Code / Codex) to set itself
 * up. Rendered in the integrations card AND the Home dialog. i18n namespace `venue`.
 */
export function McpConnectGuide() {
  const { t } = useTranslation('venue')
  const [tab, setTab] = useState<'claude' | 'codex'>('claude')
  const [copied, setCopied] = useState<string | null>(null)

  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
  const mcpUrl = `${apiUrl}/mcp`
  const cliCmd = `claude mcp add --transport http avoqado ${mcpUrl}`
  const codexAdd = `codex mcp add avoqado --url ${mcpUrl}`
  const codexLogin = 'codex mcp login avoqado'
  const claudePrompt = t(`${K}.claudePrompt`, { url: mcpUrl })
  const codexPrompt = t(`${K}.codexPrompt`, { url: mcpUrl })

  const copy = async (value: string, key: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(key)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard can fail on insecure origins — value stays visible
    }
  }

  // Render helpers (functions, NOT nested components — avoids remount + the lint).
  const copyRow = (value: string, key: string) => (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-input bg-muted/50 p-3">
      <code className="min-w-0 flex-1 whitespace-pre-wrap break-all font-mono text-xs leading-relaxed text-foreground">{value}</code>
      <Button size="sm" variant="ghost" onClick={() => copy(value, key)} data-tour={`mcp-copy-${key}`} className="shrink-0 cursor-pointer gap-1.5">
        {copied === key ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied === key ? t(`${K}.copied`) : t(`${K}.copy`)}
      </Button>
    </div>
  )

  const tabBtn = (id: 'claude' | 'codex', label: string) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      data-tour={`mcp-tab-${id}`}
      className={cn(
        'cursor-pointer rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
        tab === id ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {label}
    </button>
  )

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t(`${K}.intro`)}</p>

      <div className="inline-flex rounded-full border border-border bg-muted/60 p-1">
        {tabBtn('claude', t(`${K}.tabClaude`))}
        {tabBtn('codex', t(`${K}.tabCodex`))}
      </div>

      {tab === 'claude' ? (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(`${K}.claudeIntro`)}</p>

          <Step n={1}>
            <p className="text-sm text-foreground">{t(`${K}.claudeStep1`)}</p>
          </Step>

          <Step n={2}>
            <p className="text-sm text-foreground">{t(`${K}.claudeStep2`)}</p>
            {copyRow(mcpUrl, 'url')}
            {/* Visual mock of Claude's "Add custom connector" dialog — the URL field highlighted. */}
            <div className="space-y-3 rounded-xl border border-input bg-muted/40 p-4" aria-hidden>
              <p className="text-xs font-medium text-muted-foreground">{t(`${K}.dialogTitle`)}</p>
              <div className="space-y-1">
                <span className="block text-[11px] text-muted-foreground">{t(`${K}.dialogName`)}</span>
                <div className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground">Avoqado</div>
              </div>
              <div className="space-y-1">
                <span className="block text-[11px] text-muted-foreground">{t(`${K}.dialogUrlLabel`)}</span>
                <div className="rounded-lg border-2 border-primary bg-background px-3 py-2 font-mono text-xs text-foreground break-all">{mcpUrl}</div>
              </div>
              <div className="flex justify-end">
                <span className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">{t(`${K}.dialogAdd`)}</span>
              </div>
            </div>
          </Step>

          <Step n={3}>
            <p className="text-sm text-foreground">{t(`${K}.claudeStep3`)}</p>
          </Step>

          <div className="space-y-3 border-t border-border pt-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t(`${K}.cliNote`)}</p>
              {copyRow(cliCmd, 'cli')}
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">{t(`${K}.claudePromptNote`)}</p>
              {copyRow(claudePrompt, 'claudePrompt')}
            </div>
            <p className="rounded-lg bg-muted/50 p-3 text-xs text-muted-foreground">{t(`${K}.claudeWebNote`)}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">{t(`${K}.codexIntro`)}</p>

          <Step n={1}>
            <p className="text-sm text-foreground">{t(`${K}.codexStep1`)}</p>
            {copyRow(codexAdd, 'codexAdd')}
          </Step>

          <Step n={2}>
            <p className="text-sm text-foreground">{t(`${K}.codexStep2`)}</p>
            {copyRow(codexLogin, 'codexLogin')}
          </Step>

          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs text-muted-foreground">{t(`${K}.codexPromptNote`)}</p>
            {copyRow(codexPrompt, 'codexPrompt')}
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">{t(`${K}.note`)}</p>
    </div>
  )
}
