import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

/**
 * Wellhub entra como segundo adaptador cuando dé credenciales (spec D1). Hasta entonces se VE, deshabilitado y con el
 * badge que el repo usa para lo que todavía no funciona (regla «Unimplemented features: always badge them»).
 */
export function WellhubCard() {
  const { t } = useTranslation('passes')
  return (
    <Card className="border-input shadow-sm" data-tour="passes-wellhub-card">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base">{t('wellhub.title')}</CardTitle>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {t('common:comingSoon')}
          </Badge>
        </div>
        <CardDescription>{t('wellhub.description')}</CardDescription>
      </CardHeader>
      <CardContent>
        <Button type="button" variant="outline" size="sm" disabled data-tour="passes-wellhub-connect">
          {t('wellhub.connect')}
        </Button>
      </CardContent>
    </Card>
  )
}
