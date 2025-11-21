import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { Building2, Plus, Shield, Pencil, Trash2, Zap, Power } from 'lucide-react'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { getAllVenues } from '@/services/superadmin.service'
import { useTranslation } from 'react-i18next'
import { MerchantAccountDialog } from './components/MerchantAccountDialog'
import { BlumonAutoFetchDialog } from './components/BlumonAutoFetchDialog'
import { useToast } from '@/hooks/use-toast'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'

const MerchantAccounts: React.FC = () => {
  const { t } = useTranslation('payment')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedVenueId, setSelectedVenueId] = useState<string>('all')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [blumonDialogOpen, setBlumonDialogOpen] = useState(false)
  const [selectedAccount, setSelectedAccount] = useState<MerchantAccount | null>(null)

  // Fetch venues for the filter
  const { data: venues = [] } = useQuery({
    queryKey: ['venues'],
    queryFn: getAllVenues,
  })

  // Fetch accounts - either all or filtered by venue
  const { data: accounts = [], isLoading } = useQuery({
    queryKey: ['merchant-accounts', selectedVenueId],
    queryFn: async () => {
      if (selectedVenueId === 'all') {
        return paymentProviderAPI.getAllMerchantAccounts()
      } else {
        // Fetch venue-specific merchant accounts
        return paymentProviderAPI.getVenueMerchantAccountsByVenueId(selectedVenueId)
      }
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: 'Success', description: 'Merchant account created successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create merchant account', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      paymentProviderAPI.updateMerchantAccount(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: 'Success', description: 'Merchant account updated successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update merchant account', variant: 'destructive' })
    },
  })

  // Toggle active status mutation
  const toggleMutation = useMutation({
    mutationFn: paymentProviderAPI.toggleMerchantAccountStatus,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: 'Success', description: 'Merchant account status updated successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update merchant account status', variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteMerchantAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      toast({ title: 'Success', description: 'Merchant account deleted successfully' })
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || 'Failed to delete merchant account'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const handleSave = async (data: any) => {
    if (selectedAccount) {
      await updateMutation.mutateAsync({ id: selectedAccount.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (account: MerchantAccount) => {
    setSelectedAccount(account)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedAccount(null)
    setDialogOpen(true)
  }

  const handleToggle = async (id: string) => {
    await toggleMutation.mutateAsync(id)
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this merchant account?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  // Filter accounts based on search
  const filteredAccounts = accounts.filter(account =>
    (account.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (account.alias?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    account.externalMerchantId.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const columns: ColumnDef<MerchantAccount>[] = [
    {
      accessorKey: 'displayName',
      header: t('merchantAccounts.columns.account'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-lg bg-muted">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <div className="font-medium">{row.original.displayName || row.original.alias}</div>
            <div className="text-sm text-muted-foreground">{row.original.externalMerchantId}</div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'provider.name',
      header: t('merchantAccounts.columns.provider'),
      cell: ({ row }) => <Badge variant="secondary">{row.original.provider.name}</Badge>,
    },
    {
      accessorKey: 'active',
      header: t('merchantAccounts.columns.status'),
      cell: ({ row }) => (
        <Badge className={row.original.active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-muted text-muted-foreground'}>
          {row.original.active ? t('common.active') : t('common.inactive')}
        </Badge>
      ),
    },
    {
      accessorKey: 'hasCredentials',
      header: t('merchantAccounts.columns.credentials'),
      cell: ({ row }) => (
        row.original.hasCredentials ? (
          <Badge variant="outline" className="flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {t('merchantAccounts.encrypted')}
          </Badge>
        ) : (
          <span className="text-sm text-muted-foreground">{t('merchantAccounts.none')}</span>
        )
      ),
    },
    {
      accessorKey: '_count.costStructures',
      header: t('merchantAccounts.columns.costStructures'),
      cell: ({ row }) => row.original._count?.costStructures || 0,
    },
    {
      accessorKey: '_count.venueConfigs',
      header: 'Venue Configs',
      cell: ({ row }) => row.original._count?.venueConfigs || 0,
    },
    {
      id: 'actions',
      header: 'Actions',
      cell: ({ row }) => {
        const account = row.original
        const costStructuresCount = account._count?.costStructures || 0
        const venueConfigsCount = account._count?.venueConfigs || 0
        const isInUse = costStructuresCount > 0 || venueConfigsCount > 0

        const usageDetails = []
        if (costStructuresCount > 0) usageDetails.push(`${costStructuresCount} cost structure(s)`)
        if (venueConfigsCount > 0) usageDetails.push(`${venueConfigsCount} venue config(s)`)

        return (
          <TooltipProvider>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleEdit(account)}
              >
                <Pencil className="w-4 h-4" />
              </Button>

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleToggle(account.id)}
                  >
                    <Power className={`w-4 h-4 ${account.active ? 'text-green-600' : 'text-muted-foreground'}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{account.active ? 'Deactivate' : 'Activate'}</p>
                </TooltipContent>
              </Tooltip>

              <Tooltip>
                <TooltipTrigger asChild>
                  <span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(account.id)}
                      disabled={isInUse}
                    >
                      <Trash2 className={`w-4 h-4 ${isInUse ? 'text-muted-foreground' : 'text-destructive'}`} />
                    </Button>
                  </span>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{isInUse
                    ? `Cannot delete: In use by ${usageDetails.join(', ')}. Deactivate instead.`
                    : 'Delete merchant account'
                  }</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        )
      },
    },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">{t('merchantAccounts.title')}</h1>
          <p className="text-muted-foreground">{t('merchantAccounts.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleAdd} variant="outline">
            <Plus className="w-4 h-4 mr-2" />
            {t('merchantAccounts.create')}
          </Button>
          <Button onClick={() => setBlumonDialogOpen(true)} className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700">
            <Zap className="w-4 h-4 mr-2" />
            Blumon Auto-Fetch
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <MerchantAccountDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        account={selectedAccount}
        onSave={handleSave}
      />
      <BlumonAutoFetchDialog
        open={blumonDialogOpen}
        onOpenChange={setBlumonDialogOpen}
        onSuccess={() => queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('merchantAccounts.stats.total')}</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{accounts.length}</div>
            <p className="text-xs text-muted-foreground">{accounts.filter(a => a.active).length} {t('merchantAccounts.stats.activeCount')}</p>
          </CardContent>
        </Card>
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('merchantAccounts.tableTitle')}</CardTitle>
          <CardDescription>{t('merchantAccounts.tableDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder={t('merchantAccounts.searchPlaceholder')}
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="w-64">
              <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('merchantAccounts.filterByVenue')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('merchantAccounts.allVenues')}</SelectItem>
                  {venues.map(venue => (
                    <SelectItem key={venue.id} value={venue.id}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-8 text-center text-sm text-muted-foreground">{t('common.loading')}</div>
          ) : (
            <DataTable
              columns={columns}
              data={filteredAccounts}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              rowCount={filteredAccounts.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default MerchantAccounts
