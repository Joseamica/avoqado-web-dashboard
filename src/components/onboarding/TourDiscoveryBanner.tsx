import type { ReactNode } from 'react'
import { GraduationCap, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { cn } from '@/lib/utils'

interface TourDiscoveryBannerProps {
  /**
   * Unique identifier for this banner. Persisted on the backend under
   * `tour-banner::<storageKey>`, scoped per venue and staff.
   * Example: `inventory-ingredients`, `menu-products`. Keep it stable — if
   * you change the key, users will see the banner again.
   */
  storageKey: string
  title: ReactNode
  description: ReactNode
  /**
   * Text for the primary CTA button.
   * @default "Ver tour guiado"
   */
  ctaLabel?: string
  /** Click handler for the primary CTA (usually starts a tour). */
  onStart: () => void
  className?: string
}

/**
 * Dismissable discovery banner that surfaces onboarding tours.
 *
 * Dismissal state is persisted on the backend via `StaffOnboardingState`,
 * scoped per staff + venue. Progress syncs across devices and survives
 * cache clears.
 */
export function TourDiscoveryBanner({
  storageKey,
  title,
  description,
  ctaLabel,
  onStart,
  className,
}: TourDiscoveryBannerProps) {
  const { value: dismissed, isLoaded, setValue: setDismissed } = useOnboardingKey<boolean>(
    `tour-banner::${storageKey}`,
    false,
  )

  // Don't paint until we know whether it was dismissed — avoids a flash on reload.
  if (!isLoaded || dismissed) return null

  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-lg border border-input bg-muted/40 px-4 py-3',
        className,
      )}
    >
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
        <GraduationCap className="h-4 w-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button size="sm" onClick={onStart}>
          {ctaLabel ?? 'Ver tour guiado'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar"
          onClick={() => setDismissed(true)}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
