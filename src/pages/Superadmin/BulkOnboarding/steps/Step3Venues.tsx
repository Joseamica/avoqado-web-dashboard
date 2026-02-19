import React, { useState, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Plus, Upload, ListPlus, MoreHorizontal, Pencil, Copy, Trash2, MapPin } from 'lucide-react'
import type { BulkOnboardingState, BulkOnboardingAction, BulkVenueEntry } from '../types'
import { VenueEditorDrawer } from '../components/VenueEditorDrawer'
import { ImportDialog } from '../components/ImportDialog'

interface Props {
  state: BulkOnboardingState
  dispatch: React.Dispatch<BulkOnboardingAction>
}

export const Step3Venues: React.FC<Props> = ({ state, dispatch }) => {
  const [editingVenueId, setEditingVenueId] = useState<string | null>(null)
  const [importDialogOpen, setImportDialogOpen] = useState(false)
  const [quickAddOpen, setQuickAddOpen] = useState(false)
  const [quickAddText, setQuickAddText] = useState('')

  const editingVenue = useMemo(
    () => state.venues.find(v => v.clientId === editingVenueId) || null,
    [state.venues, editingVenueId],
  )

  const handleAddVenue = () => {
    const newVenue: BulkVenueEntry = {
      clientId: crypto.randomUUID(),
      name: `Venue ${state.venues.length + 1}`,
      terminals: [],
    }
    dispatch({ type: 'ADD_VENUE', venue: newVenue })
    setEditingVenueId(newVenue.clientId)
  }

  const handleQuickAdd = () => {
    const names = quickAddText
      .split('\n')
      .map(s => s.trim())
      .filter(Boolean)

    if (names.length === 0) return

    const newVenues: BulkVenueEntry[] = names.map(name => ({
      clientId: crypto.randomUUID(),
      name,
      terminals: [],
    }))

    dispatch({ type: 'ADD_VENUES_BATCH', venues: newVenues })
    setQuickAddText('')
    setQuickAddOpen(false)
  }

  const handleImport = (venues: BulkVenueEntry[]) => {
    dispatch({ type: 'ADD_VENUES_BATCH', venues })
  }

  const handleSaveVenue = (clientId: string, updates: Partial<BulkVenueEntry>) => {
    dispatch({ type: 'UPDATE_VENUE', clientId, updates })
  }

  const totalTerminals = state.venues.reduce((sum, v) => sum + v.terminals.length, 0)
  const customPricingCount = state.venues.filter(v => v.pricingOverride).length

  return (
    <div className="space-y-4">
      {/* Header Stats */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-4">
            <span className="text-lg font-semibold">
              {state.venues.length} venue{state.venues.length !== 1 && 's'}
            </span>
            <span className="text-sm text-muted-foreground">
              {totalTerminals} terminal{totalTerminals !== 1 && 'es'}
            </span>
            {customPricingCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {customPricingCount} con pricing custom
              </Badge>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setQuickAddOpen(true)} className="cursor-pointer">
              <ListPlus className="w-4 h-4 mr-1" /> Agregar múltiples
            </Button>
            <Button variant="outline" size="sm" onClick={() => setImportDialogOpen(true)} className="cursor-pointer">
              <Upload className="w-4 h-4 mr-1" /> Importar JSON
            </Button>
            <Button size="sm" onClick={handleAddVenue} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-1" /> Agregar Venue
            </Button>
          </div>
        </div>
        {state.venues.length > 0 && (
          <Progress value={Math.min((state.venues.length / 36) * 100, 100)} className="h-1.5" />
        )}
      </div>

      {/* Venues Table */}
      {state.venues.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-12 text-center space-y-3">
          <p className="text-muted-foreground">No hay venues todavía</p>
          <p className="text-sm text-muted-foreground">
            Agrega venues uno a uno, en lote, o importa desde JSON
          </p>
          <div className="flex gap-2 justify-center">
            <Button variant="outline" onClick={() => setQuickAddOpen(true)} className="cursor-pointer">
              <ListPlus className="w-4 h-4 mr-2" /> Agregar múltiples
            </Button>
            <Button onClick={handleAddVenue} className="cursor-pointer">
              <Plus className="w-4 h-4 mr-2" /> Agregar Venue
            </Button>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">#</TableHead>
                <TableHead>Nombre</TableHead>
                <TableHead className="hidden md:table-cell">Dirección</TableHead>
                <TableHead className="hidden lg:table-cell">Ciudad</TableHead>
                <TableHead className="text-center">Terminales</TableHead>
                <TableHead className="text-center">Pricing</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.venues.map((venue, idx) => (
                <TableRow
                  key={venue.clientId}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => setEditingVenueId(venue.clientId)}
                >
                  <TableCell className="text-muted-foreground text-xs">{idx + 1}</TableCell>
                  <TableCell className="font-medium">
                    {venue.name || <span className="text-muted-foreground italic">Sin nombre</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-sm text-muted-foreground truncate max-w-[200px]">
                    {venue.address ? (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {venue.address}
                      </span>
                    ) : (
                      '—'
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                    {venue.city || '—'}
                  </TableCell>
                  <TableCell className="text-center">
                    {venue.terminals.length > 0 ? (
                      <Badge variant="secondary" className="text-xs">
                        {venue.terminals.length}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {venue.pricingOverride ? (
                      <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">Custom</Badge>
                    ) : (
                      <span className="text-muted-foreground text-xs">Default</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div onClick={e => e.stopPropagation()}>
                      <DropdownMenu modal={false}>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" sideOffset={5}>
                          <DropdownMenuItem onClick={() => setEditingVenueId(venue.clientId)}>
                            <Pencil className="w-4 h-4 mr-2" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => dispatch({ type: 'DUPLICATE_VENUE', clientId: venue.clientId })}>
                            <Copy className="w-4 h-4 mr-2" /> Duplicar
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => dispatch({ type: 'REMOVE_VENUE', clientId: venue.clientId })}
                          >
                            <Trash2 className="w-4 h-4 mr-2" /> Eliminar
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Venue Editor Drawer */}
      <VenueEditorDrawer
        venue={editingVenue}
        open={!!editingVenueId}
        onOpenChange={open => !open && setEditingVenueId(null)}
        onSave={handleSaveVenue}
      />

      {/* Import Dialog */}
      <ImportDialog open={importDialogOpen} onOpenChange={setImportDialogOpen} onImport={handleImport} />

      {/* Quick Add Dialog */}
      <Dialog open={quickAddOpen} onOpenChange={setQuickAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar múltiples venues</DialogTitle>
            <DialogDescription>Escribe un nombre de venue por línea. Se crearán como entradas editables.</DialogDescription>
          </DialogHeader>
          <Textarea
            value={quickAddText}
            onChange={e => setQuickAddText(e.target.value)}
            placeholder={"Venue Reforma\nVenue Polanco\nVenue Santa Fe\nVenue Condesa"}
            className="min-h-[150px]"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickAddOpen(false)} className="cursor-pointer">
              Cancelar
            </Button>
            <Button
              onClick={handleQuickAdd}
              disabled={!quickAddText.trim()}
              className="cursor-pointer"
            >
              Agregar {quickAddText.split('\n').filter(s => s.trim()).length} venues
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
