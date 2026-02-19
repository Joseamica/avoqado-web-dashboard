import React, { useCallback, useMemo, useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { getOrganizationsList, type OrganizationSimple } from '@/services/superadmin-organizations.service'
import {
  superadminAPI,
  type BulkCreateVenuesPayload,
  type BulkCreateVenuesResponse,
  type BulkVenueInput,
} from '@/services/superadmin.service'
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileJson,
  Loader2,
  Plus,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// ── Types ────────────────────────────────────────────────────────────

const VENUE_TYPES = [
  { value: 'RESTAURANT', label: 'Restaurante' },
  { value: 'BAR', label: 'Bar' },
  { value: 'CAFE', label: 'Café' },
  { value: 'BAKERY', label: 'Panadería' },
  { value: 'FOOD_TRUCK', label: 'Food Truck' },
  { value: 'FAST_FOOD', label: 'Comida Rápida' },
  { value: 'CATERING', label: 'Catering' },
  { value: 'CLOUD_KITCHEN', label: 'Cocina Fantasma' },
  { value: 'RETAIL_STORE', label: 'Tienda Retail' },
  { value: 'JEWELRY', label: 'Joyería' },
  { value: 'CLOTHING', label: 'Ropa' },
  { value: 'ELECTRONICS', label: 'Electrónica' },
  { value: 'PHARMACY', label: 'Farmacia' },
  { value: 'CONVENIENCE_STORE', label: 'Tienda de Conveniencia' },
  { value: 'SUPERMARKET', label: 'Supermercado' },
  { value: 'TELECOMUNICACIONES', label: 'Telecomunicaciones' },
  { value: 'SALON', label: 'Salón' },
  { value: 'SPA', label: 'Spa' },
  { value: 'FITNESS', label: 'Gimnasio' },
  { value: 'CLINIC', label: 'Clínica' },
  { value: 'VETERINARY', label: 'Veterinaria' },
  { value: 'HOTEL', label: 'Hotel' },
  { value: 'CINEMA', label: 'Cine' },
  { value: 'NIGHTCLUB', label: 'Club Nocturno' },
  { value: 'OTHER', label: 'Otro' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
}

// ── Component ────────────────────────────────────────────────────────

const BulkVenueCreationDialog: React.FC<Props> = ({ open, onOpenChange }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // State
  const [step, setStep] = useState<'config' | 'json' | 'result'>('config')
  const [organizationId, setOrganizationId] = useState('')
  const [defaultType, setDefaultType] = useState('TELECOMUNICACIONES')
  const [defaultFeeValue, setDefaultFeeValue] = useState('0.025')
  const [jsonInput, setJsonInput] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [result, setResult] = useState<BulkCreateVenuesResponse | null>(null)

  // Queries
  const { data: organizations = [] } = useQuery<OrganizationSimple[]>({
    queryKey: ['superadmin-organizations-list'],
    queryFn: getOrganizationsList,
    enabled: open,
  })

  // Mutation
  const bulkMutation = useMutation({
    mutationFn: (payload: BulkCreateVenuesPayload) => superadminAPI.bulkCreateVenues(payload),
    onSuccess: (data) => {
      setResult(data)
      setStep('result')
      queryClient.invalidateQueries({ queryKey: ['superadmin-venues'] })
      toast({
        title: `${data.summary.venuesCreated} venues creados`,
        description: `${data.summary.terminalsCreated} terminales, ${data.summary.paymentConfigsCreated} configs de pago`,
      })
    },
    onError: (error: any) => {
      const errorData = error?.response?.data
      if (errorData?.errors?.length > 0) {
        setJsonError(errorData.errors.map((e: any) => `[${e.index}] ${e.field}: ${e.error}`).join('\n'))
      } else {
        const msg = errorData?.message || error?.response?.data?.error || error.message
        setJsonError(msg)
      }
      toast({
        title: 'Error en la carga masiva',
        description: errorData?.errors?.[0]?.error || error.message,
        variant: 'destructive',
      })
    },
  })

  // Handlers
  const handleReset = useCallback(() => {
    setStep('config')
    setOrganizationId('')
    setDefaultType('TELECOMUNICACIONES')
    setDefaultFeeValue('0.025')
    setJsonInput('')
    setJsonError('')
    setResult(null)
  }, [])

  const handleClose = useCallback(
    (isOpen: boolean) => {
      if (!isOpen) handleReset()
      onOpenChange(isOpen)
    },
    [onOpenChange, handleReset]
  )

  const handleDownloadTemplate = useCallback(() => {
    const template = {
      venues: [
        {
          name: 'Nombre del Venue',
          address: 'Dirección',
          city: 'Ciudad',
          state: 'Estado',
          zipCode: '00000',
          phone: '+525500000000',
          email: 'venue@ejemplo.com',
          terminals: [
            {
              serialNumber: 'ABC123456',
              name: 'Terminal 1',
              type: 'TPV_ANDROID',
              brand: 'PAX',
              model: 'A910S',
            },
          ],
        },
      ],
    }
    const blob = new Blob([JSON.stringify(template, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'bulk-venues-template.json'
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      setJsonInput(text)
      setJsonError('')
    }
    reader.readAsText(file)
    // Reset file input so same file can be re-uploaded
    e.target.value = ''
  }, [])

  const parsedVenues = useMemo((): BulkVenueInput[] | null => {
    if (!jsonInput.trim()) return null
    try {
      const parsed = JSON.parse(jsonInput)
      const venues = Array.isArray(parsed) ? parsed : parsed.venues
      if (!Array.isArray(venues) || venues.length === 0) {
        return null
      }
      return venues
    } catch {
      return null
    }
  }, [jsonInput])

  const handleSubmit = useCallback(() => {
    setJsonError('')

    if (!organizationId) {
      setJsonError('Selecciona una organización')
      return
    }

    if (!parsedVenues || parsedVenues.length === 0) {
      setJsonError('El JSON debe contener un array de venues con al menos 1 elemento')
      return
    }

    // Validate every venue has a name
    const missingName = parsedVenues.findIndex(v => !v.name?.trim())
    if (missingName >= 0) {
      setJsonError(`Venue en posición ${missingName} no tiene "name"`)
      return
    }

    if (parsedVenues.length > 100) {
      setJsonError('Máximo 100 venues por lote')
      return
    }

    const payload: BulkCreateVenuesPayload = {
      organizationId,
      defaults: {
        type: defaultType,
        feeType: 'PERCENTAGE',
        feeValue: parseFloat(defaultFeeValue) || 0.025,
        timezone: 'America/Mexico_City',
        currency: 'MXN',
        country: 'MX',
      },
      venues: parsedVenues,
    }

    bulkMutation.mutate(payload)
  }, [organizationId, parsedVenues, defaultType, defaultFeeValue, bulkMutation])

  // ── Render ───────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Carga Masiva de Venues
          </DialogTitle>
          <DialogDescription>
            Crea múltiples venues en una sola operación. Todo o nada: si un venue falla, no se crea ninguno.
          </DialogDescription>
        </DialogHeader>

        {step === 'config' && (
          <div className="space-y-5 py-2">
            {/* Organization selector */}
            <div className="space-y-2">
              <Label>
                Organización <span className="text-destructive">*</span>
              </Label>
              <Select value={organizationId} onValueChange={setOrganizationId}>
                <SelectTrigger className="cursor-pointer">
                  <SelectValue placeholder="Selecciona la organización" />
                </SelectTrigger>
                <SelectContent>
                  {organizations.map(org => (
                    <SelectItem key={org.id} value={org.id} className="cursor-pointer">
                      {org.name} {org.slug && <span className="text-muted-foreground">({org.slug})</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Default venue type */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Tipo de Venue (default)</Label>
                <Select value={defaultType} onValueChange={setDefaultType}>
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VENUE_TYPES.map(vt => (
                      <SelectItem key={vt.value} value={vt.value} className="cursor-pointer">
                        {vt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Fee (default)</Label>
                <Input
                  type="number"
                  step="0.001"
                  min="0"
                  max="1"
                  value={defaultFeeValue}
                  onChange={e => setDefaultFeeValue(e.target.value)}
                  className="cursor-text"
                  placeholder="0.025"
                />
                <p className="text-xs text-muted-foreground">
                  {(parseFloat(defaultFeeValue) * 100).toFixed(1)}% por transacción
                </p>
              </div>
            </div>

            {/* JSON input section */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>JSON de Venues</Label>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="cursor-pointer text-xs h-7"
                    onClick={handleDownloadTemplate}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Plantilla
                  </Button>
                  <label>
                    <Button
                      variant="outline"
                      size="sm"
                      className="cursor-pointer text-xs h-7"
                      asChild
                    >
                      <span>
                        <FileJson className="w-3.5 h-3.5 mr-1" />
                        Subir JSON
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept=".json"
                      className="hidden"
                      onChange={handleFileUpload}
                    />
                  </label>
                </div>
              </div>

              <textarea
                className={cn(
                  'w-full h-64 rounded-lg border bg-muted/30 p-3 font-mono text-xs',
                  'focus:outline-none focus:ring-2 focus:ring-ring resize-y',
                  jsonError && 'border-destructive'
                )}
                placeholder={`Pega tu JSON aquí o sube un archivo.\n\nFormato esperado:\n[\n  {\n    "name": "Venue 1",\n    "address": "Dirección",\n    "city": "Ciudad",\n    "terminals": [\n      { "serialNumber": "ABC123", "name": "Terminal 1", "type": "TPV_ANDROID" }\n    ]\n  }\n]`}
                value={jsonInput}
                onChange={e => {
                  setJsonInput(e.target.value)
                  setJsonError('')
                }}
              />

              {jsonError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <pre className="whitespace-pre-wrap text-xs">{jsonError}</pre>
                </div>
              )}

              {parsedVenues && !jsonError && (
                <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/10 border border-primary/20 text-sm text-primary">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>
                    {parsedVenues.length} venues detectados
                    {parsedVenues.reduce((sum, v) => sum + (v.terminals?.length || 0), 0) > 0 &&
                      ` con ${parsedVenues.reduce((sum, v) => sum + (v.terminals?.length || 0), 0)} terminales`}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 'result' && result && (
          <div className="space-y-4 py-2">
            {/* Summary */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-border/50 bg-green-500/10 p-4 text-center">
                <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                  {result.summary.venuesCreated}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Venues creados</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-blue-500/10 p-4 text-center">
                <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                  {result.summary.terminalsCreated}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Terminales</p>
              </div>
              <div className="rounded-xl border border-border/50 bg-purple-500/10 p-4 text-center">
                <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                  {result.summary.paymentConfigsCreated}
                </p>
                <p className="text-xs text-muted-foreground mt-1">Configs de pago</p>
              </div>
            </div>

            {/* Venue list */}
            <div className="rounded-xl border border-border/50 overflow-hidden">
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">#</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Nombre</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Slug</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Terminales</th>
                      <th className="text-left px-3 py-2 font-medium text-muted-foreground">Pago</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {result.venues.map(v => (
                      <tr key={v.venueId} className="hover:bg-muted/30">
                        <td className="px-3 py-2 text-muted-foreground">{v.index + 1}</td>
                        <td className="px-3 py-2 font-medium">{v.name}</td>
                        <td className="px-3 py-2">
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">{v.slug}</code>
                        </td>
                        <td className="px-3 py-2">{v.terminals.length}</td>
                        <td className="px-3 py-2">
                          {v.paymentConfigured ? (
                            <CheckCircle2 className="w-4 h-4 text-green-500" />
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <DialogFooter>
          {step === 'config' && (
            <>
              <Button
                variant="outline"
                onClick={() => handleClose(false)}
                className="cursor-pointer"
              >
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={!organizationId || !parsedVenues || bulkMutation.isPending}
                className="cursor-pointer"
              >
                {bulkMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando {parsedVenues?.length || 0} venues...
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4 mr-2" />
                    Crear {parsedVenues?.length || 0} Venues
                  </>
                )}
              </Button>
            </>
          )}
          {step === 'result' && (
            <>
              <Button
                variant="outline"
                onClick={handleReset}
                className="cursor-pointer"
              >
                Crear más
              </Button>
              <Button onClick={() => handleClose(false)} className="cursor-pointer">
                Cerrar
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default BulkVenueCreationDialog
