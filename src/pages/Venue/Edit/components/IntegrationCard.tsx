import type { LucideIcon } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface IntegrationCardProps {
  icon: LucideIcon
  title: string
  description: string
  /** Optional small badge next to the title (e.g. "Beta") */
  badge?: string
  /** Connection status shown in the footer; omit when the state is unknown */
  status?: { connected: boolean; label: string }
  actionLabel: string
  onAction: () => void
  /** 'default' for connect CTAs, 'outline' for manage */
  actionVariant?: 'default' | 'outline'
  dataTour: string
}

/**
 * IntegrationCard — compact catalog tile for the Integrations section.
 * Anatomy: icon square + name (+badge), description, footer with status
 * dot (left) and single CTA (right). The CTA opens the integration's own
 * management surface (FullScreenModal or subpage) — no inline management.
 */
export function IntegrationCard({
  icon: Icon,
  title,
  description,
  badge,
  status,
  actionLabel,
  onAction,
  actionVariant = 'outline',
  dataTour,
}: IntegrationCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-input bg-card p-4" data-tour={dataTour}>
      <div className="flex items-center gap-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-border bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <span className="text-sm font-semibold">{title}</span>
        {badge && (
          <Badge variant="secondary" className="ml-auto shrink-0">
            {badge}
          </Badge>
        )}
      </div>

      <p className="flex-1 text-sm leading-relaxed text-muted-foreground">{description}</p>

      <div className="flex items-center justify-between gap-3">
        {status ? (
          <span
            className={cn(
              'flex items-center gap-1.5 text-xs',
              status.connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground',
            )}
          >
            <span className={cn('h-1.5 w-1.5 rounded-full', status.connected ? 'bg-emerald-500' : 'bg-muted-foreground/50')} />
            {status.label}
          </span>
        ) : (
          <span />
        )}
        <Button variant={actionVariant} size="sm" onClick={onAction} className="cursor-pointer">
          {actionLabel}
        </Button>
      </div>
    </div>
  )
}
