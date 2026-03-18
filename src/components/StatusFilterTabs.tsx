import { cn } from '@/lib/utils'

export interface StatusTab {
  value: string
  label: string
  count?: number
}

interface StatusFilterTabsProps {
  tabs: StatusTab[]
  activeTab: string
  onTabChange: (value: string) => void
  className?: string
}

export function StatusFilterTabs({ tabs, activeTab, onTabChange, className }: StatusFilterTabsProps) {
  return (
    <div className={cn('border-b border-border', className)}>
      <nav className="flex items-center gap-6">
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => onTabChange(tab.value)}
            className={cn(
              'relative pb-3 text-sm font-medium transition-colors whitespace-nowrap',
              activeTab === tab.value
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1.5 text-xs opacity-60">{tab.count}</span>
            )}
            {activeTab === tab.value && (
              <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
            )}
          </button>
        ))}
      </nav>
    </div>
  )
}
