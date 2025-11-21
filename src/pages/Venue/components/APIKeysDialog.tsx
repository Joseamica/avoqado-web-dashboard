import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Copy, RefreshCw, Loader2, AlertCircle, CheckCircle2, Key } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { ecommerceMerchantAPI, type EcommerceMerchant } from '@/services/ecommerceMerchant.service'

interface APIKeysDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  merchant: EcommerceMerchant | null
  venueId: string
}

export const APIKeysDialog: React.FC<APIKeysDialogProps> = ({
  open,
  onOpenChange,
  merchant,
  venueId,
}) => {
  const { t } = useTranslation('ecommerce')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [confirmRegenerateOpen, setConfirmRegenerateOpen] = useState(false)
  const [newSecretKey, setNewSecretKey] = useState<string | null>(null)

  // Fetch API keys
  const {
    data: keys,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['ecommerce-merchant-keys', merchant?.id],
    queryFn: () => ecommerceMerchantAPI.getAPIKeys(venueId, merchant!.id),
    enabled: !!merchant && open,
  })

  // Regenerate keys mutation
  const regenerateMutation = useMutation({
    mutationFn: () => ecommerceMerchantAPI.regenerateKeys(venueId, merchant!.id),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchant-keys', merchant?.id] })
      queryClient.invalidateQueries({ queryKey: ['ecommerce-merchants', venueId] })

      // Store new secret key to display
      setNewSecretKey(data.secretKey)

      toast({
        title: '✅ API Keys Regeneradas',
        description: 'Las claves antiguas ya no son válidas',
      })

      setConfirmRegenerateOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.error || 'No se pudieron regenerar las claves',
        variant: 'destructive',
      })
    },
  })

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado',
      description: `${label} copiado al portapapeles`,
    })
  }

  const handleRegenerate = () => {
    setConfirmRegenerateOpen(true)
  }

  const confirmRegenerate = () => {
    regenerateMutation.mutate()
  }

  if (!merchant) return null

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              API Keys - {merchant.channelName}
            </DialogTitle>
            <DialogDescription>
              Usa estas claves para integrar pagos en tu aplicación o sitio web
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {isLoading ? (
              <div className="flex justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : error ? (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Error al cargar las claves: {(error as any).message}
                </AlertDescription>
              </Alert>
            ) : (
              <>
                {/* Mode Badge */}
                <div>
                  <Badge variant={keys?.sandboxMode ? 'secondary' : 'default'} className="text-sm">
                    {keys?.sandboxMode ? '🧪 Modo Sandbox (Pruebas)' : '🚀 Modo Live (Producción)'}
                  </Badge>
                </div>

                {/* New Secret Key Alert (after regeneration) */}
                {newSecretKey && (
                  <Alert className="border-green-200 bg-green-50 dark:bg-green-900/20">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <AlertDescription>
                      <p className="font-semibold text-green-800 dark:text-green-200 mb-2">
                        ⚠️ Guarda tu nuevo Secret Key ahora:
                      </p>
                      <div className="bg-background p-3 rounded font-mono text-sm break-all border border-green-300">
                        {newSecretKey}
                      </div>
                      <div className="flex gap-2 mt-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyToClipboard(newSecretKey, 'Secret Key')}
                        >
                          <Copy className="mr-2 h-3 w-3" />
                          Copiar
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setNewSecretKey(null)}
                        >
                          Cerrar aviso
                        </Button>
                      </div>
                      <p className="text-xs text-green-700 dark:text-green-300 mt-2">
                        No podrás volver a ver esta clave. Guárdala en un lugar seguro.
                      </p>
                    </AlertDescription>
                  </Alert>
                )}

                {/* Public Key */}
                <div className="space-y-2">
                  <Label>{t('apiKeysDialog.publicKey')}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm break-all">
                      {keys?.publicKey}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => copyToClipboard(keys?.publicKey || '', 'Public Key')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Usa esta clave en tu frontend (JavaScript, móvil). Es segura para compartir.
                  </p>
                </div>

                {/* Secret Key (Masked) */}
                <div className="space-y-2">
                  <Label>{t('apiKeysDialog.secretKey')}</Label>
                  <div className="flex items-center gap-2">
                    <code className="flex-1 bg-muted px-3 py-2 rounded text-sm">
                      {keys?.secretKey}
                    </code>
                    <Button
                      variant="outline"
                      size="icon"
                      disabled
                      title={t('apiKeysDialog.secretKeyMasked')}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                  <Alert>
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Por seguridad, el Secret Key está enmascarado. Solo se muestra completo al
                      crear el canal o al regenerar las claves.
                    </AlertDescription>
                  </Alert>
                </div>

                {/* Regenerate Warning */}
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    <p className="font-semibold mb-1">{t('apiKeysDialog.regenerateWarning')}</p>
                    <p className="text-sm">
                      Si regeneras las API keys, las claves actuales dejarán de funcionar
                      inmediatamente. Todas tus integraciones dejarán de funcionar hasta que las
                      actualices con las nuevas claves.
                    </p>
                  </AlertDescription>
                </Alert>
              </>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleRegenerate}
              disabled={isLoading || regenerateMutation.isPending}
            >
              {regenerateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Regenerar Claves
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmRegenerateOpen} onOpenChange={setConfirmRegenerateOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('apiKeysDialog.regenerateTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. Las claves actuales dejarán de funcionar
              inmediatamente y todas tus integraciones se romperán hasta que actualices las claves.
              <br />
              <br />
              <strong>{t('apiKeysDialog.channel')}</strong> {merchant.channelName}
              <br />
              <strong>{t('apiKeysDialog.mode')}</strong> {keys?.sandboxMode ? 'Sandbox' : 'Live'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('apiKeysDialog.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmRegenerate}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {regenerateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sí, Regenerar Claves
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
