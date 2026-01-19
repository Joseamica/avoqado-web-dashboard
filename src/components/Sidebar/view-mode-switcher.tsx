import { LayoutGrid, Sparkles } from 'lucide-react'
import { useViewMode } from '@/hooks/useViewMode'
import { useSidebar } from '@/components/ui/sidebar'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { cn } from '@/lib/utils'
import { useMemo } from 'react'

export function ViewModeSwitcher() {
  const { currentMode, canSwitchView, switchView } = useViewMode()
  const { state: sidebarState, isMobile } = useSidebar()
  const { venue } = useCurrentVenue()
  const isCollapsed = sidebarState === 'collapsed' && !isMobile

  // Extract white-label brand name from module config
  const whiteLabelBrandName = useMemo(() => {
    const wlModule = venue?.modules?.find(m => m.module.code === 'WHITE_LABEL_DASHBOARD' && m.enabled)
    const brandName = (wlModule?.config as any)?.theme?.brandName

    // Return abbreviated brand name (max 12 chars to fit sidebar)
    if (brandName && typeof brandName === 'string') {
      return brandName.length > 12 ? brandName.substring(0, 12) : brandName
    }
    return 'WL' // Fallback
  }, [venue?.modules])

  if (!canSwitchView) return null

  return (
    <div className="px-3 py-2">
      <div className="inline-flex w-full rounded-md border border-border/50 bg-muted/30 p-0.5">
        <button
          onClick={() => switchView('traditional')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-colors',
            currentMode === 'traditional'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title="Full Dashboard"
        >
          <LayoutGrid className="w-3 h-3" />
          {!isCollapsed && <span>Full</span>}
        </button>
        <button
          onClick={() => switchView('whitelabel')}
          className={cn(
            'flex-1 flex items-center justify-center gap-1.5 rounded-sm px-2 py-1 text-xs font-medium transition-colors',
            currentMode === 'whitelabel'
              ? 'bg-background text-foreground shadow-sm'
              : 'text-muted-foreground hover:text-foreground'
          )}
          title={`White-Label: ${whiteLabelBrandName}`}
        >
          <Sparkles className="w-3 h-3" />
          {!isCollapsed && <span className="truncate">{whiteLabelBrandName}</span>}
        </button>
      </div>
    </div>
  )
}
