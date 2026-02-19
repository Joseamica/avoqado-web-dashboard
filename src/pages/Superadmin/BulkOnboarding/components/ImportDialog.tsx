import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Upload, FileJson, AlertCircle } from 'lucide-react'
import type { BulkVenueEntry, PricingConfig } from '../types'

/** Auto-detect decimal format (0.025) and convert to percentage (2.5) */
function migrateImportedPricing(pricing: Partial<PricingConfig>): PricingConfig {
  const p = { ...pricing } as PricingConfig
  if (p.debitRate != null && p.debitRate < 1) {
    for (const key of ['debitRate', 'creditRate', 'amexRate', 'internationalRate'] as const) {
      if (typeof p[key] === 'number') p[key] *= 100
    }
  }
  return p
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  onImport: (venues: BulkVenueEntry[]) => void
}

const TEMPLATE = `[
  {
    "name": "Venue Ejemplo",
    "address": "Av. Reforma 123, CDMX",
    "city": "Ciudad de México",
    "state": "CDMX",
    "country": "MX",
    "zipCode": "06600",
    "phone": "+525512345678",
    "email": "contacto@ejemplo.com",
    "terminals": [
      { "serialNumber": "SN001", "name": "Terminal 1", "type": "TPV_ANDROID" }
    ]
  }
]`

export const ImportDialog: React.FC<Props> = ({ open, onOpenChange, onImport }) => {
  const [jsonText, setJsonText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const parseAndImport = (text: string) => {
    setError(null)
    try {
      const parsed = JSON.parse(text)
      const arr = Array.isArray(parsed) ? parsed : [parsed]

      if (arr.length === 0) {
        setError('El JSON no contiene venues')
        return
      }

      const venues: BulkVenueEntry[] = arr.map((item: any) => ({
        clientId: crypto.randomUUID(),
        name: item.name || 'Sin nombre',
        address: item.address,
        city: item.city,
        state: item.state,
        country: item.country,
        zipCode: item.zipCode,
        phone: item.phone,
        email: item.email,
        website: item.website,
        latitude: item.latitude,
        longitude: item.longitude,
        type: item.type,
        entityType: item.entityType,
        rfc: item.rfc,
        legalName: item.legalName,
        timezone: item.timezone,
        currency: item.currency,
        terminals: (item.terminals || []).map((t: any) => ({
          clientId: crypto.randomUUID(),
          serialNumber: t.serialNumber || '',
          name: t.name || '',
          type: t.type || 'TPV_ANDROID',
          brand: t.brand,
          model: t.model,
        })),
        pricingOverride: item.pricing ? migrateImportedPricing(item.pricing) : undefined,
        settlementOverride: item.settlement || undefined,
      }))

      onImport(venues)
      setJsonText('')
      onOpenChange(false)
    } catch (e: any) {
      setError(`JSON inválido: ${e.message}`)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      setJsonText(text)
      parseAndImport(text)
    }
    reader.readAsText(file)
    // Reset input to allow re-upload of same file
    e.target.value = ''
  }

  const handleDownloadTemplate = () => {
    const blob = new Blob([TEMPLATE], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'venues-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar Venues desde JSON</DialogTitle>
          <DialogDescription>
            Pega un JSON array de venues o sube un archivo .json. Los venues importados se agregarán a la lista editable.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File Upload */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="cursor-pointer"
            >
              <Upload className="w-4 h-4 mr-2" /> Subir archivo .json
            </Button>
            <Button variant="ghost" onClick={handleDownloadTemplate} className="cursor-pointer">
              <FileJson className="w-4 h-4 mr-2" /> Descargar template
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>

          {/* JSON Textarea */}
          <Textarea
            value={jsonText}
            onChange={e => setJsonText(e.target.value)}
            placeholder={TEMPLATE}
            className="font-mono text-xs min-h-[200px]"
          />

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4" />
              {error}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancelar
          </Button>
          <Button
            onClick={() => parseAndImport(jsonText)}
            disabled={!jsonText.trim()}
            className="cursor-pointer"
          >
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
