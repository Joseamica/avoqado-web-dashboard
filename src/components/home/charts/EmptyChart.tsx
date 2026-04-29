import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

interface EmptyChartProps {
  icon: LucideIcon
  messageKey?: string
  className?: string
}

export const EmptyChart = ({ icon: Icon, messageKey, className }: EmptyChartProps) => {
  const { t } = useTranslation('home')
  const message = messageKey ? t(messageKey) : t('noData')

  return (
    <div
      role="status"
      className={cn('flex h-full flex-col items-center justify-center gap-3 px-4 py-6 text-center', className)}
    >
      <Icon className="h-8 w-8 text-muted-foreground/40" aria-hidden="true" />
      <p className="text-sm text-muted-foreground max-w-[24rem]">{message}</p>
    </div>
  )
}
