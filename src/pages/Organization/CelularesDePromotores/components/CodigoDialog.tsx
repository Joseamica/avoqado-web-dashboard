import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useVenueDateTime } from '@/utils/datetime'
import { Copy, MessageCircle, Smartphone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMandarCodigo, type CodigoParaMandar } from '../ayudantes'

interface CodigoDialogProps {
  codigo: CodigoParaMandar | null
  onClose: () => void
}

export function CodigoDialog({ codigo, onClose }: CodigoDialogProps) {
  const { t } = useTranslation('organization')
  const { formatDate } = useVenueDateTime()
  const { copiar, mandarPorWhatsApp } = useMandarCodigo()

  return (
    <Dialog open={!!codigo} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {codigo && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Smartphone className="h-5 w-5" />
                {t('celulares.codigo.titulo', { nombre: codigo.nombre, defaultValue: 'Código de {{nombre}}' })}
              </DialogTitle>
              <DialogDescription>
                {t('celulares.codigo.descripcion', {
                  defaultValue: 'La persona lo escribe en la app de campo junto con su PIN. Sirve una sola vez.',
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="flex items-center justify-between gap-2 rounded-lg border border-input bg-muted p-4">
              <code data-testid="codigo-de-celular" className="text-3xl font-bold tracking-widest">
                {codigo.codigo}
              </code>
              <Button
                variant="ghost"
                size="icon"
                className="cursor-pointer"
                onClick={() => copiar(codigo.codigo)}
                aria-label={t('celulares.acciones.copiar', { defaultValue: 'Copiar' })}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              {t('celulares.codigo.vence', { fecha: formatDate(codigo.expiraAt), defaultValue: 'Vence el {{fecha}}' })}
            </p>

            <DialogFooter className="gap-2 sm:justify-between">
              <Button variant="outline" onClick={onClose}>
                {t('celulares.cerrar', { defaultValue: 'Cerrar' })}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => copiar(codigo.codigo)}>
                  <Copy className="h-4 w-4 mr-1.5" />
                  {t('celulares.acciones.copiar', { defaultValue: 'Copiar' })}
                </Button>
                <Button onClick={() => mandarPorWhatsApp(codigo)}>
                  <MessageCircle className="h-4 w-4 mr-1.5" />
                  {t('celulares.acciones.whatsapp', { defaultValue: 'Mandar por WhatsApp' })}
                </Button>
              </div>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
