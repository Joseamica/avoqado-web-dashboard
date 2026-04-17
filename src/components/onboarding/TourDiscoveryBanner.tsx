import { useEffect, useState, type ReactNode } from 'react'
import { GraduationCap, X } from 'lucide-react'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useAuth } from '@/context/AuthContext'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface TourDiscoveryBannerProps {
  /**
   * Unique identifier for this banner.
   * Used to persist dismissal state in localStorage.
   * Example: 'inventory-ingredients', 'menu-products'.
   * Keep it stable — if you change the key, the user will see the banner again.
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
 * Persistence is scoped per venue AND per user via localStorage so:
 *   - The same admin won't see the banner again on the same venue.
 *   - Different users on the same venue can each see it once.
 *   - Same user on different venues sees it per venue.
 *
 * TODO(post-MVP): move dismissal to a backend `StaffOnboardingState` table so it
 * persists across devices and clearing browser storage doesn't reset it.
 */
export function TourDiscoveryBanner({
  storageKey,
  title,
  description,
  ctaLabel,
  onStart,
  className,
}: TourDiscoveryBannerProps) {
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const userId = user?.id ?? 'anon'
  const key = `tour-banner-dismissed::${venueId ?? 'no-venue'}::${userId}::${storageKey}`

  // Default to dismissed=true so we don't flash the banner before hydrating.
  const [dismissed, setDismissed] = useState(true)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(key)
      setDismissed(stored === '1')
    } catch {
      setDismissed(false)
    }
  }, [key])

  const handleDismiss = () => {
    setDismissed(true)
    try {
      window.localStorage.setItem(key, '1')
    } catch {
      /* storage quota or private mode — ignore */
    }
  }

  if (dismissed) return null

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
        <Button
          size="sm"
          onClick={() => {
            onStart()
          }}
        >
          {ctaLabel ?? 'Ver tour guiado'}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Cerrar"
          onClick={handleDismiss}
          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
