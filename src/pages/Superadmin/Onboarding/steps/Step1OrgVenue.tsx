import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Building2, Store, MapPin, Phone, FileText } from 'lucide-react'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import type { OrganizationData, OrganizationOption, VenueData } from '../onboarding.types'
import { VenueTypeSelector } from '../components/VenueTypeSelector'
import { fetchOrganizations } from '../onboarding.service'

interface Props {
  organization: OrganizationData
  venue: VenueData
  onOrgChange: (data: Partial<OrganizationData>) => void
  onVenueChange: (data: Partial<VenueData>) => void
}

export const Step1OrgVenue: React.FC<Props> = ({ organization, venue, onOrgChange, onVenueChange }) => {
  const [orgs, setOrgs] = useState<OrganizationOption[]>([])

  useEffect(() => {
    fetchOrganizations().then(setOrgs).catch(() => {})
  }, [])

  // Auto-generate slug from name
  const handleNameChange = (name: string) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
    onVenueChange({ name, slug })
  }

  return (
    <div className="space-y-6">
      {/* Organization */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
            <Building2 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h3 className="font-semibold">Organizacion</h3>
            <p className="text-sm text-muted-foreground">Selecciona o crea una organizacion</p>
          </div>
        </div>

        <div className="space-y-4">
          <RadioGroup
            value={organization.mode}
            onValueChange={(v) => onOrgChange({ mode: v as 'existing' | 'new' })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="existing" id="org-existing" />
              <Label htmlFor="org-existing">Existente</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="new" id="org-new" />
              <Label htmlFor="org-new">Nueva</Label>
            </div>
          </RadioGroup>

          {organization.mode === 'existing' ? (
            <Select value={organization.id || ''} onValueChange={(v) => onOrgChange({ id: v })}>
              <SelectTrigger className="h-12 text-base">
                <SelectValue placeholder="Seleccionar organizacion" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    <span className="flex items-center gap-2">
                      {org.name}
                      <span className="text-muted-foreground">({org._count.venues} venues)</span>
                      {org.hasPaymentConfig ? (
                        <Badge variant="outline" className="rounded-full bg-green-500/10 text-green-600 text-xs">Config pagos</Badge>
                      ) : (
                        <Badge variant="outline" className="rounded-full bg-orange-500/10 text-orange-600 text-xs">Sin config</Badge>
                      )}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nombre</Label>
                <Input className="h-12 text-base" value={organization.name || ''} onChange={(e) => onOrgChange({ name: e.target.value })} placeholder="Mi Empresa SA" />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input className="h-12 text-base" value={organization.email || ''} onChange={(e) => onOrgChange({ email: e.target.value })} placeholder="admin@empresa.com" />
              </div>
              <div className="space-y-2">
                <Label>Telefono</Label>
                <Input className="h-12 text-base" value={organization.phone || ''} onChange={(e) => onOrgChange({ phone: e.target.value })} placeholder="+52 55 1234 5678" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Venue Basic */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
            <Store className="h-5 w-5 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-semibold">Venue</h3>
            <p className="text-sm text-muted-foreground">Informacion basica del venue</p>
          </div>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Nombre del venue</Label>
              <Input className="h-12 text-base" value={venue.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Mi Restaurante Centro" />
            </div>
            <div className="space-y-2">
              <Label>Slug</Label>
              <Input className="h-12 text-base" value={venue.slug || ''} onChange={(e) => onVenueChange({ slug: e.target.value })} placeholder="mi-restaurante-centro" />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tipo de venue</Label>
            <VenueTypeSelector value={venue.venueType} onChange={(v) => onVenueChange({ venueType: v })} />
          </div>
        </div>
      </div>

      {/* Address */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
            <MapPin className="h-5 w-5 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="font-semibold">Direccion</h3>
            <p className="text-sm text-muted-foreground">Ubicacion fisica del venue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2 space-y-2">
            <Label>Calle y numero</Label>
            <AddressAutocomplete
              value={venue.address || ''}
              onAddressSelect={(place: PlaceDetails) => {
                onVenueChange({
                  address: place.address,
                  city: place.city,
                  state: place.state,
                  zipCode: place.zipCode,
                  latitude: place.latitude,
                  longitude: place.longitude,
                })
              }}
            />
          </div>
          <div className="space-y-2">
            <Label>Ciudad</Label>
            <Input className="h-12 text-base" value={venue.city || ''} onChange={(e) => onVenueChange({ city: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Estado</Label>
            <Input className="h-12 text-base" value={venue.state || ''} onChange={(e) => onVenueChange({ state: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Codigo Postal</Label>
            <Input className="h-12 text-base" value={venue.zipCode || ''} onChange={(e) => onVenueChange({ zipCode: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Contact */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-orange-500/20 to-orange-500/5">
            <Phone className="h-5 w-5 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="font-semibold">Contacto</h3>
            <p className="text-sm text-muted-foreground">Informacion de contacto del venue</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Telefono</Label>
            <Input className="h-12 text-base" value={venue.phone || ''} onChange={(e) => onVenueChange({ phone: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input className="h-12 text-base" value={venue.email || ''} onChange={(e) => onVenueChange({ email: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Website</Label>
            <Input className="h-12 text-base" value={venue.website || ''} onChange={(e) => onVenueChange({ website: e.target.value })} />
          </div>
        </div>
      </div>

      {/* Legal */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-xl bg-gradient-to-br from-red-500/20 to-red-500/5">
            <FileText className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h3 className="font-semibold">Datos Fiscales</h3>
            <p className="text-sm text-muted-foreground">Informacion fiscal y legal</p>
          </div>
        </div>

        <div className="space-y-4">
          <RadioGroup
            value={venue.entityType || ''}
            onValueChange={(v) => onVenueChange({ entityType: v as 'PERSONA_FISICA' | 'PERSONA_MORAL' })}
            className="flex gap-4"
          >
            <div className="flex items-center gap-2">
              <RadioGroupItem value="PERSONA_FISICA" id="pf" />
              <Label htmlFor="pf">Persona Fisica</Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="PERSONA_MORAL" id="pm" />
              <Label htmlFor="pm">Persona Moral</Label>
            </div>
          </RadioGroup>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>RFC</Label>
              <Input className="h-12 text-base" value={venue.rfc || ''} onChange={(e) => onVenueChange({ rfc: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Razon Social</Label>
              <Input className="h-12 text-base" value={venue.legalName || ''} onChange={(e) => onVenueChange({ legalName: e.target.value })} />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
