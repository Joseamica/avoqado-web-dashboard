import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Zap, AlertCircle, CheckCircle2 } from 'lucide-react'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { useToast } from '@/hooks/use-toast'

interface BlumonAutoFetchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export const BlumonAutoFetchDialog: React.FC<BlumonAutoFetchDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    serialNumber: '',
    brand: 'PAX',
    model: 'A910S',
    displayName: '',
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const result = await paymentProviderAPI.autoFetchBlumonCredentials({
        serialNumber: formData.serialNumber,
        brand: formData.brand,
        model: formData.model,
        displayName: formData.displayName || undefined,
        environment: formData.environment,
      })

      toast({
        title: '✅ Credenciales obtenidas',
        description: (
          <div className="space-y-1 text-sm">
            <p>
              <strong>Merchant:</strong> {result.displayName}
            </p>
            <p>
              <strong>Serial:</strong> {result.serialNumber}
            </p>
            <p>
              <strong>POS ID:</strong> {result.posId}
            </p>
            <p>
              <strong>Env:</strong> {result.blumonEnvironment}
            </p>
            {!result.dukptKeysAvailable && (
              <p className="text-yellow-600 dark:text-yellow-400 mt-2">
                ℹ️ DUKPT keys se inicializarán en el primer pago
              </p>
            )}
          </div>
        ),
      })

      onOpenChange(false)
      onSuccess?.()

      // Reset form
      setFormData({
        serialNumber: '',
        brand: 'PAX',
        model: 'A910S',
        displayName: '',
        environment: 'SANDBOX',
      })
    } catch (error: any) {
      console.error('Auto-fetch error:', error)
      toast({
        variant: 'destructive',
        title: '❌ Error al obtener credenciales',
        description: error.response?.data?.message || error.message || 'Error desconocido',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <div className="flex items-center gap-2">
              <Zap className="h-5 w-5 text-yellow-500" />
              <DialogTitle>Auto-Fetch Blumon Credentials</DialogTitle>
            </div>
            <DialogDescription>
              Ingresa solo el serial, marca y modelo. El backend obtendrá automáticamente OAuth tokens, RSA keys y
              DUKPT keys desde Blumon.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Info Banner */}
            <div className="flex items-start space-x-2 text-sm bg-blue-50 dark:bg-blue-950/50 p-3 rounded-md border border-blue-200 dark:border-blue-800">
              <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-blue-600 dark:text-blue-400" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">Proceso automático en 3 pasos:</p>
                <ol className="list-decimal list-inside space-y-1 text-blue-700 dark:text-blue-300">
                  <li>OAuth Token (SHA256 password)</li>
                  <li>RSA Encryption Keys</li>
                  <li>DUKPT Keys (opcional - se inicializa en primer pago)</li>
                </ol>
              </div>
            </div>

            {/* Serial Number */}
            <div className="grid gap-2">
              <Label htmlFor="serialNumber">
                Serial Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="serialNumber"
                value={formData.serialNumber}
                onChange={(e) => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="2841548417"
                required
                className="bg-background border-input font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">Número de serie del dispositivo PAX</p>
            </div>

            {/* Brand */}
            <div className="grid gap-2">
              <Label htmlFor="brand">
                Brand <span className="text-destructive">*</span>
              </Label>
              <Select value={formData.brand} onValueChange={(value) => setFormData({ ...formData, brand: value })}>
                <SelectTrigger className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PAX">PAX</SelectItem>
                  <SelectItem value="Verifone">Verifone</SelectItem>
                  <SelectItem value="Ingenico">Ingenico</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Model */}
            <div className="grid gap-2">
              <Label htmlFor="model">
                Model <span className="text-destructive">*</span>
              </Label>
              <Input
                id="model"
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                placeholder="A910S"
                required
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">Modelo del dispositivo (ej: A910S, A920)</p>
            </div>

            {/* Display Name (Optional) */}
            <div className="grid gap-2">
              <Label htmlFor="displayName">Display Name (Opcional)</Label>
              <Input
                id="displayName"
                value={formData.displayName}
                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Cuenta Blumon A (Sandbox)"
                className="bg-background border-input"
              />
              <p className="text-xs text-muted-foreground">Si no se especifica, se genera automáticamente</p>
            </div>

            {/* Environment */}
            <div className="grid gap-2">
              <Label htmlFor="environment">
                Environment <span className="text-destructive">*</span>
              </Label>
              <Select
                value={formData.environment}
                onValueChange={(value: 'SANDBOX' | 'PRODUCTION') =>
                  setFormData({ ...formData, environment: value })
                }
              >
                <SelectTrigger className="bg-background border-input">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SANDBOX">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-yellow-500"></span>
                      Sandbox (Testing)
                    </div>
                  </SelectItem>
                  <SelectItem value="PRODUCTION">
                    <div className="flex items-center gap-2">
                      <span className="inline-block w-2 h-2 rounded-full bg-green-500"></span>
                      Production (Live)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Success Banner (shown when not loading) */}
            {!loading && (
              <div className="flex items-start space-x-2 text-sm bg-green-50 dark:bg-green-950/50 p-3 rounded-md border border-green-200 dark:border-green-800">
                <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-green-600 dark:text-green-400" />
                <p className="text-green-700 dark:text-green-300">
                  Las credenciales se encriptarán automáticamente antes de guardarlas en la base de datos (AES-256-CBC).
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {loading ? 'Obteniendo credenciales...' : 'Obtener Credenciales'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
