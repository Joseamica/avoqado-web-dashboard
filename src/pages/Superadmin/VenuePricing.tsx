import React, { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import DataTable from '@/components/data-table'
import { type ColumnDef } from '@tanstack/react-table'
import { TrendingUp, Plus, Pencil, Trash2, CheckCircle, XCircle } from 'lucide-react'
import { paymentProviderAPI, type VenuePricingStructure } from '@/services/paymentProvider.service'
import { useTranslation } from 'react-i18next'
import { VenuePricingStructureDialog } from './components/VenuePricingStructureDialog'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'

const VenuePricing: React.FC = () => {
  const { t } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { data: pricingStructures = [], isLoading } = useQuery({
    queryKey: ['venue-pricing-structures'],
    queryFn: () => paymentProviderAPI.getVenuePricingStructures(),
  })
  const [searchTerm, setSearchTerm] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedPricingStructure, setSelectedPricingStructure] = useState<VenuePricingStructure | null>(null)

  // Fetch venues for display
  const { data: venues = [] } = useQuery({
    queryKey: ['venues-list'],
    queryFn: async () => {
      const response = await api.get('/api/v1/dashboard/superadmin/venues')
      return response.data.data
    },
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createVenuePricingStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Pricing structure created successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to create pricing structure', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      paymentProviderAPI.updateVenuePricingStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Pricing structure updated successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to update pricing structure', variant: 'destructive' })
    },
  })

  // Deactivate mutation
  const deactivateMutation = useMutation({
    mutationFn: paymentProviderAPI.deactivateVenuePricingStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Pricing structure deactivated' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to deactivate pricing structure', variant: 'destructive' })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: paymentProviderAPI.deleteVenuePricingStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Success', description: 'Pricing structure deleted successfully' })
    },
    onError: () => {
      toast({ title: 'Error', description: 'Failed to delete pricing structure', variant: 'destructive' })
    },
  })

  const handleSave = async (data: any) => {
    if (selectedPricingStructure) {
      await updateMutation.mutateAsync({ id: selectedPricingStructure.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const handleEdit = (pricingStructure: VenuePricingStructure) => {
    setSelectedPricingStructure(pricingStructure)
    setDialogOpen(true)
  }

  const handleAdd = () => {
    setSelectedPricingStructure(null)
    setDialogOpen(true)
  }

  const handleDeactivate = async (id: string) => {
    if (confirm('Are you sure you want to deactivate this pricing structure?')) {
      await deactivateMutation.mutateAsync(id)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm('Are you sure you want to delete this pricing structure?')) {
      await deleteMutation.mutateAsync(id)
    }
  }

  // Get venue name by ID
  const getVenueName = (venueId: string) => {
    const venue = venues.find((v: any) => v.id === venueId)
    return venue?.name || venueId
  }

  // Filter pricing structures based on search
  const filteredPricingStructures = pricingStructures.filter(ps => {
    const venueName = getVenueName(ps.venueId).toLowerCase()
    const searchLower = searchTerm.toLowerCase()
    return (
      venueName.includes(searchLower) ||
      ps.accountType.toLowerCase().includes(searchLower) ||
      (ps.contractReference?.toLowerCase().includes(searchLower) || false)
    )
  })

  const columns: ColumnDef<VenuePricingStructure>[] = [
    {
      accessorKey: 'venueId',
      header: 'Venue',
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{getVenueName(row.original.venueId)}</div>
          <div className="text-sm text-muted-foreground">{row.original.accountType}</div>
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
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">
          {(Number(row.original.debitRate) * 100).toFixed(2)}%
        </span>
      ),
    },
    {
      accessorKey: 'creditRate',
      header: 'Credit',
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">
          {(Number(row.original.creditRate) * 100).toFixed(2)}%
        </span>
      ),
    },
    {
      accessorKey: 'amexRate',
      header: 'Amex',
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">
          {(Number(row.original.amexRate) * 100).toFixed(2)}%
        </span>
      ),
    },
    {
      accessorKey: 'internationalRate',
      header: 'International',
      cell: ({ row }) => (
        <span className="text-green-600 dark:text-green-400 font-medium">
          {(Number(row.original.internationalRate) * 100).toFixed(2)}%
        </span>
      ),
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
          <h1 className="text-3xl font-bold text-foreground">Venue Pricing Structures</h1>
          <p className="text-muted-foreground">Manage rates you charge to your venue clients</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="w-4 h-4 mr-2" />
          Add Pricing Structure
        </Button>
      </div>

      {/* Dialog */}
      <VenuePricingStructureDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        pricingStructure={selectedPricingStructure}
        onSave={handleSave}
      />

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Structures</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pricingStructures.length}</div>
            <p className="text-xs text-muted-foreground">
              {pricingStructures.filter(ps => ps.active).length} active
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pricing Structures Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Pricing Structures</CardTitle>
          <CardDescription>View and manage venue pricing rates and structures</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-4 mb-6">
            <div className="flex-1">
              <Input
                placeholder="Search by venue, account type, or contract..."
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
              data={filteredPricingStructures}
              pagination={{ pageIndex: 0, pageSize: 10 }}
              setPagination={() => {}}
              rowCount={filteredPricingStructures.length}
            />
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default VenuePricing
