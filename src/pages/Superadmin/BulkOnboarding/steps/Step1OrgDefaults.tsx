import React from 'react'
import { useQuery } from '@tanstack/react-query'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Building2, Globe, Landmark } from 'lucide-react'
import { getOrganizationsList } from '@/services/superadmin-organizations.service'
import type { BulkOnboardingState, BulkOnboardingAction } from '../types'

const VENUE_TYPES = [
  // Food Service
  'RESTAURANT', 'BAR', 'CAFE', 'BAKERY', 'FOOD_TRUCK', 'FAST_FOOD', 'CATERING', 'CLOUD_KITCHEN',
  // Retail
  'RETAIL_STORE', 'JEWELRY', 'CLOTHING', 'ELECTRONICS', 'PHARMACY', 'CONVENIENCE_STORE',
  'SUPERMARKET', 'LIQUOR_STORE', 'FURNITURE', 'HARDWARE', 'BOOKSTORE', 'PET_STORE', 'TELECOMUNICACIONES',
  // Services
  'SALON', 'SPA', 'FITNESS', 'CLINIC',
]

const ENTITY_TYPES = [
  { value: '', label: 'Sin especificar' },
  { value: 'PERSONA_FISICA', label: 'Persona Física' },
  { value: 'PERSONA_MORAL', label: 'Persona Moral' },
]

const TIMEZONES = [
  'America/Mexico_City',
  'America/Cancun',
  'America/Monterrey',
  'America/Chihuahua',
  'America/Mazatlan',
  'America/Tijuana',
  'America/Hermosillo',
]

const CURRENCIES = ['MXN', 'USD', 'EUR']
const COUNTRIES = ['MX', 'US', 'CO', 'AR', 'CL', 'PE', 'BR']

interface Props {
  state: BulkOnboardingState
  dispatch: React.Dispatch<BulkOnboardingAction>
}

export const Step1OrgDefaults: React.FC<Props> = ({ state, dispatch }) => {
  const { data: organizations = [], isLoading: loadingOrgs } = useQuery({
    queryKey: ['superadmin', 'organizations-list'],
    queryFn: () => getOrganizationsList(),
  })

  return (
    <div className="space-y-6">
      {/* Organization Selector */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-500/10">
            <Building2 className="w-4 h-4 text-blue-500" />
          </div>
          <div>
            <h3 className="font-semibold">Organización</h3>
            <p className="text-xs text-muted-foreground">Todos los venues se crearán dentro de esta organización</p>
          </div>
        </div>

        <div>
          <Label>Organización</Label>
          <Select
            value={state.organizationId}
            onValueChange={v => dispatch({ type: 'SET_ORG', organizationId: v })}
          >
            <SelectTrigger className="mt-1">
              <SelectValue placeholder={loadingOrgs ? 'Cargando...' : 'Seleccionar organización'} />
            </SelectTrigger>
            <SelectContent>
              {organizations.map(org => (
                <SelectItem key={org.id} value={org.id}>
                  {org.name} {org.venueCount > 0 && `(${org.venueCount} venues)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Default Venue Type & Entity */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-violet-500/10">
            <Landmark className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h3 className="font-semibold">Tipo de Venue</h3>
            <p className="text-xs text-muted-foreground">Estos valores se aplicarán como default a todos los venues</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Tipo de Venue</Label>
            <Select
              value={state.defaults.venueType}
              onValueChange={v => dispatch({ type: 'SET_DEFAULTS', defaults: { venueType: v } })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VENUE_TYPES.map(t => (
                  <SelectItem key={t} value={t}>
                    {t.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Tipo de Entidad</Label>
            <Select
              value={state.defaults.entityType}
              onValueChange={v => dispatch({ type: 'SET_DEFAULTS', defaults: { entityType: v } })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Sin especificar" />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_TYPES.map(t => (
                  <SelectItem key={t.value || '__empty'} value={t.value || '__empty'}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Location & Currency Defaults */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-emerald-500/10">
            <Globe className="w-4 h-4 text-emerald-500" />
          </div>
          <div>
            <h3 className="font-semibold">Ubicación y Moneda</h3>
            <p className="text-xs text-muted-foreground">Configuración regional por defecto</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Zona Horaria</Label>
            <Select
              value={state.defaults.timezone}
              onValueChange={v => dispatch({ type: 'SET_DEFAULTS', defaults: { timezone: v } })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIMEZONES.map(tz => (
                  <SelectItem key={tz} value={tz}>
                    {tz.split('/')[1]?.replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Moneda</Label>
            <Select
              value={state.defaults.currency}
              onValueChange={v => dispatch({ type: 'SET_DEFAULTS', defaults: { currency: v } })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>País</Label>
            <Select
              value={state.defaults.country}
              onValueChange={v => dispatch({ type: 'SET_DEFAULTS', defaults: { country: v } })}
            >
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {COUNTRIES.map(c => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  )
}
