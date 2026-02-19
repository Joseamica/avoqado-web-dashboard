import React, { useState, useRef } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Upload, Download, FileJson, FileSpreadsheet, AlertCircle, AlertTriangle } from 'lucide-react'
import type { BulkOnboardingState, BulkVenueEntry } from '../types'
import { generateJsonTemplate, generateCsvTemplate, downloadFile } from '../utils/template-generator'
import { parseJsonTemplate, parseCsvTemplate } from '../utils/template-parser'

interface Organization {
  id: string
  slug: string
  name: string
}

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizations: Organization[]
  onImportJson: (partial: Partial<BulkOnboardingState>, warnings: string[]) => void
  onImportCsv: (venues: BulkVenueEntry[]) => void
}

export const FullTemplateImportDialog: React.FC<Props> = ({
  open,
  onOpenChange,
  organizations,
  onImportJson,
  onImportCsv,
}) => {
  const [tab, setTab] = useState<string>('json')
  const [jsonText, setJsonText] = useState('')
  const [csvText, setCsvText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [warnings, setWarnings] = useState<string[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetState = () => {
    setError(null)
    setWarnings([])
  }

  const handleJsonImport = () => {
    resetState()
    try {
      const result = parseJsonTemplate(jsonText, organizations)
      if (result.warnings.length > 0) setWarnings(result.warnings)
      onImportJson(result.state, result.warnings)
      setJsonText('')
      onOpenChange(false)
    } catch (e: any) {
      setError(`JSON inválido: ${e.message}`)
    }
  }

  const handleCsvImport = () => {
    resetState()
    try {
      const result = parseCsvTemplate(csvText)
      if (result.warnings.length > 0 && result.state.venues?.length === 0) {
        setWarnings(result.warnings)
        return
      }
      if (result.warnings.length > 0) setWarnings(result.warnings)
      onImportCsv(result.state.venues || [])
      setCsvText('')
      onOpenChange(false)
    } catch (e: any) {
      setError(`Error al procesar CSV: ${e.message}`)
    }
  }

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      if (file.name.endsWith('.csv')) {
        setCsvText(text)
        setTab('csv')
      } else {
        setJsonText(text)
        setTab('json')
      }
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const handleDownloadJsonTemplate = () => {
    downloadFile(generateJsonTemplate(), 'bulk-onboarding-template.json', 'application/json')
  }

  const handleDownloadCsvTemplate = () => {
    downloadFile(generateCsvTemplate(), 'bulk-onboarding-venues.csv', 'text/csv')
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Cargar plantilla completa</DialogTitle>
          <DialogDescription>
            Importa una plantilla JSON para pre-llenar todo el wizard, o un CSV para agregar venues.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="json" className="cursor-pointer">
              <FileJson className="w-4 h-4 mr-2" /> JSON (completo)
            </TabsTrigger>
            <TabsTrigger value="csv" className="cursor-pointer">
              <FileSpreadsheet className="w-4 h-4 mr-2" /> CSV (solo venues)
            </TabsTrigger>
          </TabsList>

          <TabsContent value="json" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInputRef.current?.setAttribute('accept', '.json')
                  fileInputRef.current?.click()
                }}
                className="cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-1" /> Subir .json
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadJsonTemplate} className="cursor-pointer">
                <Download className="w-4 h-4 mr-1" /> Descargar plantilla
              </Button>
            </div>
            <Textarea
              value={jsonText}
              onChange={e => {
                setJsonText(e.target.value)
                resetState()
              }}
              placeholder='{"organizationSlug": "...", "pricing": {...}, "venues": [...]}'
              className="font-mono text-xs min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Incluye organización, pricing, settlement y venues. Las tasas se interpretan como porcentaje (2.5 = 2.5%).
            </p>
          </TabsContent>

          <TabsContent value="csv" className="space-y-3 mt-3">
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  fileInputRef.current?.setAttribute('accept', '.csv')
                  fileInputRef.current?.click()
                }}
                className="cursor-pointer"
              >
                <Upload className="w-4 h-4 mr-1" /> Subir .csv
              </Button>
              <Button variant="ghost" size="sm" onClick={handleDownloadCsvTemplate} className="cursor-pointer">
                <Download className="w-4 h-4 mr-1" /> Descargar plantilla
              </Button>
            </div>
            <Textarea
              value={csvText}
              onChange={e => {
                setCsvText(e.target.value)
                resetState()
              }}
              placeholder="name,address,city,state,country,zipCode,phone,email,type..."
              className="font-mono text-xs min-h-[200px]"
            />
            <p className="text-xs text-muted-foreground">
              Solo importa venues. La organización, pricing y settlement se configuran en el wizard.
            </p>
          </TabsContent>
        </Tabs>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 p-3 space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-amber-600">
              <AlertTriangle className="w-4 h-4" />
              Advertencias
            </div>
            {warnings.map((w, i) => (
              <p key={i} className="text-xs text-amber-600/80">
                {w}
              </p>
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv"
          onChange={handleFileUpload}
          className="hidden"
        />

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} className="cursor-pointer">
            Cancelar
          </Button>
          <Button
            onClick={tab === 'json' ? handleJsonImport : handleCsvImport}
            disabled={tab === 'json' ? !jsonText.trim() : !csvText.trim()}
            className="cursor-pointer"
          >
            Importar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
