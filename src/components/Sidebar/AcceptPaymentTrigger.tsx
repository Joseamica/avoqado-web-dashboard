import { useState } from 'react'
import { CreditCard, HandCoins, Link2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { cn } from '@/lib/utils'
import { useSidebar } from '@/components/ui/sidebar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { useCurrentVenue } from '@/hooks/use-current-venue'

export function AcceptPaymentTrigger() {
  const { t } = useTranslation('sidebar')
  const { state } = useSidebar()
  const isCollapsed = state === 'collapsed'
  const [open, setOpen] = useState(false)
  const navigate = useNavigate()
  const { fullBasePath } = useCurrentVenue()

  const label = t('acceptPayment.title', { defaultValue: 'Aceptar pago' })

  const handleSendLink = () => {
    setOpen(false)
    navigate(`${fullBasePath}/payment-links?new=1`)
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-tour="sidebar-accept-payment-btn"
          aria-label={label}
          title={isCollapsed ? label : undefined}
          className={cn(
            'group relative flex w-full items-center border-b border-sidebar-border text-sm text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors cursor-pointer',
            isCollapsed ? 'justify-center px-0 py-3' : 'gap-3 px-4 py-3',
          )}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <HandCoins className="h-4 w-4" />
          </span>
          {!isCollapsed && <span className="flex-1 text-left font-medium">{label}</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align={isCollapsed ? 'start' : 'center'}
        side="top"
        sideOffset={8}
        className="w-64 p-1"
      >
        <button
          type="button"
          data-tour="accept-payment-charge-card"
          onClick={() => setOpen(false)}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted cursor-pointer"
        >
          <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{t('acceptPayment.chargeCard', { defaultValue: 'Cargo a tarjeta' })}</span>
        </button>
        <div className="my-1 h-px bg-border" />
        <button
          type="button"
          data-tour="accept-payment-send-link"
          onClick={handleSendLink}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm text-foreground transition-colors hover:bg-muted cursor-pointer"
        >
          <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="flex-1">{t('acceptPayment.sendLink', { defaultValue: 'Enviar liga de pago' })}</span>
        </button>
      </PopoverContent>
    </Popover>
  )
}
