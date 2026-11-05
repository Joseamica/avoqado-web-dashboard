import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import type { FaltaParaFacturar } from './faltaParaFacturar'

interface FaltaParaFacturarDialogProps {
  /** `null`: no falta nada que se sepa, y esta ventana no se abre. */
  falta: FaltaParaFacturar | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Apagado se ve y se explica: en vez de un formulario que va a fallar al final, qué falta y a dónde ir (o a quién pedírselo). */
export function FaltaParaFacturarDialog({ falta, open, onOpenChange }: FaltaParaFacturarDialogProps) {
  const { t } = useTranslation('cfdi')
  const { can } = useAccess()
  const { fullBasePath } = useCurrentVenue()
  const puedeConfigurar = can('cfdi:configure')

  return (
    <AlertDialog open={open && !!falta} onOpenChange={onOpenChange}>
      <AlertDialogContent data-tour="cfdi-falta-para-facturar">
        <AlertDialogHeader>
          <AlertDialogTitle>{t('faltaParaFacturar.title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {falta && t(`faltaParaFacturar.${puedeConfigurar ? 'configurar' : 'pedirlo'}.${falta}`)}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          {puedeConfigurar ? (
            <>
              <AlertDialogCancel>{t('faltaParaFacturar.ahoraNo')}</AlertDialogCancel>
              <AlertDialogAction asChild>
                <Link to={`${fullBasePath}/cfdi/configuracion`} data-tour="cfdi-falta-para-facturar-config">
                  {t('faltaParaFacturar.irAConfiguracion')}
                </Link>
              </AlertDialogAction>
            </>
          ) : (
            <AlertDialogCancel>{t('faltaParaFacturar.entendido')}</AlertDialogCancel>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
