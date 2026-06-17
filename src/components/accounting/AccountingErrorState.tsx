import { useTranslation } from 'react-i18next'
import { AlertCircle, RefreshCw } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

/**
 * Estado de error compartido de las páginas de Contabilidad. REEMPLAZA la región de datos
 * (no se muestra debajo de data en ceros) y ofrece "Reintentar". Superficie financiera:
 * el usuario no debe ver un error junto a números que parecen reales.
 */
export function AccountingErrorState({ message, onRetry }: { message?: string; onRetry?: () => void }) {
  const { t } = useTranslation('reports')
  return (
    <Card className="border-input">
      <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
        <AlertCircle className="h-8 w-8 text-destructive" />
        <p className="max-w-md text-sm text-muted-foreground">{message || t('accountingError.body')}</p>
        {onRetry && (
          <Button size="sm" variant="outline" onClick={() => onRetry()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            {t('accountingError.retry')}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
