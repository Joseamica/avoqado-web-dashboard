import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

/**
 * Shared "how to connect your AI to Avoqado" guide. Connector (no-terminal)
 * path first, then the Claude Code CLI. Rendered inside the integrations card
 * AND the Home announcement dialog. i18n under the `venue` namespace
 * (`edit.integrations.mcp.*`).
 */
export function McpConnectGuide() {
  const { t } = useTranslation('venue')
  const [copied, setCopied] = useState<'url' | 'cli' | null>(null)

  const apiUrl = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')
  const mcpUrl = `${apiUrl}/mcp`
  const command = `claude mcp add --transport http avoqado ${mcpUrl}`

  const copy = async (value: string, which: 'url' | 'cli') => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(which)
      setTimeout(() => setCopied(null), 2000)
    } catch {
      // clipboard can fail on insecure origins — no-op; the value stays visible
    }
  }

  // Render helper (a function, NOT a nested component — avoids remount + the
  // react/no-unstable-nested-components lint).
  const copyRow = (value: string, which: 'url' | 'cli') => (
    <div className="flex items-start justify-between gap-2 rounded-lg border border-input bg-muted/50 p-3">
      <code className="min-w-0 flex-1 break-all font-mono text-xs leading-relaxed text-foreground">{value}</code>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => copy(value, which)}
        data-tour={`mcp-copy-${which}`}
        className="shrink-0 cursor-pointer gap-1.5"
      >
        {copied === which ? <Check className="h-3.5 w-3.5 text-green-600 dark:text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
        {copied === which ? t('edit.integrations.mcp.copied') : t('edit.integrations.mcp.copy')}
      </Button>
    </div>
  )

  return (
    <div className="space-y-5">
      <p className="text-sm text-muted-foreground">{t('edit.integrations.mcp.intro')}</p>

      {/* Option 1 — Custom connector (no terminal). Best for operators. */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t('edit.integrations.mcp.connectorTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('edit.integrations.mcp.connectorStep')}</p>
        {copyRow(mcpUrl, 'url')}
        <p className="text-xs text-muted-foreground">{t('edit.integrations.mcp.connectorLogin')}</p>
      </div>

      <Separator />

      {/* Option 2 — Claude Code CLI (developers). */}
      <div className="space-y-2">
        <p className="text-sm font-medium text-foreground">{t('edit.integrations.mcp.cliTitle')}</p>
        <p className="text-sm text-muted-foreground">{t('edit.integrations.mcp.cliStep')}</p>
        {copyRow(command, 'cli')}
      </div>

      <p className="text-xs text-muted-foreground">{t('edit.integrations.mcp.note')}</p>
    </div>
  )
}
