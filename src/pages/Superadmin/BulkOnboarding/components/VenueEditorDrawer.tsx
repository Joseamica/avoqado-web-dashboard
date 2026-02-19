import React, { useState } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AddressAutocomplete, type PlaceDetails } from '@/components/address-autocomplete'
import { Plus, Trash2 } from 'lucide-react'
import type { BulkVenueEntry, BulkVenueTerminal, PricingConfig, SettlementConfig } from '../types'

interface Props {
  venue: BulkVenueEntry | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSave: (clientId: string, updates: Partial<BulkVenueEntry>) => void
}

const TERMINAL_TYPES = ['TPV_ANDROID', 'TPV_DESKTOP', 'TPV_WEB', 'TPV_MOBILE', 'VIRTUAL']

export const VenueEditorDrawer: React.FC<Props> = ({ venue, open, onOpenChange, onSave }) => {
  const [draft, setDraft] = useState<Partial<BulkVenueEntry>>({})
  const [pricingOverrideEnabled, setPricingOverrideEnabled] = useState(false)
  const [settlementOverrideEnabled, setSettlementOverrideEnabled] = useState(false)

  // Sync draft when venue changes
  React.useEffect(() => {
    if (venue) {
      setDraft({})
      setPricingOverrideEnabled(!!venue.pricingOverride)
      setSettlementOverrideEnabled(!!venue.settlementOverride)
    }
  }, [venue])

  if (!venue) return null

  const merged = { ...venue, ...draft }

  const updateField = <K extends keyof BulkVenueEntry>(key: K, value: BulkVenueEntry[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const handleAddressSelect = (place: PlaceDetails) => {
    setDraft(prev => ({
      ...prev,
      address: place.address,
      city: place.city,
      state: place.state,
      country: place.country,
      zipCode: place.zipCode,
      latitude: place.latitude,
      longitude: place.longitude,
    }))
  }

  const handleAddTerminal = () => {
    const terminals = [...(merged.terminals || [])]
    terminals.push({
      clientId: crypto.randomUUID(),
      serialNumber: '',
      name: '',
      type: 'TPV_ANDROID',
    })
    updateField('terminals', terminals)
  }

  const handleRemoveTerminal = (clientId: string) => {
    updateField('terminals', (merged.terminals || []).filter(t => t.clientId !== clientId))
  }

  const handleTerminalChange = (clientId: string, field: keyof BulkVenueTerminal, value: string) => {
    updateField(
      'terminals',
      (merged.terminals || []).map(t => (t.clientId === clientId ? { ...t, [field]: value } : t)),
    )
  }

  const handleSave = () => {
    const updates = { ...draft }

    // Handle pricing override toggle
    if (!pricingOverrideEnabled) {
      updates.pricingOverride = undefined
    } else if (!updates.pricingOverride && !venue.pricingOverride) {
      updates.pricingOverride = {
        debitRate: 2.5,
        creditRate: 3.5,
        amexRate: 4.0,
        internationalRate: 4.5,
      }
    }

    // Handle settlement override toggle
    if (!settlementOverrideEnabled) {
      updates.settlementOverride = undefined
    } else if (!updates.settlementOverride && !venue.settlementOverride) {
      updates.settlementOverride = {
        debitDays: 1,
        creditDays: 3,
        amexDays: 5,
        internationalDays: 7,
        otherDays: 3,
        dayType: 'BUSINESS_DAYS',
      }
    }

    onSave(venue.clientId, updates)
    onOpenChange(false)
  }

  const currentPricing: PricingConfig = merged.pricingOverride || {
    debitRate: 2.5,
    creditRate: 3.5,
    amexRate: 4.0,
    internationalRate: 4.5,
  }

  const currentSettlement: SettlementConfig = merged.settlementOverride || {
    debitDays: 1,
    creditDays: 3,
    amexDays: 5,
    internationalDays: 7,
    otherDays: 3,
    dayType: 'BUSINESS_DAYS',
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0">
        <SheetHeader className="p-6 pb-0">
          <SheetTitle>Editar Venue</SheetTitle>
          <SheetDescription>Configura los detalles de {merged.name || 'este venue'}</SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-180px)] px-6">
          <div className="space-y-6 py-4">
            {/* Basic Info */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Información básica</h4>
              <div>
                <Label>Nombre</Label>
                <Input
                  value={merged.name}
                  onChange={e => updateField('name', e.target.value)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label>Dirección</Label>
                <AddressAutocomplete
                  value={merged.address}
                  onAddressSelect={handleAddressSelect}
                  placeholder="Buscar dirección..."
                  className="mt-1"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Teléfono</Label>
                  <Input
                    value={merged.phone || ''}
                    onChange={e => updateField('phone', e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">Email</Label>
                  <Input
                    type="email"
                    value={merged.email || ''}
                    onChange={e => updateField('email', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs">Website</Label>
                <Input
                  value={merged.website || ''}
                  onChange={e => updateField('website', e.target.value)}
                  placeholder="https://"
                  className="mt-1"
                />
              </div>
            </section>

            {/* Legal/Tax */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold text-muted-foreground">Datos fiscales</h4>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">RFC</Label>
                  <Input
                    value={merged.rfc || ''}
                    onChange={e => updateField('rfc', e.target.value)}
                    className="mt-1"
                    placeholder="ABC123456XYZ"
                  />
                </div>
                <div>
                  <Label className="text-xs">Razón Social</Label>
                  <Input
                    value={merged.legalName || ''}
                    onChange={e => updateField('legalName', e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </section>

            {/* Terminals */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">
                  Terminales ({merged.terminals?.length || 0})
                </h4>
                <Button variant="outline" size="sm" onClick={handleAddTerminal} className="cursor-pointer">
                  <Plus className="w-3 h-3 mr-1" /> Agregar
                </Button>
              </div>

              {(merged.terminals || []).map(terminal => (
                <div
                  key={terminal.clientId}
                  className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end rounded-lg border border-border/50 p-3"
                >
                  <div>
                    <Label className="text-xs">Número de serie</Label>
                    <Input
                      value={terminal.serialNumber}
                      onChange={e => handleTerminalChange(terminal.clientId, 'serialNumber', e.target.value)}
                      placeholder="SN001"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Nombre</Label>
                    <Input
                      value={terminal.name}
                      onChange={e => handleTerminalChange(terminal.clientId, 'name', e.target.value)}
                      placeholder="Terminal 1"
                      className="mt-1"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveTerminal(terminal.clientId)}
                    className="text-destructive cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                  <div className="col-span-3">
                    <Select
                      value={terminal.type}
                      onValueChange={v => handleTerminalChange(terminal.clientId, 'type', v)}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {TERMINAL_TYPES.map(t => (
                          <SelectItem key={t} value={t}>
                            {t.replace(/_/g, ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
            </section>

            {/* Pricing Override */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">Pricing personalizado</h4>
                <Switch checked={pricingOverrideEnabled} onCheckedChange={setPricingOverrideEnabled} />
              </div>

              {pricingOverrideEnabled && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 p-3">
                  {[
                    { key: 'debitRate' as const, label: 'Débito' },
                    { key: 'creditRate' as const, label: 'Crédito' },
                    { key: 'amexRate' as const, label: 'AMEX' },
                    { key: 'internationalRate' as const, label: 'Internacional' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={currentPricing[key]}
                        onChange={e =>
                          updateField('pricingOverride', {
                            ...currentPricing,
                            [key]: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* Settlement Override */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-muted-foreground">Liquidación personalizada</h4>
                <Switch checked={settlementOverrideEnabled} onCheckedChange={setSettlementOverrideEnabled} />
              </div>

              {settlementOverrideEnabled && (
                <div className="grid grid-cols-2 gap-3 rounded-lg border border-border/50 p-3">
                  {[
                    { key: 'debitDays' as const, label: 'Débito (días)' },
                    { key: 'creditDays' as const, label: 'Crédito (días)' },
                    { key: 'amexDays' as const, label: 'AMEX (días)' },
                    { key: 'internationalDays' as const, label: 'Internacional (días)' },
                    { key: 'otherDays' as const, label: 'Otros (días)' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <Label className="text-xs">{label}</Label>
                      <Input
                        type="number"
                        min="0"
                        max="90"
                        step="1"
                        value={currentSettlement[key]}
                        onChange={e =>
                          updateField('settlementOverride', {
                            ...currentSettlement,
                            [key]: parseInt(e.target.value) || 0,
                          })
                        }
                        className="mt-1"
                      />
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        </ScrollArea>

        {/* Footer */}
        <div className="absolute bottom-0 left-0 right-0 border-t border-border bg-background p-4 flex gap-2 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancelar
          </Button>
          <Button onClick={handleSave} className="cursor-pointer">
            Guardar
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  )
}
