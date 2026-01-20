import { Sparkles, type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

interface ExampleCardProps {
  title?: string
  icon?: LucideIcon
  children: ReactNode
}

export function ExampleCard({ title = 'EJEMPLO', icon: Icon = Sparkles, children }: ExampleCardProps) {
  return (
    <div className="rounded-xl border border-dashed bg-muted/30 p-4 space-y-3">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
        <Icon className="h-4 w-4" />
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}
