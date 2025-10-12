import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import api from '@/api'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FlaskConical, Receipt, Trash2, CheckCircle, AlertCircle, ExternalLink, Loader2 } from 'lucide-react'
import { format } from 'date-fns'
import { PaymentMethod } from '@/types'
import { useToast } from '@/hooks/use-toast'

interface TestPayment {
  id: string
  venueId: string
  amount: string
  tipAmount: string
  method: PaymentMethod
  status: string
  createdAt: string
  order: {
    orderNumber: string
  }
  processedBy: {
    firstName: string
    lastName: string
  }
  venue: {
    name: string
    slug: string
  }
  receipts: Array<{
    accessKey: string
  }>
  digitalReceipt?: {
    accessKey: string
    receiptUrl: string
  }
}

const PAYMENT_METHODS = [
  { value: PaymentMethod.CASH, label: 'Cash', icon: '💵' },
  { value: PaymentMethod.CREDIT_CARD, label: 'Credit Card', icon: '💳' },
  { value: PaymentMethod.DEBIT_CARD, label: 'Debit Card', icon: '💳' },
]

export default function TestingPayments() {
  const { t } = useTranslation()
  const { allVenues } = useAuth()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [selectedVenue, setSelectedVenue] = useState<string>('')
  const [amount, setAmount] = useState<string>('500')
  const [includeTip, setIncludeTip] = useState<boolean>(false)
  const [tipAmount, setTipAmount] = useState<string>('50')
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH)
  const [lastCreatedPayment, setLastCreatedPayment] = useState<TestPayment | null>(null)

  // Fetch recent test payments
  const { data: testPayments, isLoading: isLoadingPayments } = useQuery({
    queryKey: ['testPayments', selectedVenue],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (selectedVenue) params.append('venueId', selectedVenue)
      params.append('limit', '10')

      const response = await api.get(`/api/v1/dashboard/testing/payments?${params.toString()}`)
      return response.data.data as TestPayment[]
    },
    enabled: true,
  })

  // Create test payment mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (data: { venueId: string; amount: number; tipAmount: number; method: PaymentMethod }) => {
      const response = await api.post('/api/v1/dashboard/testing/payment/fast', data)
      return response.data
    },
    onSuccess: data => {
      toast({
        title: t('testing.paymentCreated'),
        description: t('testing.paymentCreatedDesc'),
      })
      setLastCreatedPayment(data.data.payment)
      queryClient.invalidateQueries({ queryKey: ['testPayments'] })
    },
    onError: error => {
      console.error('Error creating test payment:', error)
      toast({
        title: t('testing.paymentFailed'),
        description: t('testing.paymentFailedDesc'),
        variant: 'destructive',
      })
    },
  })

  // Delete test payment mutation
  const deletePaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      await api.delete(`/api/v1/dashboard/testing/payment/${paymentId}`)
    },
    onSuccess: () => {
      toast({
        title: t('testing.paymentDeleted'),
        description: t('testing.paymentDeletedDesc'),
      })
      queryClient.invalidateQueries({ queryKey: ['testPayments'] })
    },
    onError: error => {
      console.error('Error deleting test payment:', error)
      toast({
        title: t('testing.deleteFailed'),
        description: t('testing.deleteFailedDesc'),
        variant: 'destructive',
      })
    },
  })

  const handleCreatePayment = () => {
    if (!selectedVenue) {
      toast({
        title: t('testing.selectVenue'),
        description: t('testing.selectVenueDesc'),
        variant: 'destructive',
      })
      return
    }

    const amountInCents = Math.round(parseFloat(amount) * 100)
    const tipInCents = includeTip ? Math.round(parseFloat(tipAmount) * 100) : 0

    createPaymentMutation.mutate({
      venueId: selectedVenue,
      amount: amountInCents,
      tipAmount: tipInCents,
      method: paymentMethod,
    })
  }

  const formatCurrency = (cents: string | number) => {
    const amount = typeof cents === 'string' ? parseFloat(cents) : cents
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount)
  }

  const getMethodBadgeColor = (method: PaymentMethod) => {
    switch (method) {
      case 'CASH':
        return 'bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-200'
      case 'CREDIT_CARD':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-200'
      case 'DEBIT_CARD':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-200'
      default:
        return 'bg-muted text-muted-foreground'
    }
  }

  const getStatusBadge = (status: string) => {
    const isCompleted = status === 'COMPLETED'
    return (
      <Badge variant={isCompleted ? 'default' : 'secondary'} className="gap-1">
        {isCompleted ? <CheckCircle className="h-3 w-3" /> : <AlertCircle className="h-3 w-3" />}
        {status}
      </Badge>
    )
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <FlaskConical className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('testing.title')}</h1>
          <p className="text-muted-foreground">{t('testing.subtitle')}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Configuration Panel */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>{t('testing.configuration')}</CardTitle>
            <CardDescription>{t('testing.configDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Venue Selection */}
            <div className="space-y-2">
              <Label htmlFor="venue">{t('testing.selectVenue')}</Label>
              <Select value={selectedVenue} onValueChange={setSelectedVenue}>
                <SelectTrigger id="venue">
                  <SelectValue placeholder={t('testing.selectVenuePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {allVenues.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Separator />

            {/* Payment Method */}
            <div className="space-y-2">
              <Label>{t('testing.paymentMethod')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {PAYMENT_METHODS.map(method => (
                  <button
                    key={method.value}
                    onClick={() => setPaymentMethod(method.value as PaymentMethod)}
                    className={`flex flex-col items-center justify-center gap-2 p-3 rounded-lg border-2 transition-all ${
                      paymentMethod === method.value
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-border bg-card hover:border-muted-foreground/50'
                    }`}
                  >
                    <span className="text-2xl">{method.icon}</span>
                    <span className="text-xs font-medium">{method.label}</span>
                  </button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="amount">{t('testing.amount')}</Label>
              <Input
                id="amount"
                type="number"
                step="0.01"
                min="0"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="500.00"
                className="text-lg font-semibold"
              />
              <p className="text-xs text-muted-foreground">
                {t('testing.total')}: {formatCurrency(parseFloat(amount || '0'))}
              </p>
            </div>

            {/* Tip Toggle */}
            <div className="flex items-center justify-between rounded-lg border border-border bg-card p-3">
              <Label htmlFor="includeTip" className="cursor-pointer">
                {t('testing.includeTip')}
              </Label>
              <Switch id="includeTip" checked={includeTip} onCheckedChange={setIncludeTip} />
            </div>

            {/* Tip Amount (conditional) */}
            {includeTip && (
              <div className="space-y-2">
                <Label htmlFor="tipAmount">{t('testing.tipAmount')}</Label>
                <Input
                  id="tipAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={tipAmount}
                  onChange={e => setTipAmount(e.target.value)}
                  placeholder="50.00"
                />
                <p className="text-xs text-muted-foreground">
                  {t('testing.tipTotal')}: {formatCurrency(parseFloat(tipAmount || '0'))}
                </p>
              </div>
            )}

            <Separator />

            {/* Execute Button */}
            <Button onClick={handleCreatePayment} disabled={createPaymentMutation.isPending || !selectedVenue} className="w-full" size="lg">
              {createPaymentMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t('testing.creating')}
                </>
              ) : (
                <>
                  <FlaskConical className="mr-2 h-4 w-4" />
                  {t('testing.executeTest')}
                </>
              )}
            </Button>

            {/* Total Summary */}
            <div className="rounded-lg bg-muted p-4">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">{t('testing.grandTotal')}:</span>
                <span className="text-xl font-bold text-foreground">
                  {formatCurrency(parseFloat(amount || '0') + (includeTip ? parseFloat(tipAmount || '0') : 0))}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Results Panel */}
        <div className="lg:col-span-2 space-y-6">
          {/* Last Created Payment */}
          {lastCreatedPayment && (
            <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/50">
              <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
              <AlertDescription>
                <div className="flex flex-col gap-2">
                  <div className="font-semibold text-green-800 dark:text-green-200">{t('testing.lastPayment')}</div>
                  <div className="grid grid-cols-2 gap-2 text-sm text-green-700 dark:text-green-300">
                    <div>
                      <span className="font-medium">{t('testing.paymentId')}:</span> {lastCreatedPayment.id.slice(0, 8)}...
                    </div>
                    <div>
                      <span className="font-medium">{t('testing.orderNumber')}:</span> {lastCreatedPayment.order.orderNumber}
                    </div>
                    <div>
                      <span className="font-medium">{t('testing.amount')}:</span> {formatCurrency(lastCreatedPayment.amount)}
                    </div>
                    <div>
                      <span className="font-medium">{t('testing.tip')}:</span> {formatCurrency(lastCreatedPayment.tipAmount)}
                    </div>
                  </div>
                  {lastCreatedPayment.digitalReceipt && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-fit mt-2"
                      onClick={() => window.open(lastCreatedPayment.digitalReceipt!.receiptUrl, '_blank')}
                    >
                      <Receipt className="mr-2 h-4 w-4" />
                      {t('testing.viewReceipt')}
                      <ExternalLink className="ml-2 h-3 w-3" />
                    </Button>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Recent Tests Table */}
          <Card>
            <CardHeader>
              <CardTitle>{t('testing.recentTests')}</CardTitle>
              <CardDescription>
                {t('testing.showingTests', { count: testPayments?.length || 0 })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {isLoadingPayments ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : testPayments && testPayments.length > 0 ? (
                <div className="rounded-md border border-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t('testing.id')}</TableHead>
                        <TableHead>{t('testing.venue')}</TableHead>
                        <TableHead className="text-right">{t('testing.amount')}</TableHead>
                        <TableHead className="text-right">{t('testing.tip')}</TableHead>
                        <TableHead>{t('testing.method')}</TableHead>
                        <TableHead>{t('testing.status')}</TableHead>
                        <TableHead>{t('testing.date')}</TableHead>
                        <TableHead className="text-right">{t('testing.actions')}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {testPayments.map(payment => (
                        <TableRow key={payment.id}>
                          <TableCell className="font-mono text-xs">{payment.id.slice(0, 8)}...</TableCell>
                          <TableCell className="font-medium">{payment.venue.name}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(payment.amount)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(payment.tipAmount)}</TableCell>
                          <TableCell>
                            <Badge className={getMethodBadgeColor(payment.method)}>{payment.method.replace('_', ' ')}</Badge>
                          </TableCell>
                          <TableCell>{getStatusBadge(payment.status)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {format(new Date(payment.createdAt), 'MMM dd, HH:mm')}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-2">
                              {payment.receipts.length > 0 && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => window.open(`/receipts/public/${payment.receipts[0].accessKey}`, '_blank')}
                                >
                                  <Receipt className="h-4 w-4" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => deletePaymentMutation.mutate(payment.id)}
                                disabled={deletePaymentMutation.isPending}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <FlaskConical className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">{t('testing.noTests')}</p>
                  <p className="text-sm text-muted-foreground">{t('testing.createFirst')}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
