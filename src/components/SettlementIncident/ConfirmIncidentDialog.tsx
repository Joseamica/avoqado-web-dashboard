import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { SettlementIncident, confirmIncident } from '@/services/settlementIncident.service'

interface ConfirmIncidentDialogProps {
  incident: SettlementIncident | null
  venueId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ConfirmIncidentDialog({ incident, venueId, open, onOpenChange }: ConfirmIncidentDialogProps) {
  const { t } = useTranslation(['settlementIncidents', 'common'])
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [settlementArrived, setSettlementArrived] = useState<'yes' | 'no' | null>(null)
  const [actualDate, setActualDate] = useState<Date | undefined>(undefined)
  const [notes, setNotes] = useState('')

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!incident || settlementArrived === null) throw new Error('Invalid data')

      return confirmIncident(venueId, incident.id, {
        settlementArrived: settlementArrived === 'yes',
        actualDate: actualDate ? actualDate.toISOString() : undefined,
        notes: notes || undefined,
      })
    },
    onSuccess: (data) => {
      toast({
        title: t('confirmDialog.success'),
        description: data.message,
        variant: 'default',
      })
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['settlement-incidents', venueId] })
      queryClient.invalidateQueries({ queryKey: ['settlement-incidents-stats', venueId] })
      queryClient.invalidateQueries({ queryKey: ['available-balance', venueId] })
      // Close dialog and reset form
      handleClose()
    },
    onError: (error: any) => {
      toast({
        title: t('confirmDialog.error'),
        description: error.response?.data?.message || t('confirmDialog.errorDescription'),
        variant: 'destructive',
      })
    },
  })

  const handleClose = () => {
    setSettlementArrived(null)
    setActualDate(undefined)
    setNotes('')
    onOpenChange(false)
  }

  const handleConfirm = () => {
    confirmMutation.mutate()
  }

  if (!incident) return null

  const estimatedDate = new Date(incident.estimatedSettlementDate)
  const formattedEstimatedDate = format(estimatedDate, 'PPP', { locale: es })
  const formattedAmount = new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
  }).format(Number(incident.amount))

  const isValid = settlementArrived !== null && (settlementArrived === 'no' || actualDate !== undefined)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            {t('confirmDialog.title')}
          </DialogTitle>
          <DialogDescription>{t('confirmDialog.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Incident Details */}
          <div className="rounded-lg bg-muted p-4 space-y-2">
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('confirmDialog.processor')}:</span>
              <span className="text-sm font-medium">{incident.processorName}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('confirmDialog.expectedDate')}:</span>
              <span className="text-sm font-medium">{formattedEstimatedDate}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('confirmDialog.amount')}:</span>
              <span className="text-sm font-medium">{formattedAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm text-muted-foreground">{t('confirmDialog.cardType')}:</span>
              <span className="text-sm font-medium">{incident.cardType}</span>
            </div>
          </div>

          {/* Question */}
          <div className="space-y-3">
            <Label className="text-base">{t('confirmDialog.question')}</Label>
            <RadioGroup value={settlementArrived || undefined} onValueChange={(value) => setSettlementArrived(value as 'yes' | 'no')}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="yes" id="yes" />
                <Label htmlFor="yes" className="flex items-center gap-2 cursor-pointer font-normal">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  {t('confirmDialog.yes')}
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="no" id="no" />
                <Label htmlFor="no" className="flex items-center gap-2 cursor-pointer font-normal">
                  <XCircle className="h-4 w-4 text-red-500" />
                  {t('confirmDialog.no')}
                </Label>
              </div>
            </RadioGroup>
          </div>

          {/* If yes, ask for actual date */}
          {settlementArrived === 'yes' && (
            <div className="space-y-2">
              <Label>{t('confirmDialog.actualDate')}</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn('w-full justify-start text-left font-normal', !actualDate && 'text-muted-foreground')}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {actualDate ? format(actualDate, 'PPP', { locale: es }) : t('confirmDialog.selectDate')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={actualDate}
                    onSelect={setActualDate}
                    disabled={(date) => date > new Date() || date < new Date('2020-01-01')}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <Label htmlFor="notes">{t('confirmDialog.notes')} ({t('common:optional')})</Label>
            <Textarea
              id="notes"
              placeholder={t('confirmDialog.notesPlaceholder')}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              maxLength={1000}
            />
            <p className="text-xs text-muted-foreground">
              {notes.length}/1000 {t('common:characters')}
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={confirmMutation.isPending}>
            {t('common:cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={!isValid || confirmMutation.isPending}>
            {confirmMutation.isPending ? t('common:confirming') : t('common:confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
