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
  const { t } = useTranslation()
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
      toast({ title: 'Success', description: 'Cost structure created successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create cost structure', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      paymentProviderAPI.updateProviderCostStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: 'Success', description: 'Cost structure updated successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update cost structure', variant: 'destructive' })
    },
  })

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: paymentProviderAPI.deactivateProviderCostStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: 'Success', description: 'Cost structure deactivated' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to deactivate cost structure', variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteProviderCostStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['provider-cost-structures'] })
      toast({ title: 'Success', description: 'Cost structure deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete cost structure', variant: 'destructive' })
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
    if (confirm('Are you sure you want to deactivate this cost structure?')) {
      await deactivateMutation.mutateAsync(id)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this cost structure?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  // Filter cost structures based on search
  const filteredCostStructures = costStructures.filter(cs =>
    cs.merchantAccount.provider.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cs.merchantAccount.alias?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (cs.proposalReference?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  )

  const columns: ColumnDef<ProviderCostStructure>[] = [
    {
      accessorKey: 'merchantAccount.provider.name',
      header: 'Provider / Account',
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
      header: 'Effective From',
      cell: ({ row }) => new Date(row.original.effectiveFrom).toLocaleDateString(),
    },
    {
      accessorKey: 'debitRate',
      header: 'Debit',
      cell: ({ row }) => `${(Number(row.original.debitRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'creditRate',
      header: 'Credit',
      cell: ({ row }) => `${(Number(row.original.creditRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'amexRate',
      header: 'Amex',
      cell: ({ row }) => `${(Number(row.original.amexRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'internationalRate',
      header: 'International',
      cell: ({ row }) => `${(Number(row.original.internationalRate) * 100).toFixed(2)}%`,
    },
    {
      accessorKey: 'active',
      header: 'Status',
      cell: ({ row }) => (
        <Badge className={row.original.active ? 'bg-green-100 text-green-800 dark:bg-green-500/20 dark:text-green-200' : 'bg-muted text-muted-foreground'}>
          {row.original.active ? (
            <>
              <CheckCircle className="w-3 h-3 mr-1" />
              Active
            </>
          ) : (
            <>
              <XCircle className="w-3 h-3 mr-1" />
              Inactive
            </>
          )}
        </Badge>
      ),
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
          {row.original.active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleDeactivate(row.original.id)}
            >
              <XCircle className="w-4 h-4 text-orange-600" />
            </Button>
          )}
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
          <h1 className="text-3xl font-bold text-foreground">Provider Cost Structures</h1>
          <p className="text-muted-foreground">Manage payment provider rates and costs</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Cost Structure
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
            <CardTitle className="text-sm font-medium">Total Structures</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{costStructures.length}</div>
            <p className="text-xs text-muted-foreground">
              {costStructures.filter(cs => cs.active).length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cost Structures Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Cost Structures</CardTitle>
          <CardDescription>View and manage provider cost rates and structures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by provider, account, or proposal..."
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
