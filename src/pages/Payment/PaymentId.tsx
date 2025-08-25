import api from '@/api'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import { Currency } from '@/utils/currency'
import { useQuery, useMutation } from '@tanstack/react-query'
import { 
  ArrowLeft, 
  Receipt, 
  Mail, 
  Eye, 
  ExternalLink, 
  CheckCircle2, 
  XCircle, 
  Clock, 
  AlertCircle,
  CreditCard,
  User,
  Calendar,
  RefreshCw,
  DollarSign,
  TrendingUp,
  FileText,
  Shield,
  Copy,
  Download
} from 'lucide-react'
import { Link, useLocation, useParams } from 'react-router-dom'
import getIcon from '@/utils/getIcon'
import { Button } from '@/components/ui/button'
import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import ReceiptPreview from '@/components/receipts/ReceiptPreview'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Progress } from '@/components/ui/progress'

export default function PaymentId() {
  const { paymentId } = useParams<{ paymentId: string }>()
  const location = useLocation()

  const [emailDialogOpen, setEmailDialogOpen] = useState(false)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [selectedReceipt, setSelectedReceipt] = useState<any>(null)
  const { toast } = useToast()
  const { venueId } = useCurrentVenue()

  const {
    data: payment,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['payment', paymentId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}`)
      return response.data
    },
    enabled: !!paymentId,
  })

  const { data: receipts = [], isLoading: isLoadingReceipts } = useQuery({
    queryKey: ['receipts', paymentId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/receipts`)
      return response.data
    },
    enabled: !!paymentId,
  })

  const from = (location.state as any)?.from || `/venues/${venueId}/payments`

  const sendReceiptMutation = useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const response = await api.post(`/api/v1/dashboard/venues/${venueId}/payments/${paymentId}/send-receipt`, {
        recipientEmail: email,
      })
      return response.data
    },
    onSuccess: _data => {
      toast({
        title: 'Recibo enviado',
        description: `Se ha enviado el recibo digital exitosamente`,
      })
      setEmailDialogOpen(false)
      refetch()
    },
    onError: _error => {
      toast({
        title: 'Error',
        description: 'No se pudo enviar el recibo digital',
        variant: 'destructive',
      })
    },
  })

  // Enhanced status badge styling for enterprise look
  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'VIEWED':
        return 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-800 dark:text-emerald-200 border-emerald-200 dark:border-emerald-800'
      case 'DELIVERED':
        return 'bg-blue-100 dark:bg-blue-950/30 text-blue-800 dark:text-blue-200 border-blue-200 dark:border-blue-800'
      case 'SENT':
        return 'bg-amber-100 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200 border-amber-200 dark:border-amber-800'
      case 'ERROR':
        return 'bg-red-100 dark:bg-red-950/30 text-red-800 dark:text-red-200 border-red-200 dark:border-red-800'
      case 'PENDING':
      default:
        return 'bg-muted text-muted-foreground border-border'
    }
  }

  // Payment status styling
  const getPaymentStatusStyle = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'ACCEPTED':
        return {
          badge: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-200 border border-emerald-200 dark:border-emerald-800',
          icon: CheckCircle2,
          color: 'text-emerald-500'
        }
      case 'PENDING':
        return {
          badge: 'bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-200 border border-amber-200 dark:border-amber-800', 
          icon: Clock,
          color: 'text-amber-500'
        }
      case 'FAILED':
      case 'REJECTED':
        return {
          badge: 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-200 border border-red-200 dark:border-red-800',
          icon: XCircle,
          color: 'text-red-500'
        }
      default:
        return {
          badge: 'bg-muted text-muted-foreground border border-border',
          icon: AlertCircle,
          color: 'text-muted-foreground'
        }
    }
  }

  // Copy to clipboard helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text)
    toast({
      title: 'Copiado',
      description: `${label} copiado al portapapeles`,
    })
  }

  const formatReceiptDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  const viewReceipt = (receipt: any) => {
    setSelectedReceipt(receipt)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Cargando información del pago...</p>
      </div>
    )
  }

  const paymentStatus = getPaymentStatusStyle(payment?.status)
  const StatusIcon = paymentStatus.icon

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-muted to-background">
        {/* Enhanced Header */}
        <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center space-x-4">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="sm" asChild>
                    <Link to={from}>
                      <ArrowLeft className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Volver a pagos</TooltipContent>
              </Tooltip>
              <div>
                <h1 className="text-xl font-semibold text-foreground">Detalles del Pago</h1>
                <p className="text-sm text-muted-foreground">ID: {payment?.id}</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <Badge variant="outline" className={paymentStatus.badge}>
                <StatusIcon className={`h-3 w-3 mr-1 ${paymentStatus.color}`} />
                {payment?.status === 'ACCEPTED' ? 'Aceptado' : payment?.status || 'Desconocido'}
              </Badge>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Total</p>
                <p className="text-lg font-bold text-foreground">{Currency(payment?.totalAmount || 0)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto p-6 space-y-6">
          {/* Quick Stats Overview */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Monto Base</p>
                    <p className="text-2xl font-bold text-foreground">{Currency(payment?.amount || 0)}</p>
                  </div>
                  <DollarSign className="h-8 w-8 text-emerald-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-blue-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Propinas</p>
                    <p className="text-2xl font-bold text-foreground">{Currency(payment?.tipAmount || 0)}</p>
                    <p className="text-xs text-muted-foreground">
                      {payment?.amount && payment.amount > 0 
                        ? (((payment?.tipAmount || 0) / payment.amount) * 100).toFixed(1) 
                        : '0.0'}%
                    </p>
                  </div>
                  <TrendingUp className="h-8 w-8 text-blue-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-purple-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Método</p>
                    <div className="flex items-center space-x-2 mt-1">
                      {payment?.method === 'CARD' && payment?.cardBrand && (
                        <span className="text-lg">{getIcon(payment.cardBrand)}</span>
                      )}
                      <p className="font-semibold text-sm">
                        {payment?.method === 'CARD'
                          ? `****${payment?.last4 || '0000'}`
                          : payment?.method === 'CASH'
                          ? 'Efectivo'
                          : payment?.method || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <CreditCard className="h-8 w-8 text-purple-500" />
                </div>
              </CardContent>
            </Card>
            
            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Mesero</p>
                    <p className="text-lg font-bold text-foreground">{payment?.waiter?.nombre || 'N/A'}</p>
                  </div>
                  <User className="h-8 w-8 text-orange-500" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Action Bar */}
          {payment?.token && (
            <Card className="bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/50 border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span className="font-medium text-foreground">Acciones del Pago</span>
                  </div>
                  <div className="flex space-x-2">
                    <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50">
                          <Mail className="w-4 h-4 mr-2" />
                          Enviar Recibo Digital
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader>
                          <DialogTitle className="flex items-center space-x-2">
                            <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                            <span>Enviar Recibo Digital</span>
                          </DialogTitle>
                        </DialogHeader>
                        <div className="mt-4 space-y-4">
                          <div className="grid gap-2">
                            <Label htmlFor="email">Correo electrónico del destinatario</Label>
                            <Input
                              id="email"
                              type="email"
                              placeholder="correo@ejemplo.com"
                              value={recipientEmail}
                              onChange={e => setRecipientEmail(e.target.value)}
                              className="w-full"
                            />
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              onClick={() => setEmailDialogOpen(false)}
                              className="flex-1"
                            >
                              Cancelar
                            </Button>
                            <Button
                              disabled={!recipientEmail || sendReceiptMutation.isPending}
                              onClick={() => sendReceiptMutation.mutate({ email: recipientEmail })}
                              className="flex-1"
                            >
                              {sendReceiptMutation.isPending ? (
                                <><RefreshCw className="w-4 h-4 mr-2 animate-spin" />Enviando...</>
                              ) : (
                                <>Enviar</>
                              )}
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => window.open(`${import.meta.env.VITE_FRONTEND_URL}/receipt?token=${payment.token}`, '_blank')}
                    >
                      <Receipt className="w-4 h-4 mr-2" />
                      Ver Recibo
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => copyToClipboard(payment?.id || '', 'ID del pago')}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copiar ID
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="bg-background hover:bg-blue-50 dark:hover:bg-blue-950/50"
                      onClick={() => {
                        // Export payment details as JSON
                        const data = JSON.stringify(payment, null, 2)
                        const blob = new Blob([data], { type: 'application/json' })
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `payment-${payment?.id}.json`
                        a.click()
                        URL.revokeObjectURL(url)
                      }}
                    >
                      <Download className="w-4 h-4 mr-2" />
                      Exportar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Transaction Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              
              {/* Payment Information Card */}
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-muted to-blue-50 dark:to-blue-950/50 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                    <span>Información de la Transacción</span>
                  </CardTitle>
                  <CardDescription>Detalles completos de la transacción de pago</CardDescription>
                </CardHeader>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground flex items-center space-x-1">
                        <Calendar className="h-4 w-4" />
                        <span>Fecha y Hora</span>
                      </Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-sm">
                          {payment?.createdAt ? new Date(payment.createdAt).toLocaleString('es-ES', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                          }) : '-'}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Referencia</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-sm">{payment?.reference || 'No disponible'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Mesa</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="text-sm">{payment?.tableNumber || 'No especificada'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-sm font-medium text-muted-foreground">Autorización</Label>
                      <div className="p-3 bg-muted rounded-md border border-border">
                        <p className="font-mono text-xs break-all">{payment?.mentaAuthorizationReference || 'No disponible'}</p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Bill Information */}
                  <div className="border-t pt-4">
                    <h4 className="font-medium mb-3 text-sm text-muted-foreground">Información de la Cuenta</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">ID de Cuenta</Label>
                        <div className="p-3 bg-muted rounded-md border border-border">
                          <p className="font-mono text-sm">{payment?.billId || payment?.billV2Id || 'No disponible'}</p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium text-muted-foreground">ID de Turno</Label>
                        <div className="p-3 bg-muted rounded-md border border-border">
                          <p className="font-mono text-sm">{payment?.shift?.turnId || 'No disponible'}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Digital Receipts Section */}
              <Card className="shadow-lg">
                <CardHeader className="bg-gradient-to-r from-muted to-green-50 dark:to-green-950/50 border-b">
                  <CardTitle className="flex items-center space-x-2">
                    <Receipt className="h-5 w-5 text-green-600 dark:text-green-400" />
                    <span>Recibos Digitales</span>
                  </CardTitle>
                  <CardDescription>Historial completo de recibos enviados para esta transacción</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                  {isLoadingReceipts ? (
                    <div className="flex items-center justify-center py-8">
                      <RefreshCw className="h-6 w-6 animate-spin text-blue-500 mr-2" />
                      <span className="text-muted-foreground">Cargando recibos...</span>
                    </div>
                  ) : receipts && receipts.length > 0 ? (
                    <div className="space-y-3">
                      {receipts.map((receipt: any) => (
                        <div key={receipt.id} className="flex justify-between items-center p-4 rounded-lg border border-border hover:shadow-md transition-shadow">
                          <div className="space-y-2">
                            <div className="flex items-center space-x-3">
                              <Badge variant="secondary" className={`${getStatusBadgeColor(receipt.status)} font-medium`}>
                                {receipt.status}
                              </Badge>
                              <span className="font-medium text-foreground">{receipt.recipientEmail || 'Sin destinatario'}</span>
                            </div>
                            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
                              <span className="flex items-center space-x-1">
                                <Calendar className="h-3 w-3" />
                                <span>{formatReceiptDate(receipt.createdAt)}</span>
                              </span>
                              <span className="flex items-center space-x-1">
                                <FileText className="h-3 w-3" />
                                <span>ID: {receipt.id.slice(0, 8)}...</span>
                              </span>
                            </div>
                          </div>
                          <div className="flex space-x-2">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button variant="ghost" size="sm" onClick={() => viewReceipt(receipt)} className="hover:bg-blue-50 dark:hover:bg-blue-950/30">
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Ver recibo</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-green-50 dark:hover:bg-green-950/30"
                                  onClick={() => {
                                    const publicUrl = `${window.location.origin}/receipts/public/${receipt.accessKey}`
                                    window.open(publicUrl, '_blank')
                                  }}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Abrir enlace público</TooltipContent>
                            </Tooltip>
                            
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="hover:bg-muted"
                                  onClick={() => copyToClipboard(
                                    `${window.location.origin}/receipts/public/${receipt.accessKey}`,
                                    'Enlace del recibo'
                                  )}
                                >
                                  <Copy className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Copiar enlace</TooltipContent>
                            </Tooltip>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <Alert className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30">
                      <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                      <AlertDescription className="text-amber-800 dark:text-amber-200">
                        No se han enviado recibos digitales para esta transacción.
                      </AlertDescription>
                    </Alert>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              
              {/* Payment Status Card */}
              <Card className="shadow-lg border-t-4 border-t-blue-500">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                    <span>Estado del Pago</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="text-center py-4">
                    <div className="mx-auto w-16 h-16 bg-green-100 dark:bg-green-900/50 rounded-full flex items-center justify-center mb-3">
                      <StatusIcon className={`h-8 w-8 ${paymentStatus.color}`} />
                    </div>
                    <Badge variant="outline" className={`${paymentStatus.badge} text-sm px-3 py-1`}>
                      {payment?.status === 'ACCEPTED' ? 'Pago Aceptado' : payment?.status || 'Estado Desconocido'}
                    </Badge>
                    <p className="text-xs text-muted-foreground mt-2">
                      Última actualización: {payment?.updatedAt ? new Date(payment.updatedAt).toLocaleString('es-ES') : 'No disponible'}
                    </p>
                  </div>
                  
                  {payment?.status === 'ACCEPTED' && (
                    <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-3">
                      <div className="flex items-start space-x-2">
                        <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium text-green-800 dark:text-green-200">Transacción Exitosa</p>
                          <p className="text-xs text-green-600 dark:text-green-400">El pago se procesó correctamente</p>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Summary Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <DollarSign className="h-5 w-5 text-green-500" />
                    <span>Resumen Financiero</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <span className="text-sm font-medium text-muted-foreground">Subtotal</span>
                      <span className="text-lg font-bold">{Currency(payment?.amount || 0)}</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-muted-foreground">Propinas</span>
                        <p className="text-xs text-muted-foreground">
                          {payment?.amount && payment.amount > 0 
                            ? `${(((payment?.tipAmount || 0) / payment.amount) * 100).toFixed(1)}% del subtotal`
                            : '0.0% del subtotal'}
                        </p>
                      </div>
                      <span className="text-lg font-bold text-blue-600 dark:text-blue-400">{Currency(payment?.tipAmount || 0)}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border-2 border-green-200 dark:border-green-800">
                      <span className="text-base font-bold text-green-800 dark:text-green-200">Total</span>
                      <span className="text-xl font-bold text-green-800 dark:text-green-200">{Currency(payment?.totalAmount || 0)}</span>
                    </div>
                  </div>
                  
                  {/* Progress Bar */}
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Base</span>
                      <span>Propinas</span>
                    </div>
                    <Progress 
                      value={payment?.amount && payment.totalAmount 
                        ? (payment.amount / payment.totalAmount) * 100 
                        : 0} 
                      className="h-2"
                    />
                  </div>
                </CardContent>
              </Card>

              {/* Quick Info Card */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2 text-lg">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span>Información Rápida</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mesa:</span>
                      <span className="font-medium">{payment?.tableNumber || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Mesero:</span>
                      <span className="font-medium">{payment?.waiter?.nombre || 'N/A'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Turno:</span>
                      <span className="font-mono text-xs">{payment?.shift?.turnId || 'N/A'}</span>
                    </div>
                    <Separator className="my-2" />
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Método:</span>
                      <div className="flex items-center space-x-1">
                        {payment?.method === 'CARD' && payment?.cardBrand && (
                          <span className="text-sm">{getIcon(payment.cardBrand)}</span>
                        )}
                        <span className="text-sm font-medium">
                          {payment?.method === 'CARD'
                            ? `****${payment?.last4 || '0000'}`
                            : payment?.method === 'CASH'
                            ? 'Efectivo'
                            : payment?.method || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Tips Detail Section */}
          {payment?.tips && payment.tips.length > 0 && (
            <Card className="shadow-lg">
              <CardHeader className="bg-gradient-to-r from-muted to-green-50 dark:to-green-950/50 border-b">
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <span>Detalles de Propinas</span>
                </CardTitle>
                <CardDescription>Distribución detallada de las propinas para esta transacción</CardDescription>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-4">
                  {payment.tips.map((tip: any, index: number) => (
                    <div key={index} className="p-4 rounded-lg border border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="text-center">
                          <Label className="text-sm font-medium text-muted-foreground">Monto de Propina</Label>
                          <p className="text-xl font-bold text-green-700 dark:text-green-300">{Currency(parseFloat(tip.amount))}</p>
                        </div>
                        <div className="text-center">
                          <Label className="text-sm font-medium text-muted-foreground">Porcentaje</Label>
                          <p className="text-xl font-bold text-green-700 dark:text-green-300">{(parseFloat(tip.percentage) * 100).toFixed(1)}%</p>
                        </div>
                        <div className="text-center">
                          <Label className="text-sm font-medium text-muted-foreground">Beneficiario</Label>
                          <p className="text-lg font-semibold text-foreground">{tip.waiter?.nombre || 'No especificado'}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Footer */}
        <div className="border-t bg-muted mt-8">
          <div className="max-w-7xl mx-auto p-4">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <div className="flex items-center space-x-4">
                <span>© 2024 Avoqado POS System</span>
                <Separator orientation="vertical" className="h-4" />
                <span>Pago ID: {payment?.id}</span>
              </div>
              <div className="flex items-center space-x-2">
                <span>Generado el {new Date().toLocaleString('es-ES')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Receipt Preview Modal */}
      {selectedReceipt && (
        <ReceiptPreview 
          receipt={selectedReceipt} 
          open={!!selectedReceipt} 
          onClose={() => setSelectedReceipt(null)} 
        />
      )}
    </TooltipProvider>
  )
}