import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, Clock, DollarSign } from 'lucide-react'
import { getVenueIncidents, SettlementIncident } from '@/services/settlementIncident.service'
import { ConfirmIncidentDialog } from './ConfirmIncidentDialog'
import { Skeleton } from '@/components/ui/skeleton'

interface PendingIncidentsAlertProps {
  venueId: string
}

export function PendingIncidentsAlert({ venueId }: PendingIncidentsAlertProps) {
  const { t } = useTranslation(['settlementIncidents', 'common'])
  const [selectedIncident, setSelectedIncident] = useState<SettlementIncident | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)

  const { data, isLoading, error } = useQuery({
    queryKey: ['settlement-incidents', venueId, 'pending'],
    queryFn: () => getVenueIncidents(venueId, { status: 'pending' }),
    refetchInterval: 60000, // Refetch every minute
  })

  const pendingIncidents = data?.data || []

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent>
          <Skeleton className="h-20 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return null // Silently fail - this is not critical
  }

  if (pendingIncidents.length === 0) {
    return null // Don't show anything if no pending incidents
  }

  const handleConfirmClick = (incident: SettlementIncident) => {
    setSelectedIncident(incident)
    setDialogOpen(true)
  }

  const totalPendingAmount = pendingIncidents.reduce((sum, incident) => sum + Number(incident.amount), 0)
  const formattedTotalAmount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(totalPendingAmount)

  return (
    <>
      <Alert variant="warning" className="border-orange-200 bg-orange-50 dark:bg-orange-950/20">
        <AlertCircle className="h-5 w-5 text-orange-600" />
        <AlertTitle className="text-orange-900 dark:text-orange-100">
          {t('pendingAlert.title', { count: pendingIncidents.length })}
        </AlertTitle>
        <AlertDescription className="text-orange-800 dark:text-orange-200">
          {t('pendingAlert.description', { amount: formattedTotalAmount })}
        </AlertDescription>
      </Alert>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('pendingIncidents.title')}
          </CardTitle>
          <CardDescription>{t('pendingIncidents.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {pendingIncidents.map((incident) => {
            const estimatedDate = new Date(incident.estimatedSettlementDate)
            const formattedDate = format(estimatedDate, 'PPP', { locale: es })
            const formattedAmount = new Intl.NumberFormat('es-MX', {
              style: 'currency',
              currency: 'MXN',
            }).format(Number(incident.amount))

            return (
              <div
                key={incident.id}
                className="flex items-center justify-between rounded-lg border p-4 hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{formattedAmount}</span>
                    <Badge variant="outline" className="text-xs">
                      {incident.processorName}
                    </Badge>
                    <Badge variant="secondary" className="text-xs">
                      {incident.cardType}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    <span>
                      {t('pendingIncidents.expectedOn')} {formattedDate}
                    </span>
                  </div>
                </div>
                <Button onClick={() => handleConfirmClick(incident)} size="sm">
                  {t('pendingIncidents.confirmButton')}
                </Button>
              </div>
            )
          })}

          {/* Total Summary */}
          <div className="flex items-center justify-between rounded-lg bg-muted p-4 mt-4">
            <div className="flex items-center gap-2 font-semibold">
              <DollarSign className="h-5 w-5" />
              {t('pendingIncidents.totalPending')}
            </div>
            <div className="text-lg font-bold">{formattedTotalAmount}</div>
          </div>
        </CardContent>
      </Card>

      {/* Confirmation Dialog */}
      <ConfirmIncidentDialog incident={selectedIncident} venueId={venueId} open={dialogOpen} onOpenChange={setDialogOpen} />
    </>
  )
}
