import React, { useEffect, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
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
    <div className="space-y-8">
      {/* Organization */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Organizacion</h3>
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
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar organizacion" />
            </SelectTrigger>
            <SelectContent>
              {orgs.map((org) => (
                <SelectItem key={org.id} value={org.id}>
                  <span className="flex items-center gap-2">
                    {org.name}
                    <span className="text-muted-foreground">({org._count.venues} venues)</span>
                    {org.hasPaymentConfig ? (
                      <span className="text-emerald-600 text-xs">Config pagos</span>
                    ) : (
                      <span className="text-amber-600 text-xs">Sin config</span>
                    )}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input value={organization.name || ''} onChange={(e) => onOrgChange({ name: e.target.value })} placeholder="Mi Empresa SA" />
            </div>
            <div>
              <Label>Email</Label>
              <Input value={organization.email || ''} onChange={(e) => onOrgChange({ email: e.target.value })} placeholder="admin@empresa.com" />
            </div>
            <div>
              <Label>Telefono</Label>
              <Input value={organization.phone || ''} onChange={(e) => onOrgChange({ phone: e.target.value })} placeholder="+52 55 1234 5678" />
            </div>
          </div>
        )}
      </section>

      {/* Venue Basic */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Venue</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label>Nombre del venue</Label>
            <Input value={venue.name} onChange={(e) => handleNameChange(e.target.value)} placeholder="Mi Restaurante Centro" />
          </div>
          <div>
            <Label>Slug</Label>
            <Input value={venue.slug || ''} onChange={(e) => onVenueChange({ slug: e.target.value })} placeholder="mi-restaurante-centro" />
          </div>
        </div>

        <div>
          <Label>Tipo de venue</Label>
          <VenueTypeSelector value={venue.venueType} onChange={(v) => onVenueChange({ venueType: v })} />
        </div>
      </section>

      {/* Address */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Direccion</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <Label>Calle y numero</Label>
            <Input value={venue.address || ''} onChange={(e) => onVenueChange({ address: e.target.value })} />
          </div>
          <div>
            <Label>Ciudad</Label>
            <Input value={venue.city || ''} onChange={(e) => onVenueChange({ city: e.target.value })} />
          </div>
          <div>
            <Label>Estado</Label>
            <Input value={venue.state || ''} onChange={(e) => onVenueChange({ state: e.target.value })} />
          </div>
          <div>
            <Label>Codigo Postal</Label>
            <Input value={venue.zipCode || ''} onChange={(e) => onVenueChange({ zipCode: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Contact */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Contacto</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <Label>Telefono</Label>
            <Input value={venue.phone || ''} onChange={(e) => onVenueChange({ phone: e.target.value })} />
          </div>
          <div>
            <Label>Email</Label>
            <Input value={venue.email || ''} onChange={(e) => onVenueChange({ email: e.target.value })} />
          </div>
          <div>
            <Label>Website</Label>
            <Input value={venue.website || ''} onChange={(e) => onVenueChange({ website: e.target.value })} />
          </div>
        </div>
      </section>

      {/* Legal */}
      <section className="space-y-4">
        <h3 className="text-lg font-semibold">Datos Fiscales</h3>
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
          <div>
            <Label>RFC</Label>
            <Input value={venue.rfc || ''} onChange={(e) => onVenueChange({ rfc: e.target.value })} />
          </div>
          <div>
            <Label>Razon Social</Label>
            <Input value={venue.legalName || ''} onChange={(e) => onVenueChange({ legalName: e.target.value })} />
          </div>
        </div>
      </section>
    </div>
  )
}
