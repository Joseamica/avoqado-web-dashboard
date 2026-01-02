import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { Clock, Plus, Pencil, Trash2, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react'
import {
  getSettlementConfigurations,
  createSettlementConfiguration,
  updateSettlementConfiguration,
  deleteSettlementConfiguration,
  bulkCreateSettlementConfigurations,
  type SettlementConfiguration,
  type TransactionCardType,
  type SettlementDayType,
  CARD_TYPES,
  DEFAULT_SETTLEMENT_DAYS,
} from '@/services/settlementConfiguration.service'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { useToast } from '@/hooks/use-toast'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'

const SettlementConfigurations: React.FC = () => {
  const { t } = useTranslation('superadmin')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatDate } = useVenueDateTime()

  // State
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedMerchantId, setSelectedMerchantId] = useState<string>('all')
  const [selectedCardType, setSelectedCardType] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false)
  const [selectedConfig, setSelectedConfig] = useState<SettlementConfiguration | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    merchantAccountId: '',
    cardType: 'DEBIT' as TransactionCardType,
    settlementDays: 1,
    settlementDayType: 'BUSINESS_DAYS' as SettlementDayType,
    cutoffTime: '23:00',
    cutoffTimezone: 'America/Mexico_City',
    notes: '',
  })

  // Bulk form state
  const [bulkFormData, setBulkFormData] = useState({
    merchantAccountId: '',
    debitDays: DEFAULT_SETTLEMENT_DAYS.DEBIT,
    creditDays: DEFAULT_SETTLEMENT_DAYS.CREDIT,
    amexDays: DEFAULT_SETTLEMENT_DAYS.AMEX,
    internationalDays: DEFAULT_SETTLEMENT_DAYS.INTERNATIONAL,
    otherDays: DEFAULT_SETTLEMENT_DAYS.OTHER,
    settlementDayType: 'BUSINESS_DAYS' as SettlementDayType,
    cutoffTime: '23:00',
  })

  // Queries
  const { data: configurations = [], isLoading } = useQuery({
    queryKey: ['settlement-configurations'],
    queryFn: () => getSettlementConfigurations(),
  })

  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts-list'],
    queryFn: () => paymentProviderAPI.getMerchantAccountsList(),
  })

  // Extract unique merchants for filter
  const uniqueMerchants = useMemo(() => {
    const merchantsMap = new Map<string, { id: string; name: string }>()
    configurations.forEach(config => {
      if (config.merchantAccount) {
        merchantsMap.set(config.merchantAccount.id, {
          id: config.merchantAccount.id,
          name: config.merchantAccount.displayName || config.merchantAccount.accountId || config.merchantAccount.id,
        })
      }
    })
    return Array.from(merchantsMap.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [configurations])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: createSettlementConfiguration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlement-configurations'] })
      toast({ title: t('settlementConfigurations.toasts.success'), description: t('settlementConfigurations.toasts.createSuccess') })
      setDialogOpen(false)
    },
    onError: () => {
      toast({
        title: t('settlementConfigurations.toasts.createError'),
        variant: 'destructive',
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateSettlementConfiguration(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlement-configurations'] })
      toast({ title: t('settlementConfigurations.toasts.success'), description: t('settlementConfigurations.toasts.updateSuccess') })
      setDialogOpen(false)
    },
    onError: () => {
      toast({
        title: t('settlementConfigurations.toasts.updateError'),
        variant: 'destructive',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: deleteSettlementConfiguration,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settlement-configurations'] })
      toast({ title: t('settlementConfigurations.toasts.success'), description: t('settlementConfigurations.toasts.deleteSuccess') })
    },
    onError: () => {
      toast({
        title: t('settlementConfigurations.toasts.deleteError'),
        variant: 'destructive',
      })
    },
  })

  // Bulk create mutation
  const bulkCreateMutation = useMutation({
    mutationFn: bulkCreateSettlementConfigurations,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['settlement-configurations'] })
      toast({
        title: t('settlementConfigurations.toasts.success'),
        description: t('settlementConfigurations.toasts.bulkCreateSuccess', { count: data.length }),
      })
      setBulkDialogOpen(false)
    },
    onError: () => {
      toast({
        title: t('settlementConfigurations.toasts.bulkCreateError'),
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleAdd = () => {
    setSelectedConfig(null)
    setFormData({
      merchantAccountId: '',
      cardType: 'DEBIT',
      settlementDays: 1,
      settlementDayType: 'BUSINESS_DAYS',
      cutoffTime: '23:00',
      cutoffTimezone: 'America/Mexico_City',
      notes: '',
    })
    setDialogOpen(true)
  }

  const handleEdit = (config: SettlementConfiguration) => {
    setSelectedConfig(config)
    setFormData({
      merchantAccountId: config.merchantAccountId,
      cardType: config.cardType,
      settlementDays: config.settlementDays,
      settlementDayType: config.settlementDayType,
      cutoffTime: config.cutoffTime,
      cutoffTimezone: config.cutoffTimezone,
      notes: config.notes || '',
    })
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm(t('settlementConfigurations.confirmations.delete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  const handleSave = async () => {
    if (selectedConfig) {
      await updateMutation.mutateAsync({
        id: selectedConfig.id,
        data: {
          settlementDays: formData.settlementDays,
          settlementDayType: formData.settlementDayType,
          cutoffTime: formData.cutoffTime,
          cutoffTimezone: formData.cutoffTimezone,
          notes: formData.notes || undefined,
        },
      })
    } else {
      await createMutation.mutateAsync({
        ...formData,
        effectiveFrom: new Date().toISOString(),
      })
    }
  }

  const handleBulkCreate = async () => {
    const configs = CARD_TYPES.map(cardType => ({
      cardType,
      settlementDays:
        cardType === 'DEBIT'
          ? bulkFormData.debitDays
          : cardType === 'CREDIT'
            ? bulkFormData.creditDays
            : cardType === 'AMEX'
              ? bulkFormData.amexDays
              : cardType === 'INTERNATIONAL'
                ? bulkFormData.internationalDays
                : bulkFormData.otherDays,
      settlementDayType: bulkFormData.settlementDayType,
      cutoffTime: bulkFormData.cutoffTime,
      cutoffTimezone: 'America/Mexico_City',
    }))

    await bulkCreateMutation.mutateAsync({
      merchantAccountId: bulkFormData.merchantAccountId,
      configs,
      effectiveFrom: new Date().toISOString(),
    })
  }

  // Filter configurations
  const filteredConfigurations = useMemo(() => {
    return configurations.filter(config => {
      if (selectedMerchantId !== 'all' && config.merchantAccountId !== selectedMerchantId) {
        return false
      }
      if (selectedCardType !== 'all' && config.cardType !== selectedCardType) {
        return false
      }
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase()
        return (
          config.merchantAccount?.displayName?.toLowerCase().includes(searchLower) ||
          config.merchantAccount?.accountId?.toLowerCase().includes(searchLower)
        )
      }
      return true
    })
  }, [configurations, selectedMerchantId, selectedCardType, searchTerm])

  // Get merchants without config for warning
  const merchantsWithoutConfig = useMemo(() => {
    const configuredMerchantIds = new Set(configurations.map(c => c.merchantAccountId))
    return merchantAccounts.filter(ma => !configuredMerchantIds.has(ma.id))
  }, [merchantAccounts, configurations])

  const columns: ColumnDef<SettlementConfiguration>[] = [
    {
      accessorKey: 'merchantAccount',
      header: t('settlementConfigurations.columns.merchantAccount'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.merchantAccount?.displayName || row.original.merchantAccountId}</div>
          <div className="text-sm text-muted-foreground">{row.original.merchantAccount?.provider?.name}</div>
        </div>
      ),
    },
    {
      accessorKey: 'cardType',
      header: t('settlementConfigurations.columns.cardType'),
      cell: ({ row }) => (
        <Badge variant="outline">{t(`settlementConfigurations.cardTypes.${row.original.cardType}`)}</Badge>
      ),
    },
    {
      accessorKey: 'settlementDays',
      header: t('settlementConfigurations.columns.settlementDays'),
      cell: ({ row }) => (
        <span className="font-medium">
          {row.original.settlementDays} {t(`settlementConfigurations.dayTypes.${row.original.settlementDayType}`)}
        </span>
      ),
    },
    {
      accessorKey: 'cutoffTime',
      header: t('settlementConfigurations.columns.cutoffTime'),
      cell: ({ row }) => row.original.cutoffTime,
    },
    {
      accessorKey: 'effectiveFrom',
      header: t('settlementConfigurations.columns.effectiveFrom'),
      cell: ({ row }) => formatDate(row.original.effectiveFrom),
    },
    {
      accessorKey: 'status',
      header: t('settlementConfigurations.columns.status'),
      cell: ({ row }) => {
        const isActive = !row.original.effectiveTo || new Date(row.original.effectiveTo) > new Date()
        return (
          <Badge className={isActive ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-muted text-muted-foreground'}>
            <CheckCircle className="w-3 h-3 mr-1" />
            {isActive ? t('settlementConfigurations.status.active') : t('settlementConfigurations.status.expired')}
          </Badge>
        )
      },
    },
    {
      id: 'actions',
      header: t('settlementConfigurations.columns.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)} className="cursor-pointer">
            <Pencil className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id)} className="cursor-pointer">
            <Trash2 className="w-4 h-4 text-destructive" />
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('settlementConfigurations.title')}</h1>
          <p className="text-muted-foreground">{t('settlementConfigurations.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkDialogOpen(true)}>
            <Plus className="w-4 h-4 mr-2" />
            {t('settlementConfigurations.bulkCreate')}
          </Button>
          <Button onClick={handleAdd}>
            <Plus className="w-4 h-4 mr-2" />
            {t('settlementConfigurations.addButton')}
          </Button>
        </div>
      </div>

      {/* Warning for merchants without config */}
      {merchantsWithoutConfig.length > 0 && (
        <Card className="border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800">
          <CardHeader className="pb-2">
            <CardTitle className="text-amber-800 dark:text-amber-200 flex items-center gap-2">
              <AlertTriangle className="w-5 h-5" />
              {t('settlementConfigurations.merchantsWithoutConfig.title')}
            </CardTitle>
            <CardDescription className="text-amber-700 dark:text-amber-300">
              {t('settlementConfigurations.merchantsWithoutConfig.description')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {merchantsWithoutConfig.slice(0, 5).map(ma => (
                <Badge key={ma.id} variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-200">
                  {ma.displayName || ma.externalMerchantId}
                </Badge>
              ))}
              {merchantsWithoutConfig.length > 5 && (
                <Badge variant="outline" className="border-amber-300 text-amber-800 dark:text-amber-200">
                  +{merchantsWithoutConfig.length - 5} mas
                </Badge>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('settlementConfigurations.stats.totalConfigs')}</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{configurations.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('settlementConfigurations.stats.merchantsWithConfig')}</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{uniqueMerchants.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('settlementConfigurations.stats.merchantsWithoutConfig')}</CardTitle>
            <AlertTriangle className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{merchantsWithoutConfig.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settlementConfigurations.title')}</CardTitle>
          <CardDescription>{t('settlementConfigurations.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex gap-4 mb-4">
            <Input
              placeholder={t('settlementConfigurations.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
            <Select value={selectedMerchantId} onValueChange={setSelectedMerchantId}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder={t('settlementConfigurations.filters.allMerchants')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('settlementConfigurations.filters.allMerchants')}</SelectItem>
                {uniqueMerchants.map(merchant => (
                  <SelectItem key={merchant.id} value={merchant.id}>
                    {merchant.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={selectedCardType} onValueChange={setSelectedCardType}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder={t('settlementConfigurations.filters.allCardTypes')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('settlementConfigurations.filters.allCardTypes')}</SelectItem>
                {CARD_TYPES.map(cardType => (
                  <SelectItem key={cardType} value={cardType}>
                    {t(`settlementConfigurations.cardTypes.${cardType}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DataTable columns={columns} data={filteredConfigurations} isLoading={isLoading} rowCount={filteredConfigurations.length} />
        </CardContent>
      </Card>

      {/* Single Config Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{t('settlementConfigurations.form.title')}</DialogTitle>
            <DialogDescription>{t('settlementConfigurations.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {!selectedConfig && (
              <>
                <div className="space-y-2">
                  <Label>{t('settlementConfigurations.form.merchantAccount')}</Label>
                  <Select
                    value={formData.merchantAccountId}
                    onValueChange={value => setFormData({ ...formData, merchantAccountId: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('settlementConfigurations.form.merchantAccountPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {merchantAccounts.map(ma => (
                        <SelectItem key={ma.id} value={ma.id}>
                          {ma.displayName || ma.externalMerchantId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>{t('settlementConfigurations.form.cardType')}</Label>
                  <Select
                    value={formData.cardType}
                    onValueChange={value => setFormData({ ...formData, cardType: value as TransactionCardType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {CARD_TYPES.map(cardType => (
                        <SelectItem key={cardType} value={cardType}>
                          {t(`settlementConfigurations.cardTypes.${cardType}`)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settlementConfigurations.form.settlementDays')}</Label>
                <Input
                  type="number"
                  min={0}
                  max={30}
                  value={formData.settlementDays}
                  onChange={e => setFormData({ ...formData, settlementDays: parseInt(e.target.value) || 0 })}
                />
                <p className="text-xs text-muted-foreground">{t('settlementConfigurations.form.settlementDaysHint')}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('settlementConfigurations.form.dayType')}</Label>
                <Select
                  value={formData.settlementDayType}
                  onValueChange={value => setFormData({ ...formData, settlementDayType: value as SettlementDayType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="BUSINESS_DAYS">{t('settlementConfigurations.dayTypes.BUSINESS_DAYS')}</SelectItem>
                    <SelectItem value="CALENDAR_DAYS">{t('settlementConfigurations.dayTypes.CALENDAR_DAYS')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t('settlementConfigurations.form.cutoffTime')}</Label>
                <Input
                  type="time"
                  value={formData.cutoffTime}
                  onChange={e => setFormData({ ...formData, cutoffTime: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">{t('settlementConfigurations.form.cutoffTimeHint')}</p>
              </div>
              <div className="space-y-2">
                <Label>{t('settlementConfigurations.form.cutoffTimezone')}</Label>
                <Select
                  value={formData.cutoffTimezone}
                  onValueChange={value => setFormData({ ...formData, cutoffTimezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="America/Mexico_City">America/Mexico_City</SelectItem>
                    <SelectItem value="America/Monterrey">America/Monterrey</SelectItem>
                    <SelectItem value="America/Cancun">America/Cancun</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label>{t('settlementConfigurations.form.notes')}</Label>
              <Textarea
                value={formData.notes}
                onChange={e => setFormData({ ...formData, notes: e.target.value })}
                placeholder={t('settlementConfigurations.form.notesPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={createMutation.isPending || updateMutation.isPending}>
              {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('common.save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Create Dialog */}
      <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('settlementConfigurations.bulkCreate')}</DialogTitle>
            <DialogDescription>{t('settlementConfigurations.wizard.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{t('settlementConfigurations.form.merchantAccount')}</Label>
              <Select
                value={bulkFormData.merchantAccountId}
                onValueChange={value => setBulkFormData({ ...bulkFormData, merchantAccountId: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('settlementConfigurations.form.merchantAccountPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {merchantAccounts.map(ma => (
                    <SelectItem key={ma.id} value={ma.id}>
                      {ma.displayName || ma.externalMerchantId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-4 p-4 rounded-xl bg-muted/30 border border-border/50">
              <h4 className="font-medium">{t('settlementConfigurations.wizard.title')}</h4>
              <p className="text-xs text-muted-foreground">{t('settlementConfigurations.wizard.hint')}</p>

              <div className="grid grid-cols-2 gap-4">
                {CARD_TYPES.map(cardType => {
                  const daysKey =
                    cardType === 'DEBIT'
                      ? 'debitDays'
                      : cardType === 'CREDIT'
                        ? 'creditDays'
                        : cardType === 'AMEX'
                          ? 'amexDays'
                          : cardType === 'INTERNATIONAL'
                            ? 'internationalDays'
                            : 'otherDays'
                  return (
                    <div key={cardType} className="flex items-center justify-between p-3 rounded-lg bg-background/50 border border-border/30">
                      <Label className="text-sm">{t(`settlementConfigurations.cardTypes.${cardType}`)}</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min={0}
                          max={30}
                          value={bulkFormData[daysKey]}
                          onChange={e => setBulkFormData({ ...bulkFormData, [daysKey]: parseInt(e.target.value) || 0 })}
                          className="w-20 h-8 text-center"
                        />
                        <span className="text-xs text-muted-foreground">{t('settlementConfigurations.wizard.daysLabel')}</span>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <div className="space-y-2">
                  <Label className="text-sm">{t('settlementConfigurations.form.dayType')}</Label>
                  <Select
                    value={bulkFormData.settlementDayType}
                    onValueChange={value => setBulkFormData({ ...bulkFormData, settlementDayType: value as SettlementDayType })}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="BUSINESS_DAYS">{t('settlementConfigurations.dayTypes.BUSINESS_DAYS')}</SelectItem>
                      <SelectItem value="CALENDAR_DAYS">{t('settlementConfigurations.dayTypes.CALENDAR_DAYS')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm">{t('settlementConfigurations.form.cutoffTime')}</Label>
                  <Input
                    type="time"
                    value={bulkFormData.cutoffTime}
                    onChange={e => setBulkFormData({ ...bulkFormData, cutoffTime: e.target.value })}
                    className="h-9"
                  />
                </div>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDialogOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              onClick={handleBulkCreate}
              disabled={bulkCreateMutation.isPending || !bulkFormData.merchantAccountId}
            >
              {bulkCreateMutation.isPending && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t('settlementConfigurations.bulkCreate')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default SettlementConfigurations
