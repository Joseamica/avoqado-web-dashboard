// src/pages/Settings/Billing/components/SuperadminFeatureControl.tsx
import { useState } from 'react'
import { ChevronDown, Shield } from 'lucide-react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export interface SuperadminFeatureControlProps {
  /** Render the existing grant-trial / enable / active-feature controls. */
  children: React.ReactNode
}

/**
 * Superadmin-only control plane for venue features (grant trial / enable without payment / disable).
 * Collapsed by default so it never clutters the customer-facing plan view.
 * Hardcoded Spanish (superadmin screens are i18n-exempt).
 */
export function SuperadminFeatureControl({ children }: SuperadminFeatureControlProps) {
  const [open, setOpen] = useState(false)
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="mt-8">
      <Card className="overflow-hidden border-input bg-gradient-to-r from-amber-400/10 to-pink-500/10">
        <CollapsibleTrigger className="flex w-full items-center justify-between gap-3 p-4 cursor-pointer">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground">
              <Shield className="h-4.5 w-4.5" />
            </div>
            <div className="text-left">
              <p className="text-sm font-bold">Control de Funciones · Superadmin</p>
              <p className="text-xs text-muted-foreground">Otorgar prueba, activar sin pago, o desactivar funciones de este venue.</p>
            </div>
          </div>
          <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition', open && 'rotate-180')} />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">{children}</CollapsibleContent>
      </Card>
    </Collapsible>
  )
}
