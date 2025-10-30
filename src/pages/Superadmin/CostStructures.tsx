import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { DollarSign, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { paymentProviderAPI, type ProviderCostStructure } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { ProviderCostStructureDialog } from './components/ProviderCostStructureDialog'
import { useToast } from '@/hooks/use-toast'

const CostStructures: React.FC = () => {
  const { t } = useTranslation('superadmin')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: costStructures = [], isLoading } = useQuery({
    queryKey: ['provider-cost-structures'],
    queryFn: () => paymentProviderAPI.getProviderCostStructures(),
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedCostStructure, setSelectedCostStructure] = useState<ProviderCostStructure | null>(null)

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createProviderCostStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: t('costStructures.toasts.success'), description: t('costStructures.toasts.createSuccess') })
    },
    onError: () => {
      toast({ title: t('costStructures.toasts.error'), description: t('costStructures.toasts.createError'), variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => paymentProviderAPI.updateProviderCostStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: t('costStructures.toasts.success'), description: t('costStructures.toasts.updateSuccess') })
    },
    onError: () => {
      toast({ title: t('costStructures.toasts.error'), description: t('costStructures.toasts.updateError'), variant: 'destructive' })
    },
  })

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: paymentProviderAPI.deactivateProviderCostStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: t('costStructures.toasts.success'), description: t('costStructures.toasts.deactivateSuccess') })
    },
    onError: () => {
      toast({ title: t('costStructures.toasts.error'), description: t('costStructures.toasts.deactivateError'), variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteProviderCostStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: t('costStructures.toasts.success'), description: t('costStructures.toasts.deleteSuccess') })
    },
    onError: () => {
      toast({ title: t('costStructures.toasts.error'), description: t('costStructures.toasts.deleteError'), variant: 'destructive' })
    },
  })

  const handleSave = async (data: any) => {
    if (selectedCostStructure) {
      await updateMutation.mutateAsync({ id: selectedCostStructure.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (costStructure: ProviderCostStructure) => {
    setSelectedCostStructure(costStructure)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedCostStructure(null)
    setDialogOpen(true)
  }

  const handleDeactivate = async (id: string) => {
    if (confirm(t('costStructures.confirmations.deactivate'))) {
      await deactivateMutation.mutateAsync(id)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm(t('costStructures.confirmations.delete'))) {
      await deleteMutation.mutateAsync(id)
    }
  }

  // Filter cost structures based on search
  const filteredCostStructures = costStructures.filter(
    cs =>
      cs.merchantAccount.provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      cs.merchantAccount.alias?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false ||
      cs.proposalReference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      false,
  )

  const columns: ColumnDef<ProviderCostStructure>[] = [
    {
      accessorKey: 'merchantAccount.provider.name',
      header: t('costStructures.columns.providerAccount'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.merchantAccount.provider.name}</div>
          <div className="text-sm text-muted-foreground">
            {row.original.merchantAccount.displayName || row.original.merchantAccount.alias}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'effectiveFrom',
      header: t('costStructures.columns.effectiveFrom'),
      cell: ({ row }) => new Date(row.original.effectiveFrom).toLocaleDateString(),
    },
    {
      accessorKey: 'debitRate',
      header: t('costStructures.columns.debit'),
      cell: ({ row }) => `${(Number(row.original.debitRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'creditRate',
      header: t('costStructures.columns.credit'),
      cell: ({ row }) => `${(Number(row.original.creditRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'amexRate',
      header: t('costStructures.columns.amex'),
      cell: ({ row }) => `${(Number(row.original.amexRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'internationalRate',
      header: t('costStructures.columns.international'),
      cell: ({ row }) => `${(Number(row.original.internationalRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'active',
      header: t('costStructures.columns.status'),
      cell: ({ row }) => (
        <Badge
          className={
            row.original.active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-muted text-muted-foreground'
          }
        >
          {row.original.active ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              {t('costStructures.status.active')}
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 mr-1" />
              {t('costStructures.status.inactive')}
            </>
          )}
        </Badge>
      ),
    },
    {
      id: 'actions',
      header: t('costStructures.columns.actions'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => handleEdit(row.original)}>
            <Pencil className="w-4 h-4" />
          </Button>
          {row.original.active && (
            <Button variant="ghost" size="sm" onClick={() => handleDeactivate(row.original.id)}>
              <XCircle className="w-4 h-4 text-orange-600" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => handleDelete(row.original.id)}>
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
          <h1 className="text-3xl font-bold text-foreground">{t('costStructures.title')}</h1>
          <p className="text-muted-foreground">{t('costStructures.subtitle')}</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          {t('costStructures.addButton')}
        </Button>
      </div>

      {/* Dialog */}
      <ProviderCostStructureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        costStructure={selectedCostStructure}
        onSave={handleSave}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('costStructures.stats.totalStructures')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costStructures.length}</div>
            <p className="text-xs text-muted-foreground">
              {costStructures.filter(cs => cs.active).length} {t('costStructures.stats.active')}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Structures Table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('costStructures.table.title')}</CardTitle>
          <CardDescription>{t('costStructures.table.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder={t('costStructures.table.searchPlaceholder')}
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
              data={filteredCostStructures}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              rowCount={filteredCostStructures.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default CostStructures
