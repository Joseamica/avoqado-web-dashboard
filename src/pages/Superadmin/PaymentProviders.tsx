import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { CreditCard, Plus, Building2, Wallet, Globe, Pencil, Trash2 } from 'lucide-react'
import { paymentProviderAPI, type PaymentProvider } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { PaymentProviderDialog } from './components/PaymentProviderDialog'
import { useToast } from '@/hooks/use-toast'

const PaymentProviders: React.FC = () => {
  const { t } = useTranslation('payment')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: providers = [], isLoading } = useQuery({
    queryKey: ['payment-providers'],
    queryFn: () => paymentProviderAPI.getAllPaymentProviders(),
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedProvider, setSelectedProvider] = useState<PaymentProvider | null>(null)

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createPaymentProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
      toast({ title: 'Success', description: 'Provider created successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create provider', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<PaymentProvider> }) =>
      paymentProviderAPI.updatePaymentProvider(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
      toast({ title: 'Success', description: 'Provider updated successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update provider', variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deletePaymentProvider,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payment-providers'] })
      toast({ title: 'Success', description: 'Provider deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete provider', variant: 'destructive' })
    },
  })

  const handleSave = async (data: Partial<PaymentProvider>) => {
    if (selectedProvider) {
      await updateMutation.mutateAsync({ id: selectedProvider.id, data })
    } else {
      await createMutation.mutateAsync(data as any)
    }
  }

  const handleEdit = (provider: PaymentProvider) => {
    setSelectedProvider(provider)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedProvider(null)
    setDialogOpen(true)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this provider?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  // Filter providers based on search
  const filteredProviders = providers.filter(provider =>
    provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.code.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const getProviderIcon = (type: string) => {
    switch (type) {
      case 'PAYMENT_PROCESSOR':
        return <CreditCard className="w-4 h-4" />
      case 'WALLET':
        return <Wallet className="w-4 h-4" />
      case 'BANK_DIRECT':
        return <Building2 className="w-4 h-4" />
      default:
        return <Globe className="w-4 h-4" />
    }
  }

  const columns: ColumnDef<PaymentProvider>[] = [
    {
      accessorKey: 'name',
      header: t('paymentProviders.columns.provider'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-muted">{getProviderIcon(row.original.type)}</div>
          <div>
            <div className="font-medium">{row.original.name}</div>
            <div className="text-sm text-muted-foreground">{row.original.code}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'type',
      header: t('paymentProviders.columns.type'),
      cell: ({ row }) => <Badge variant="secondary">{row.original.type}</Badge>,
    },
    {
      accessorKey: 'countryCode',
      header: t('paymentProviders.columns.countries'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.countryCode.map(code => (
            <Badge key={code} variant="outline" className="text-xs">{code}</Badge>
          ))}
        </div>
      ),
    },
    {
      accessorKey: 'active',
      header: t('paymentProviders.columns.status'),
      cell: ({ row }) => (
        <Badge className={row.original.active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-muted text-muted-foreground'}>
          {row.original.active ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: '_count.merchantAccounts',
      header: t('paymentProviders.columns.accounts'),
      cell: ({ row }) => row.original._count?.merchantAccounts || 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleEdit(row.original)}
          >
            <Pencil className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => handleDelete(row.original.id)}
          >
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
          <h1 className="text-3xl font-bold text-foreground">{t('paymentProviders.title')}</h1>
          <p className="text-muted-foreground">{t('paymentProviders.subtitle')}</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t('paymentProviders.create')}
        </Button>
      </div>

      {/* Dialog */}
      <PaymentProviderDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        provider={selectedProvider}
        onSave={handleSave}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('paymentProviders.stats.total')}</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{providers.length}</div>
            <p className="text-xs text-muted-foreground">{providers.filter(p => p.active).length} {t('paymentProviders.stats.activeCount')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Providers Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('paymentProviders.tableTitle')}</CardTitle>
          <CardDescription>{t('paymentProviders.tableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder={t('paymentProviders.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredProviders}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              rowCount={filteredProviders.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PaymentProviders
