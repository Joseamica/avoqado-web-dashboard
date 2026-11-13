import { AlertTriangle } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'

/**
 * D1 (12-nov): el aviso de un reembolso o pago manual que quedó sin confirmar (ver `useLlaveDeEnvio` en `@/lib/llaveDeEnvio`).
 * Le dice a la persona que volver a mandarlo con lo mismo NO lo duplica, y le da «Es otro» por si ya revisó que entró y quiere
 * hacer otro igual.
 */
export function EnvioEnDudaAviso({ titulo, onEsOtro }: { titulo: string; onEsOtro: () => void }) {
  const { t } = useTranslation('payment')
  return (
    <Alert className="border-input" data-tour="envio-en-duda-aviso">
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{titulo}</AlertTitle>
      <AlertDescription className="flex flex-col gap-2">
        <span>
          {t('enDuda.explicacion', {
            defaultValue:
              'Si es el mismo, vuelve a enviarlo con los mismos datos: no se registra dos veces. Si ya revisaste y es otro, toca «Es otro».',
          })}
        </span>
        <Button type="button" variant="outline" size="sm" className="self-start" onClick={onEsOtro}>
          {t('enDuda.esOtro', { defaultValue: 'Es otro' })}
        </Button>
      </AlertDescription>
    </Alert>
  )
}
