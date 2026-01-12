import type { ReactNode } from 'react'
import { Info } from 'lucide-react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

type PageTitleWithInfoProps = {
  title: ReactNode
  tooltip?: string
  className?: string
  iconClassName?: string
}

export function PageTitleWithInfo({ title, tooltip, className, iconClassName }: PageTitleWithInfoProps) {
  return (
    <div className="flex items-center gap-2">
      <h1 className={className}>{title}</h1>
      {tooltip ? (
        <TooltipProvider delayDuration={0}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" aria-label={tooltip} className="text-muted-foreground/70 hover:text-foreground">
                <Info className={cn('h-4 w-4', iconClassName)} />
              </button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-relaxed">{tooltip}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </div>
  )
}
