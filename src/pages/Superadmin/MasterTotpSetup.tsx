import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { AlertTriangle, Copy, Check, Shield, Clock, Key, Smartphone } from 'lucide-react'
import { useState } from 'react'
import { superadminAPI, type MasterTotpSetup as MasterTotpSetupData } from '@/services/superadmin.service'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'

export default function MasterTotpSetup() {
  const { toast } = useToast()
  const [copied, setCopied] = useState(false)

  const { data: totpData, isLoading, error } = useQuery<MasterTotpSetupData>({
    queryKey: ['superadmin', 'master-totp-setup'],
    queryFn: superadminAPI.getMasterTotpSetup,
  })

  const handleCopyUri = async () => {
    if (!totpData?.uri) return

    try {
      await navigator.clipboard.writeText(totpData.uri)
      setCopied(true)
      toast({
        title: 'URI copiada',
        description: 'La URI ha sido copiada al portapapeles',
        duration: 2000,
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast({
        title: 'Error',
        description: 'No se pudo copiar la URI',
        variant: 'destructive',
      })
    }
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Master TOTP Setup</h1>
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error de configuracion</AlertTitle>
          <AlertDescription>
            No se pudo cargar la configuracion TOTP. Asegurate de que TOTP_MASTER_SECRET esta configurado en el backend.
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-6 w-6 text-amber-500" />
          Master TOTP Setup
        </h1>
        <p className="text-muted-foreground mt-1">
          Configura Google Authenticator para acceso de emergencia a cualquier TPV
        </p>
      </div>

      {/* Warning */}
      <Alert className="border-amber-500/50 bg-amber-500/10">
        <AlertTriangle className="h-4 w-4 text-amber-500" />
        <AlertTitle className="text-amber-600">Acceso de Emergencia - Solo SUPERADMIN</AlertTitle>
        <AlertDescription className="text-amber-600/80">
          Este codigo TOTP permite acceso completo a CUALQUIER terminal TPV como SUPERADMIN.
          Manten este secreto privado y comparte solo con personal de confianza autorizado.
          Todos los accesos master son auditados.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* QR Code Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Smartphone className="h-5 w-5" />
              Escanea con Google Authenticator
            </CardTitle>
            <CardDescription>
              Escanea este codigo QR para agregar el acceso master a tu aplicacion de autenticacion
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center space-y-4">
            {isLoading ? (
              <Skeleton className="w-[200px] h-[200px]" />
            ) : totpData ? (
              <>
                <div className="p-4 bg-white rounded-xl">
                  <QRCodeSVG value={totpData.uri} size={200} level="M" bgColor="#ffffff" fgColor="#000000" />
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={handleCopyUri}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copiada' : 'Copiar URI'}
                </Button>
              </>
            ) : null}
          </CardContent>
        </Card>

        {/* Configuration Details */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Key className="h-5 w-5" />
              Detalles de Configuracion
            </CardTitle>
            <CardDescription>Parametros del TOTP para configuracion manual</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ) : totpData ? (
              <>
                <div className="space-y-3">
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Emisor</span>
                    <span className="font-medium">{totpData.issuer}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Etiqueta</span>
                    <span className="font-medium">{totpData.label}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Digitos</span>
                    <span className="font-mono font-medium">{totpData.digits}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-border/50">
                    <span className="text-muted-foreground">Periodo</span>
                    <span className="font-mono font-medium">{totpData.period} segundos</span>
                  </div>
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">Algoritmo</span>
                    <span className="font-mono font-medium">{totpData.algorithm}</span>
                  </div>
                </div>
              </>
            ) : null}
          </CardContent>
        </Card>
      </div>

      {/* Usage Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Como usar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="list-decimal list-inside space-y-2 text-muted-foreground">
            <li>
              Escanea el codigo QR con <strong>Google Authenticator</strong> (o cualquier app TOTP compatible)
            </li>
            <li>
              La app generara un codigo de <strong>8 digitos</strong> que cambia cada <strong>60 segundos</strong>
            </li>
            <li>
              En cualquier TPV, ingresa el codigo de 8 digitos como PIN de acceso
            </li>
            <li>
              El sistema detectara automaticamente que es un codigo master y te dara acceso como SUPERADMIN
            </li>
            <li>
              Todas las sesiones master son <strong>auditadas</strong> con registro de IP, terminal y timestamp
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  )
}
