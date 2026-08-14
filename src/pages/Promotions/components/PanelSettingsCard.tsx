import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import api from '@/api'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import type { VenueSettings } from '@/types'

type PanelMode = 'HIDDEN' | 'TAB' | 'SIDE_PANEL'

export function PanelSettingsCard({ venueId }: { venueId: string }) {
  const { t } = useTranslation('promotions')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const { data: settings } = useQuery({
    queryKey: ['venue-settings', venueId],
    queryFn: async () => (await api.get<VenueSettings>(`/api/v1/dashboard/venues/${venueId}/settings`)).data,
    enabled: !!venueId,
  })

  const mutation = useMutation({
    mutationFn: async (patch: Partial<Pick<VenueSettings, 'promotionsPanelCashier' | 'promotionsPanelCustomer'>>) =>
      (await api.put(`/api/v1/dashboard/venues/${venueId}/settings`, patch)).data,
    onSuccess: () => {
      toast({ title: t('bundles.panel.saved') })
      queryClient.invalidateQueries({ queryKey: ['venue-settings', venueId] })
    },
  })

  const renderSelect = (
    field: 'promotionsPanelCashier' | 'promotionsPanelCustomer',
    fallback: PanelMode,
    tourKey: string,
  ) => (
    <Select value={(settings?.[field] as PanelMode) ?? fallback} onValueChange={v => mutation.mutate({ [field]: v as PanelMode })}>
      <SelectTrigger className="h-12" data-tour={tourKey}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="TAB">{t('bundles.panel.tab')}</SelectItem>
        <SelectItem value="SIDE_PANEL">{t('bundles.panel.sidePanel')}</SelectItem>
        <SelectItem value="HIDDEN">{t('bundles.panel.hidden')}</SelectItem>
      </SelectContent>
    </Select>
  )

  return (
    <Card className="border-input mt-8" data-tour="bundle-panel-settings">
      <CardHeader>
        <CardTitle>{t('bundles.panel.title')}</CardTitle>
        <CardDescription>{t('bundles.panel.description')}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>{t('bundles.panel.cashier')}</Label>
          {renderSelect('promotionsPanelCashier', 'TAB', 'bundle-panel-cashier')}
          <p className="text-xs text-muted-foreground">{t('bundles.panel.cashierHelp')}</p>
        </div>
        <div className="space-y-2">
          <Label>{t('bundles.panel.customer')}</Label>
          {renderSelect('promotionsPanelCustomer', 'SIDE_PANEL', 'bundle-panel-customer')}
          <p className="text-xs text-muted-foreground">{t('bundles.panel.customerHelp')}</p>
        </div>
      </CardContent>
    </Card>
  )
}
