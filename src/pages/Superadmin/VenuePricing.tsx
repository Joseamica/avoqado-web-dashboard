import React, { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { paymentProviderAPI, type VenuePricingStructure } from '@/services/paymentProvider.service'
import api from '@/api'
import { useToast } from '@/hooks/use-toast'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import {
  Building2,
  Search,
  TrendingUp,
  CheckCircle2,
  Minus,
  DollarSign,
} from 'lucide-react'
import { VenuePricingStructureDialog } from './components/VenuePricingStructureDialog'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Venue {
  id: string
  name: string
  slug: string
}

const VenuePricing: React.FC = () => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedVenue, setSelectedVenue] = useState<Venue | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [selectedAccountType, setSelectedAccountType] = useState<'PRIMARY' | 'SECONDARY' | 'TERTIARY'>('PRIMARY')
  const [editingStructure, setEditingStructure] = useState<VenuePricingStructure | null>(null)

  // Fetch all venues
  const { data: venues = [], isLoading: loadingVenues } = useQuery({
    queryKey: ['venues-list'],
    queryFn: async () => {
      const response = await api.get('/api/v1/dashboard/superadmin/venues')
      return response.data.data as Venue[]
    },
  })

  // Fetch all pricing structures
  const { data: pricingStructures = [], isLoading: loadingStructures } = useQuery({
    queryKey: ['venue-pricing-structures'],
    queryFn: () => paymentProviderAPI.getVenuePricingStructures(),
  })

  // Create mutation
  const createMutation = useMutation({
    mutationFn: paymentProviderAPI.createVenuePricingStructure,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Éxito', description: 'Tarifas configuradas correctamente' })
      setDialogOpen(false)
      setSelectedVenue(null)
      setEditingStructure(null)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Error al configurar tarifas', variant: 'destructive' })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      paymentProviderAPI.updateVenuePricingStructure(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['venue-pricing-structures'] })
      toast({ title: 'Éxito', description: 'Tarifas actualizadas correctamente' })
      setDialogOpen(false)
      setSelectedVenue(null)
      setEditingStructure(null)
    },
    onError: () => {
      toast({ title: 'Error', description: 'Error al actualizar tarifas', variant: 'destructive' })
    },
  })

  // Filter venues by search
  const filteredVenues = useMemo(() => {
    if (!searchQuery.trim()) return venues
    const query = searchQuery.toLowerCase()
    return venues.filter(
      (venue) =>
        venue.name.toLowerCase().includes(query) ||
        venue.slug.toLowerCase().includes(query)
    )
  }, [venues, searchQuery])

  // Group structures by venue
  const structuresByVenue = useMemo(() => {
    const grouped = new Map<string, {
      PRIMARY?: VenuePricingStructure
      SECONDARY?: VenuePricingStructure
      TERTIARY?: VenuePricingStructure
    }>()

    pricingStructures.forEach((structure) => {
      const existing = grouped.get(structure.venueId) || {}
      grouped.set(structure.venueId, {
        ...existing,
        [structure.accountType]: structure,
      })
    })

    return grouped
  }, [pricingStructures])

  const handleOpenDialog = (venue: Venue, accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY', existing?: VenuePricingStructure) => {
    setSelectedVenue(venue)
    setSelectedAccountType(accountType)
    setEditingStructure(existing || null)
    setDialogOpen(true)
  }

  const handleSave = async (data: any) => {
    if (editingStructure) {
      await updateMutation.mutateAsync({ id: editingStructure.id, data })
    } else {
      await createMutation.mutateAsync(data)
    }
  }

  const formatRate = (rate: number | string) => {
    return `${Number(rate) * 100}%`
  }

  const AccountTypeBadge: React.FC<{
    type: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
    structure?: VenuePricingStructure
    venue: Venue
  }> = ({ type, structure, venue }) => {
    const config = {
      PRIMARY: { label: 'Primaria', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10' },
      SECONDARY: { label: 'Secundaria', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10' },
      TERTIARY: { label: 'Terciaria', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-500/10' },
    }[type]

    if (!structure) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => handleOpenDialog(venue, type)}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-muted/50 border border-dashed border-border hover:bg-muted transition-colors cursor-pointer"
              >
                <Minus className="w-3 h-3 text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Sin configurar</span>
              </button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Click para configurar cuenta {config.label.toLowerCase()}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    }

    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => handleOpenDialog(venue, type, structure)}
              className={cn(
                "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border cursor-pointer transition-all hover:scale-105",
                config.bg,
                config.color,
                "border-current/20"
              )}
            >
              <CheckCircle2 className="w-3 h-3" />
              <span className="text-xs font-medium">{config.label}</span>
            </button>
          </TooltipTrigger>
          <TooltipContent className="max-w-xs">
            <div className="space-y-1 text-xs">
              <p className="font-semibold">{config.label}</p>
              <p>Débito: {formatRate(structure.debitRate)} · Crédito: {formatRate(structure.creditRate)}</p>
              <p>AMEX: {formatRate(structure.amexRate)} · Intl: {formatRate(structure.internationalRate)}</p>
              <p className="text-muted-foreground mt-2">Click para editar</p>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Tarifas por Venue</h1>
          <p className="text-muted-foreground mt-1">
            Configura las comisiones que Avoqado cobra a cada establecimiento
          </p>
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20 border-blue-200 dark:border-blue-800 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold text-blue-900 dark:text-blue-100">3 Cuentas por Venue</h3>
              <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                Primaria (principal), Secundaria (backup) y Terciaria (redundancia)
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20 border-green-200 dark:border-green-800 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h3 className="font-semibold text-green-900 dark:text-green-100">Margen = Tu Ganancia</h3>
              <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                Tarifa venue − Costo procesador = Margen de Avoqado
              </p>
            </div>
          </div>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20 border-purple-200 dark:border-purple-800 p-4">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20">
              <DollarSign className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-purple-900 dark:text-purple-100">4 Tipos de Tarjeta</h3>
              <p className="text-sm text-purple-700 dark:text-purple-300 mt-1">
                Débito, Crédito, AMEX e Internacional
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Search */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar venue..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="text-sm text-muted-foreground">
          {filteredVenues.length} venues
        </div>
      </div>

      {/* Table */}
      <Card>
        <div className="divide-y divide-border">
          {/* Header */}
          <div className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-3 bg-muted/30">
            <div className="font-semibold text-sm">Venue</div>
            <div className="font-semibold text-sm">Tarifas Configuradas</div>
          </div>

          {/* Rows */}
          {loadingVenues || loadingStructures ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              Cargando venues...
            </div>
          ) : filteredVenues.length === 0 ? (
            <div className="px-6 py-12 text-center text-muted-foreground">
              No se encontraron venues
            </div>
          ) : (
            filteredVenues.map((venue) => {
              const structures = structuresByVenue.get(venue.id)
              const _hasAny = structures?.PRIMARY || structures?.SECONDARY || structures?.TERTIARY

              return (
                <div
                  key={venue.id}
                  className="grid grid-cols-[1fr_auto] items-center gap-4 px-6 py-4 hover:bg-muted/30 transition-colors"
                >
                  {/* Venue Info */}
                  <div>
                    <h3 className="font-medium">{venue.name}</h3>
                    <p className="text-sm text-muted-foreground">{venue.slug}</p>
                  </div>

                  {/* Account Badges */}
                  <div className="flex items-center gap-2">
                    <AccountTypeBadge type="PRIMARY" structure={structures?.PRIMARY} venue={venue} />
                    <AccountTypeBadge type="SECONDARY" structure={structures?.SECONDARY} venue={venue} />
                    <AccountTypeBadge type="TERTIARY" structure={structures?.TERTIARY} venue={venue} />
                  </div>
                </div>
              )
            })
          )}
        </div>
      </Card>

      {/* Dialog */}
      <VenuePricingStructureDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open)
          if (!open) {
            setSelectedVenue(null)
            setEditingStructure(null)
          }
        }}
        venueId={selectedVenue?.id}
        initialAccountType={selectedAccountType}
        pricingStructure={editingStructure}
        onSave={handleSave}
      />
    </div>
  )
}

export default VenuePricing
