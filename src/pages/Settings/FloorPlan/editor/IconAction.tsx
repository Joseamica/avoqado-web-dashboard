import { forwardRef, type ComponentPropsWithoutRef } from 'react'
import { Button } from '@/components/ui/button'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

export interface IconActionProps extends ComponentPropsWithoutRef<typeof Button> {
  /** Nombre accesible y texto del globo. */
  label: string
  /** Atajo de teclado que se enseña en el globo (p. ej. «⌘ Z»). */
  shortcut?: string
}

/** Botón de sólo ícono con su nombre en un globo (y su atajo, si tiene). Trae su propio proveedor de globos. */
export const IconAction = forwardRef<HTMLButtonElement, IconActionProps>(function IconAction({ label, shortcut, className, children, ...props }, ref) {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button ref={ref} type="button" variant="ghost" size="icon" aria-label={label} className={cn('cursor-pointer', className)} {...props}>
            {children}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="flex items-center gap-2">
          {label}
          {shortcut && <kbd className="rounded border border-background/30 px-1 font-sans text-[11px] leading-4">{shortcut}</kbd>}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
})
