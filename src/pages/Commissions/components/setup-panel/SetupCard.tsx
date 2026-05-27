import { useTranslation } from 'react-i18next'
import type { LucideIcon } from 'lucide-react'
import { CheckCircle2 } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface SetupCardProps {
  icon: LucideIcon
  title: string
  description: React.ReactNode
  isValid: boolean
  isRequired?: boolean
  /** True when the user actively changed this card from its default */
  touched?: boolean
  disabled?: boolean
  disabledHint?: string
  /** Stable data-tour attribute for onboarding tours */
  dataTour?: string
  onClick: () => void
}

export default function SetupCard({
  icon: Icon,
  title,
  description,
  isValid,
  isRequired = false,
  touched = false,
  disabled = false,
  disabledHint,
  dataTour,
  onClick,
}: SetupCardProps) {
  const { t } = useTranslation('commissions')

  // Badge logic:
  // Required + valid → green "Listo"
  // Required + invalid → outline "Pendiente"
  // Optional + touched → green "Listo" (user actively configured it)
  // Optional + untouched → no badge (defaults are fine, don't clutter)
  const showReadyBadge = isValid && (isRequired || touched)
  const showPendingBadge = !isValid && isRequired

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-tour={dataTour}
      className={cn(
        'text-left rounded-2xl border p-5 transition-colors',
        isValid
          ? 'border-input bg-card'
          : 'border-dashed border-input bg-muted/20',
        disabled
          ? 'opacity-60 cursor-not-allowed'
          : 'hover:bg-muted/30 cursor-pointer',
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <h3 className="font-semibold text-sm">{title}</h3>
        </div>
        {showReadyBadge ? (
          <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-600 shrink-0">
            <CheckCircle2 className="w-3 h-3 mr-1" /> {t('setup.status.ready')}
          </Badge>
        ) : showPendingBadge ? (
          <Badge variant="outline" className="text-[10px] shrink-0">{t('setup.status.pending')}</Badge>
        ) : null}
      </div>
      <p className="mt-2 text-sm">
        {typeof description === 'string' ? (
          <span className={cn(
            isValid ? 'text-foreground' : 'text-muted-foreground',
            !isRequired && !touched ? 'text-muted-foreground' : '',
          )}>
            {description}
          </span>
        ) : (
          description
        )}
      </p>
    </button>
  )
}
