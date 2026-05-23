import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Building2, CheckCircle2, Search } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { getAllVenues } from '@/services/superadmin.service'
import { cn, includesNormalized } from '@/lib/utils'
import type { SetupState } from '../types'
import type { SetupAction } from '../useSetupReducer'

interface VenueCardProps {
  state: SetupState
  dispatch: (action: SetupAction) => void
  mode: 'create' | 'edit'
}

export default function VenueCard({ state, dispatch, mode }: VenueCardProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  const { data: venues = [], isLoading } = useQuery({
    queryKey: ['venues-for-setup'],
    queryFn: () => getAllVenues(),
    enabled: open && mode === 'create',
  })

  const filtered = venues.filter(
    v => includesNormalized(v.name ?? '', search) || includesNormalized(v.slug ?? '', search),
  )

  const isValid = !!state.venue.id

  return (
    <>
      <button
        type="button"
        onClick={() => mode === 'create' && setOpen(true)}
        disabled={mode === 'edit'}
        className={cn(
          'text-left rounded-2xl border p-5 transition-colors',
          isValid ? 'border-input bg-card' : 'border-dashed border-input bg-muted/20',
          mode === 'create' && 'hover:bg-muted/30 cursor-pointer',
        )}
        data-tour="setup-panel-card-venue"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm">Venue</h3>
          </div>
          {isValid ? (
            <Badge variant="default" className="text-[10px] bg-green-600 hover:bg-green-600">
              <CheckCircle2 className="w-3 h-3 mr-1" /> Listo
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">Pendiente</Badge>
          )}
        </div>
        <p className="mt-2 text-sm text-foreground">
          {state.venue.name ?? <span className="text-muted-foreground">Selecciona el venue</span>}
        </p>
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Selecciona el venue</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre o slug..."
                className="pl-9"
                autoFocus
              />
            </div>
            <div className="max-h-[400px] overflow-y-auto space-y-1">
              {isLoading ? (
                <p className="text-xs text-muted-foreground p-2">Cargando...</p>
              ) : filtered.length === 0 ? (
                <p className="text-xs text-muted-foreground p-2">Sin resultados.</p>
              ) : (
                filtered.map(v => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => {
                      dispatch({
                        type: 'SET_VENUE',
                        venue: { id: v.id, name: v.name, slug: v.slug },
                      })
                      setOpen(false)
                    }}
                    className={cn(
                      'w-full text-left rounded-lg border border-input p-3 hover:bg-muted/30 transition-colors',
                      state.venue.id === v.id && 'border-foreground bg-muted/40',
                    )}
                  >
                    <p className="text-sm font-medium">{v.name}</p>
                    <p className="text-xs text-muted-foreground">{v.slug}</p>
                  </button>
                ))
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
