import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Zap,
  ChevronRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  Info,
  AlertTriangle,
  Calculator,
  Terminal,
  Building2,
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { paymentProviderAPI, type MccLookupResult } from '@/services/paymentProvider.service'
import { getAllVenues } from '@/services/superadmin.service'
import { cn } from '@/lib/utils'
import { StepIndicator } from './shared-components'

interface BlumonAutoFetchWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId?: string // Optional - if provided, skip venue selection step
  onSuccess: () => void
}

export const BlumonAutoFetchWizard: React.FC<BlumonAutoFetchWizardProps> = ({
  open,
  onOpenChange,
  venueId: initialVenueId,
  onSuccess
}) => {
  const { toast } = useToast()
  const [step, setStep] = useState(initialVenueId ? 1 : 0) // Skip venue step if venueId provided
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)

  // Selected venue for superadmin context
  const [selectedVenueId, setSelectedVenueId] = useState<string>(initialVenueId || '')

  const [formData, setFormData] = useState({
    serialNumber: '',
    brand: 'PAX',
    model: 'A910S',
    displayName: '',
    environment: 'SANDBOX' as 'SANDBOX' | 'PRODUCTION',
    businessCategory: '',
  })

  // Cost structure preview state
  const [createCostStructure, setCreateCostStructure] = useState(true)
  const [mccPreview, setMccPreview] = useState<MccLookupResult | null>(null)
  const [loadingMccPreview, setLoadingMccPreview] = useState(false)

  // Fetch all venues for dropdown (only for superadmin context)
  const { data: venues = [] } = useQuery({
    queryKey: ['superadmin-venues'],
    queryFn: () => getAllVenues(),
    enabled: open && !initialVenueId,
  })

  // Steps depend on whether venue is pre-selected
  const steps = initialVenueId
    ? [
        { label: 'Terminal', description: 'Datos del dispositivo' },
        { label: 'Configurar', description: 'Opciones adicionales' },
        { label: 'Costos', description: 'Estructura de costos' },
        { label: 'Confirmar', description: 'Revisar y crear' },
      ]
    : [
        { label: 'Venue', description: 'Seleccionar venue' },
        { label: 'Terminal', description: 'Datos del dispositivo' },
        { label: 'Configurar', description: 'Opciones adicionales' },
        { label: 'Costos', description: 'Estructura de costos' },
        { label: 'Confirmar', description: 'Revisar y crear' },
      ]

  const resetWizard = () => {
    setStep(initialVenueId ? 1 : 0)
    setResult(null)
    setSelectedVenueId(initialVenueId || '')
    setFormData({
      serialNumber: '',
      brand: 'PAX',
      model: 'A910S',
      displayName: '',
      environment: 'SANDBOX',
      businessCategory: '',
    })
    setCreateCostStructure(true)
    setMccPreview(null)
    setLoadingMccPreview(false)
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(resetWizard, 300)
  }

  // Fetch MCC preview when entering cost step
  const fetchMccPreview = async () => {
    if (!formData.businessCategory) {
      setMccPreview({
        found: false,
        confidence: 0,
        mcc: null,
        familia: 'Otros',
        rates: { credito: 2.59, debito: 1.95, internacional: 3.3, amex: 3.0 },
      } as MccLookupResult)
      return
    }

    setLoadingMccPreview(true)
    try {
      const result = await paymentProviderAPI.getMccRateSuggestion(formData.businessCategory)
      setMccPreview(result)
    } catch (error) {
      console.error('Error fetching MCC preview:', error)
      setMccPreview({
        found: false,
        confidence: 0,
        mcc: null,
        familia: 'Otros',
        rates: { credito: 2.59, debito: 1.95, internacional: 3.3, amex: 3.0 },
      } as MccLookupResult)
    } finally {
      setLoadingMccPreview(false)
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    try {
      const response = await paymentProviderAPI.autoFetchBlumonCredentials({
        serialNumber: formData.serialNumber,
        brand: formData.brand,
        model: formData.model,
        displayName: formData.displayName || undefined,
        environment: formData.environment,
        businessCategory: formData.businessCategory || undefined,
        skipCostStructure: !createCostStructure,
      })

      if (response.alreadyExists) {
        toast({
          title: '📋 Cuenta ya existente',
          description: `Ya existe una cuenta para este terminal: ${response.displayName}`,
        })
      } else {
        toast({
          title: '✅ Cuenta creada exitosamente',
          description: `${response.displayName} está listo para procesar pagos`,
        })
      }

      onSuccess()
      onOpenChange(false)
    } catch (error: any) {
      console.error('Auto-fetch error:', error)
      toast({
        variant: 'destructive',
        title: 'Error al crear cuenta',
        description: error.response?.data?.message || error.message || 'Error desconocido',
      })
    } finally {
      setLoading(false)
    }
  }

  const canProceed = () => {
    // Venue selection step (only for superadmin)
    if (!initialVenueId && step === 0) return selectedVenueId.length > 0
    // Terminal step
    const terminalStep = initialVenueId ? 0 : 1
    if (step === terminalStep) return formData.serialNumber.length > 0
    return true
  }

  // Get selected venue name for display
  const selectedVenueName = venues.find(v => v.id === selectedVenueId)?.name || ''

  // Adjust step numbers based on whether venue step exists
  const getContentStep = () => {
    if (initialVenueId) return step
    return step // For superadmin, step 0 is venue, 1 is terminal, etc.
  }

  const renderStepContent = () => {
    const contentStep = getContentStep()

    // Step 0: Venue Selection (only for superadmin without pre-selected venue)
    if (!initialVenueId && contentStep === 0) {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">Selecciona un Venue</p>
              <p>
                La cuenta de procesamiento se asociará automáticamente a este venue a través de su VenuePaymentConfig.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-sm font-medium">
              Venue <span className="text-destructive">*</span>
            </Label>
            <Select value={selectedVenueId} onValueChange={setSelectedVenueId}>
              <SelectTrigger className="h-12 bg-muted/30">
                <SelectValue placeholder="Seleccionar venue..." />
              </SelectTrigger>
              <SelectContent>
                {venues.map(venue => (
                  <SelectItem key={venue.id} value={venue.id}>
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                      <span>{venue.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )
    }

    // Step 1: Terminal Info
    const terminalStep = initialVenueId ? 0 : 1
    if (contentStep === terminalStep) {
      return (
        <div className="space-y-6">
          <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
            <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-medium mb-1">¿Cómo funciona?</p>
              <p>
                Ingresa el número de serie de tu terminal PAX. El sistema se conectará automáticamente con Blumon para obtener las
                credenciales OAuth, RSA y DUKPT.
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Número de Serie <span className="text-destructive">*</span>
              </Label>
              <Input
                value={formData.serialNumber}
                onChange={e => setFormData({ ...formData, serialNumber: e.target.value })}
                placeholder="Ej: 2841548417"
                className="h-12 text-lg font-mono bg-muted/30"
              />
              <p className="text-xs text-muted-foreground">
                Encuéntralo en la etiqueta trasera del terminal o en Configuración &gt; Sistema
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Marca <span className="text-destructive">*</span>
                </Label>
                <Select value={formData.brand} onValueChange={value => setFormData({ ...formData, brand: value })}>
                  <SelectTrigger className="h-11 bg-muted/30">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PAX">
                      <div className="flex items-center gap-2">
                        <Terminal className="w-4 h-4" />
                        PAX Technology
                      </div>
                    </SelectItem>
                    <SelectItem value="Verifone">Verifone</SelectItem>
                    <SelectItem value="Ingenico">Ingenico</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Modelo <span className="text-destructive">*</span>
                </Label>
                <Input
                  value={formData.model}
                  onChange={e => setFormData({ ...formData, model: e.target.value })}
                  placeholder="A910S"
                  className="h-11 bg-muted/30"
                />
              </div>
            </div>
          </div>
        </div>
      )
    }

    // Step 2: Configuration
    const configStep = initialVenueId ? 1 : 2
    if (contentStep === configStep) {
      return (
        <div className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-sm font-medium">Nombre para mostrar</Label>
              <Input
                value={formData.displayName}
                onChange={e => setFormData({ ...formData, displayName: e.target.value })}
                placeholder="Ej: Cuenta Terraza, Cuenta Barra..."
                className="h-11 bg-muted/30"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm font-medium">
                Ambiente <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, environment: 'SANDBOX' })}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    formData.environment === 'SANDBOX'
                      ? 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950/30'
                      : 'border-border hover:border-muted-foreground/50',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="font-medium text-sm">Sandbox</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Para pruebas</p>
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, environment: 'PRODUCTION' })}
                  className={cn(
                    'p-4 rounded-xl border-2 text-left transition-all',
                    formData.environment === 'PRODUCTION'
                      ? 'border-green-500 bg-green-50 dark:bg-green-950/30'
                      : 'border-border hover:border-muted-foreground/50',
                  )}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="font-medium text-sm">Production</span>
                  </div>
                  <p className="text-xs text-muted-foreground">Pagos reales</p>
                </button>
              </div>
            </div>

            <Collapsible>
              <CollapsibleTrigger asChild>
                <button className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
                  <ChevronRight className="w-4 h-4" />
                  Opciones avanzadas
                </button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-4">
                <div className="space-y-2 p-4 rounded-xl bg-muted/30 border border-border/50">
                  <Label className="text-sm font-medium">Giro del Negocio (fallback para tasas MCC)</Label>
                  <Input
                    value={formData.businessCategory}
                    onChange={e => setFormData({ ...formData, businessCategory: e.target.value })}
                    placeholder="Ej: Restaurante, Gimnasio..."
                    className="h-11 bg-background"
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>
      )
    }

    // Step 3: Cost Structure Preview
    const costsStep = initialVenueId ? 2 : 3
    if (contentStep === costsStep) {
      return (
        <div className="space-y-6">
          {loadingMccPreview ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              {/* MCC Detection Info */}
              <div
                className={cn(
                  'flex items-start gap-3 p-4 rounded-xl border',
                  mccPreview?.found
                    ? 'bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800'
                    : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800',
                )}
              >
                {mccPreview?.found ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                )}
                <div
                  className={cn(
                    'text-sm',
                    mccPreview?.found ? 'text-green-700 dark:text-green-300' : 'text-amber-700 dark:text-amber-300',
                  )}
                >
                  <p className="font-medium mb-1">
                    {mccPreview?.found ? 'Tasas detectadas automáticamente' : 'Usando tasas por defecto'}
                  </p>
                  <p className="text-xs">
                    {mccPreview?.found
                      ? `Basado en: ${mccPreview.familia} (MCC ${mccPreview.mcc}) - Confianza: ${mccPreview.confidence}%`
                      : 'No se detectó el giro del negocio. Puedes configurar las tasas después.'}
                  </p>
                </div>
              </div>

              {/* Rate Preview */}
              {mccPreview?.rates && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                  <h4 className="font-medium mb-4 flex items-center gap-2">
                    <Calculator className="w-4 h-4 text-green-600" />
                    Tasas de Procesamiento
                  </h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Crédito</p>
                      <p className="text-lg font-bold text-green-600">{mccPreview.rates.credito.toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Débito</p>
                      <p className="text-lg font-bold text-blue-600">{mccPreview.rates.debito.toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Amex</p>
                      <p className="text-lg font-bold text-purple-600">{mccPreview.rates.amex.toFixed(2)}%</p>
                    </div>
                    <div className="p-3 rounded-lg bg-background/50 border border-border/30">
                      <p className="text-xs text-muted-foreground mb-1">Internacional</p>
                      <p className="text-lg font-bold text-orange-600">{mccPreview.rates.internacional.toFixed(2)}%</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Create Cost Structure Checkbox */}
              <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/20 border border-border/50">
                <Checkbox
                  id="createCostStructure"
                  checked={createCostStructure}
                  onCheckedChange={checked => setCreateCostStructure(checked === true)}
                  className="mt-0.5"
                />
                <div className="flex-1">
                  <Label htmlFor="createCostStructure" className="font-medium cursor-pointer">
                    Crear estructura de costos ahora
                  </Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    {createCostStructure
                      ? 'Las tasas mostradas arriba se guardarán automáticamente.'
                      : 'Puedes configurarlo después desde el botón de costos en la tarjeta de cuenta.'}
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
      )
    }

    // Step 4: Confirmation
    const confirmStep = initialVenueId ? 3 : 4
    if (contentStep === confirmStep) {
      return (
        <div className="space-y-6">
          <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
            <h4 className="font-medium mb-4">Resumen de configuración</h4>
            <div className="space-y-3">
              {!initialVenueId && selectedVenueName && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Venue</span>
                  <span className="text-sm font-medium">{selectedVenueName}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Número de serie</span>
                <span className="text-sm font-mono font-medium">{formData.serialNumber}</span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Terminal</span>
                <span className="text-sm font-medium">
                  {formData.brand} {formData.model}
                </span>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Ambiente</span>
                <Badge variant={formData.environment === 'PRODUCTION' ? 'default' : 'secondary'}>
                  {formData.environment === 'PRODUCTION' ? 'Production' : 'Sandbox'}
                </Badge>
              </div>
              {formData.displayName && (
                <div className="flex items-center justify-between py-2 border-b border-border/50">
                  <span className="text-sm text-muted-foreground">Nombre</span>
                  <span className="text-sm font-medium">{formData.displayName}</span>
                </div>
              )}
              <div className="flex items-center justify-between py-2">
                <span className="text-sm text-muted-foreground">Estructura de costos</span>
                <Badge variant={createCostStructure ? 'default' : 'secondary'}>
                  {createCostStructure ? 'Se creará' : 'Configurar después'}
                </Badge>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
            <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-green-700 dark:text-green-300">
              <p className="font-medium mb-1">Lo que sucederá</p>
              <ul className="space-y-1 text-xs">
                <li>• Se obtendrán credenciales OAuth de Blumon</li>
                <li>• Se descargarán RSA keys y DUKPT keys</li>
                {createCostStructure && <li>• Se creará la estructura de costos automáticamente</li>}
              </ul>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  const totalSteps = steps.length
  const lastStep = totalSteps - 1

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[650px] max-h-[90vh] overflow-y-auto bg-background p-0">
        {/* Header with gradient */}
        <div className="bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-yellow-500/10 border-b border-border/50 p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-yellow-500 to-orange-500">
              <Zap className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <DialogTitle className="text-xl">Blumon Auto-Fetch</DialogTitle>
              <DialogDescription>Crea una cuenta de procesamiento automáticamente</DialogDescription>
            </div>
          </div>

          {step <= lastStep && <StepIndicator steps={steps} currentStep={step} />}
        </div>

        <div className="p-6">
          {renderStepContent()}
        </div>

        {/* Footer */}
        <DialogFooter className="p-6 pt-0">
          <Button variant="outline" onClick={step === 0 ? handleClose : () => setStep(step - 1)} disabled={loading}>
            {step === 0 ? 'Cancelar' : 'Atrás'}
          </Button>
          {step < lastStep ? (
            <Button
              onClick={() => {
                // When moving to costs step, fetch MCC preview
                const costsStep = initialVenueId ? 2 : 3
                if (step === costsStep - 1 && !mccPreview && !loadingMccPreview) {
                  fetchMccPreview()
                }
                setStep(step + 1)
              }}
              disabled={!canProceed()}
            >
              Continuar
              <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={loading}
              className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {loading ? 'Creando cuenta...' : 'Crear Cuenta'}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
