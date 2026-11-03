import { Badge } from '@/components/ui/badge'
import { numberAlertText, type NumberAlert } from '@/services/saleVerification.org.service'

/** Las alertas del número como etiquetas en «Razón» (las calcula el servidor al leer). */
export function NumberAlertBadges({ alerts }: { alerts: NumberAlert[] }) {
  if (alerts.length === 0) return null
  return (
    <div className="flex flex-col items-start gap-1">
      {alerts.map(a => (
        <Badge
          key={a.code}
          className="whitespace-normal text-left font-normal bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700"
        >
          {numberAlertText(a)}
        </Badge>
      ))}
    </div>
  )
}
