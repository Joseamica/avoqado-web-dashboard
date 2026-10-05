import { CalendarCheck, Ticket, Users } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent } from '@/components/ui/card'

/**
 * Lo que se ve DETRÁS del paywall (borroso) y cuando todavía no hay nada que mostrar: qué hace la función, en tres
 * líneas para un dueño no técnico. «Apagado se VE y se EXPLICA» — nunca una pantalla vacía.
 */
export function PassesTeaser() {
  const { t } = useTranslation('passes')
  const bullets = [
    { icon: Ticket, text: t('teaser.bullet1') },
    { icon: CalendarCheck, text: t('teaser.bullet2') },
    { icon: Users, text: t('teaser.bullet3') },
  ]
  return (
    <Card className="border-input" data-tour="passes-teaser">
      <CardContent className="space-y-3 p-6">
        <p className="font-medium">{t('teaser.title')}</p>
        <ul className="space-y-2">
          {bullets.map(({ icon: Icon, text }) => (
            <li key={text} className="flex items-start gap-2 text-sm text-muted-foreground">
              <Icon className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{text}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  )
}
