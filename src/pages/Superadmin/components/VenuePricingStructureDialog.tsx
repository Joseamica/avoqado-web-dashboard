import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { type VenuePricingStructure, paymentProviderAPI } from '@/services/paymentProvider.service'
import { useQuery } from '@tanstack/react-query'
import { Loader2, TrendingUp, ChevronRight, ChevronLeft, Check, HelpCircle, DollarSign, FileText } from 'lucide-react'
import React, { useEffect, useState } from 'react'
import api from '@/api'
import { cn } from '@/lib/utils'

interface VenuePricingStructureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  pricingStructure?: VenuePricingStructure | null
  venueId?: string
  initialAccountType?: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  onSave: (data: {
    venueId: string
    accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
    effectiveFrom: string
    debitRate: number
    creditRate: number
    amexRate: number
    internationalRate: number
    fixedFeePerTransaction?: number
    monthlyServiceFee?: number
    contractReference?: string
    notes?: string
  }) => Promise<void>
}

type Step = 1 | 2 | 3

export const VenuePricingStructureDialog: React.FC<VenuePricingStructureDialogProps> = ({
  open,
  onOpenChange,
  pricingStructure,
  venueId: initialVenueId,
  initialAccountType,
  onSave,
}) => {
  const [loading, setLoading] = useState(false)
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [providerCost, setProviderCost] = useState<any>(null)
  const [venueConfig, setVenueConfig] = useState<any>(null)

  // Fetch venues for dropdown
  const { data: venues = [] } = useQuery({
    queryKey: ['venues-list'],
    queryFn: async () => {
      const response = await api.get('/api/v1/dashboard/superadmin/venues')
      return response.data.data
    },
  })

  const [formData, setFormData] = useState({
    venueId: initialVenueId || '',
    accountType: 'PRIMARY' as 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
    effectiveFrom: new Date().toISOString().split('T')[0],
    debitRate: '' as number | '',
    creditRate: '' as number | '',
    amexRate: '' as number | '',
    internationalRate: '' as number | '',
    fixedFeePerTransaction: '' as number | '',
    monthlyServiceFee: '' as number | '',
    contractReference: '',
    notes: '',
  })

  // Fetch venue payment config when venue changes
  useEffect(() => {
    if (formData.venueId) {
      paymentProviderAPI
        .getVenuePaymentConfig(formData.venueId)
        .then(config => {
          setVenueConfig(config)
        })
        .catch(err => {
          console.error('Failed to fetch venue config:', err)
          setVenueConfig(null)
        })
    } else {
      setVenueConfig(null)
      setProviderCost(null)
    }
  }, [formData.venueId])

  // Fetch provider cost for the correct merchant account based on account type
  useEffect(() => {
    if (!venueConfig || !formData.accountType) {
      setProviderCost(null)
      return
    }

    let merchantAccountId: string | null = null
    switch (formData.accountType) {
      case 'PRIMARY':
        merchantAccountId = venueConfig.primaryAccountId
        break
      case 'SECONDARY':
        merchantAccountId = venueConfig.secondaryAccountId || null
        break
      case 'TERTIARY':
        merchantAccountId = venueConfig.tertiaryAccountId || null
        break
    }

    if (merchantAccountId) {
      paymentProviderAPI
        .getActiveCostStructure(merchantAccountId)
        .then(cost => {
          setProviderCost(cost)
        })
        .catch(err => {
          console.error(`Failed to fetch cost structure for ${formData.accountType}:`, err)
          setProviderCost(null)
        })
    } else {
      setProviderCost(null)
    }
  }, [venueConfig, formData.accountType])

  useEffect(() => {
    if (pricingStructure) {
      const formValues = {
        venueId: pricingStructure.venueId,
        accountType: pricingStructure.accountType,
        effectiveFrom: pricingStructure.effectiveFrom.split('T')[0],
        debitRate: Number(pricingStructure.debitRate) * 100,
        creditRate: Number(pricingStructure.creditRate) * 100,
        amexRate: Number(pricingStructure.amexRate) * 100,
        internationalRate: Number(pricingStructure.internationalRate) * 100,
        fixedFeePerTransaction: Number(pricingStructure.fixedFeePerTransaction) || 0,
        monthlyServiceFee: Number(pricingStructure.monthlyServiceFee) || 0,
        contractReference: pricingStructure.contractReference || '',
        notes: pricingStructure.notes || '',
      }
      setFormData(formValues)
    } else {
      setFormData({
        venueId: initialVenueId || '',
        accountType: initialAccountType || 'PRIMARY',
        effectiveFrom: new Date().toISOString().split('T')[0],
        debitRate: '',
        creditRate: '',
        amexRate: '',
        internationalRate: '',
        fixedFeePerTransaction: '',
        monthlyServiceFee: '',
        contractReference: '',
        notes: '',
      })
    }
    setCurrentStep(1)
  }, [pricingStructure, initialVenueId, initialAccountType, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await onSave({
        venueId: formData.venueId,
        accountType: formData.accountType,
        effectiveFrom: new Date(formData.effectiveFrom).toISOString(),
        debitRate: (Number(formData.debitRate) || 0) / 100,
        creditRate: (Number(formData.creditRate) || 0) / 100,
        amexRate: (Number(formData.amexRate) || 0) / 100,
        internationalRate: (Number(formData.internationalRate) || 0) / 100,
        fixedFeePerTransaction: Number(formData.fixedFeePerTransaction) || 0,
        monthlyServiceFee: Number(formData.monthlyServiceFee) || 0,
        contractReference: formData.contractReference || undefined,
        notes: formData.notes || undefined,
      })
      onOpenChange(false)
    } catch (error) {
      console.error('Error saving pricing structure:', error)
    } finally {
      setLoading(false)
    }
  }

  const calculateMargin = (venueRate: number, cardType: 'debit' | 'credit' | 'amex' | 'international') => {
    if (!providerCost) return null
    const providerRate = Number(providerCost[`${cardType}Rate`]) * 100
    const margin = venueRate - providerRate
    return { margin, providerRate }
  }

  const canProceedToStep2 = formData.venueId && formData.accountType
  const canProceedToStep3 =
    canProceedToStep2 &&
    formData.debitRate !== '' &&
    formData.creditRate !== '' &&
    formData.amexRate !== '' &&
    formData.internationalRate !== ''

  const StepIndicator: React.FC = () => {
    const steps = [
      { number: 1, label: 'Establecimiento' },
      { number: 2, label: 'Tarifas' },
      { number: 3, label: 'Detalles' },
    ]

    return (
      <div className="flex items-center justify-between mb-6">
        {steps.map((step, index) => (
          <React.Fragment key={step.number}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  currentStep > step.number
                    ? 'bg-green-500 text-primary-foreground'
                    : currentStep === step.number
                    ? 'bg-blue-500 text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {currentStep > step.number ? <Check className="w-4 h-4" /> : step.number}
              </div>
              <span
                className={cn(
                  'text-sm font-medium hidden sm:block',
                  currentStep >= step.number ? 'text-foreground' : 'text-muted-foreground'
                )}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div className="flex-1 h-0.5 bg-border mx-2" />
            )}
          </React.Fragment>
        ))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto bg-background">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Estructura de Precios para Venue</DialogTitle>
            <DialogDescription>Configura las tarifas que Avoqado cobra al venue</DialogDescription>
          </DialogHeader>

          <div className="py-6">
            <StepIndicator />

            {/* Step 1: Venue Selection + Account Type */}
            {currentStep === 1 && (
              <div className="space-y-6">
                {/* Info Banner */}
                <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <HelpCircle className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-blue-900 dark:text-blue-100 mb-2">
                          Paso 1: Selecciona el Venue y Tipo de Cuenta
                        </p>
                        <p className="text-blue-800 dark:text-blue-200">
                          Cada venue puede tener hasta 3 cuentas merchant para procesar pagos: Primaria (principal), Secundaria (backup) y Terciaria (redundancia adicional).
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Venue Selection */}
                <div className="space-y-2">
                  <Label htmlFor="venue">
                    Establecimiento <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.venueId}
                    onValueChange={value => setFormData({ ...formData, venueId: value })}
                    disabled={!!pricingStructure || !!initialVenueId}
                  >
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue placeholder="Selecciona un venue..." />
                    </SelectTrigger>
                    <SelectContent>
                      {venues.map((venue: any) => (
                        <SelectItem key={venue.id} value={venue.id}>
                          {venue.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    El establecimiento al que aplicarán estas tarifas
                  </p>
                </div>

                {/* Account Type */}
                <div className="space-y-2">
                  <Label htmlFor="accountType">
                    Tipo de Cuenta <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={formData.accountType}
                    onValueChange={(value: any) => setFormData({ ...formData, accountType: value })}
                    disabled={!!pricingStructure || !!initialAccountType}
                  >
                    <SelectTrigger className="bg-background border-input">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PRIMARY">Cuenta Primaria</SelectItem>
                      <SelectItem value="SECONDARY">Cuenta Secundaria</SelectItem>
                      <SelectItem value="TERTIARY">Cuenta Terciaria</SelectItem>
                    </SelectContent>
                  </Select>
                  {(pricingStructure || initialAccountType) && (
                    <p className="text-xs text-muted-foreground">
                      {pricingStructure
                        ? 'El tipo de cuenta no se puede cambiar después de crear.'
                        : `Creando tarifas para cuenta ${formData.accountType === 'PRIMARY' ? 'Primaria' : formData.accountType === 'SECONDARY' ? 'Secundaria' : 'Terciaria'}.`}
                    </p>
                  )}
                </div>

                {/* Account Type Explanation */}
                <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <HelpCircle className="h-5 w-5 text-purple-600 dark:text-purple-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-purple-900 dark:text-purple-100 mb-2">
                          ¿Qué significan las cuentas Primaria, Secundaria y Terciaria?
                        </p>
                        <div className="space-y-3 text-purple-800 dark:text-purple-200">
                          <div className="flex gap-2">
                            <span className="font-medium text-green-600 dark:text-green-400 whitespace-nowrap">PRIMARIA:</span>
                            <span>El procesador de pagos <strong>principal</strong>. Todas las transacciones se intentan procesar primero aquí.</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-medium text-yellow-600 dark:text-yellow-400 whitespace-nowrap">SECUNDARIA:</span>
                            <span>El procesador de <strong>respaldo</strong>. Si la cuenta primaria falla o está fuera de servicio, los pagos se redirigen aquí automáticamente.</span>
                          </div>
                          <div className="flex gap-2">
                            <span className="font-medium text-orange-600 dark:text-orange-400 whitespace-nowrap">TERCIARIA:</span>
                            <span>El <strong>tercer respaldo</strong> para máxima redundancia. Solo se usa si las cuentas primaria y secundaria fallan.</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Effective Date */}
                <div className="space-y-2">
                  <Label htmlFor="effectiveFrom">
                    Vigente desde <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="effectiveFrom"
                    type="date"
                    value={formData.effectiveFrom}
                    onChange={e => setFormData({ ...formData, effectiveFrom: e.target.value })}
                    required
                    className="bg-background border-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Fecha desde la cual estas tarifas entran en vigor
                  </p>
                </div>
              </div>
            )}

            {/* Step 2: Card Rates */}
            {currentStep === 2 && (
              <div className="space-y-6">
                {/* Info Banner */}
                <Card className="border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-green-900 dark:text-green-100 mb-2">
                          Paso 2: Configure las Tarifas por Tipo de Tarjeta
                        </p>
                        <p className="text-green-800 dark:text-green-200 mb-2">
                          Las tarifas son porcentajes (%) que Avoqado cobra al venue. El <strong>margen</strong> es tu ganancia: la diferencia entre esta tarifa y el costo del procesador.
                        </p>
                        <p className="text-green-800 dark:text-green-200 font-medium">
                          Margen = Tarifa al Venue − Costo del Procesador
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Rate Grid */}
                <div className="border border-border rounded-lg p-4 space-y-3 bg-muted/30">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Tarifas por Tipo de Tarjeta</Label>
                    {venueConfig && formData.accountType && (
                      <p className="text-xs text-muted-foreground">
                        {formData.accountType === 'PRIMARY' && venueConfig.primaryAccount && (
                          <>Márgenes vs. {venueConfig.primaryAccount.displayName}</>
                        )}
                        {formData.accountType === 'SECONDARY' && venueConfig.secondaryAccount && (
                          <>Márgenes vs. {venueConfig.secondaryAccount.displayName}</>
                        )}
                        {formData.accountType === 'TERTIARY' && venueConfig.tertiaryAccount && (
                          <>Márgenes vs. {venueConfig.tertiaryAccount.displayName}</>
                        )}
                        {formData.accountType === 'SECONDARY' && !venueConfig.secondaryAccount && (
                          <span className="text-orange-500">Sin merchant secundario asignado</span>
                        )}
                        {formData.accountType === 'TERTIARY' && !venueConfig.tertiaryAccount && (
                          <span className="text-orange-500">Sin merchant terciario asignado</span>
                        )}
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Debit Rate */}
                    <div className="grid gap-2">
                      <Label htmlFor="debitRate">Tarifa Débito (%) <span className="text-destructive">*</span></Label>
                      <Input
                        id="debitRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.debitRate}
                        onChange={e => setFormData({ ...formData, debitRate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        placeholder="2.2"
                        required
                        className="bg-background border-input"
                      />
                      {providerCost && Number(formData.debitRate) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Margen: +{calculateMargin(Number(formData.debitRate), 'debit')?.margin.toFixed(2)}% (Costo:{' '}
                          {calculateMargin(Number(formData.debitRate), 'debit')?.providerRate.toFixed(2)}%)
                        </p>
                      )}
                    </div>

                    {/* Credit Rate */}
                    <div className="grid gap-2">
                      <Label htmlFor="creditRate">Tarifa Crédito (%) <span className="text-destructive">*</span></Label>
                      <Input
                        id="creditRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.creditRate}
                        onChange={e => setFormData({ ...formData, creditRate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        placeholder="2.5"
                        required
                        className="bg-background border-input"
                      />
                      {providerCost && Number(formData.creditRate) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Margen: +{calculateMargin(Number(formData.creditRate), 'credit')?.margin.toFixed(2)}% (Costo:{' '}
                          {calculateMargin(Number(formData.creditRate), 'credit')?.providerRate.toFixed(2)}%)
                        </p>
                      )}
                    </div>

                    {/* Amex Rate */}
                    <div className="grid gap-2">
                      <Label htmlFor="amexRate">Tarifa AMEX (%) <span className="text-destructive">*</span></Label>
                      <Input
                        id="amexRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.amexRate}
                        onChange={e => setFormData({ ...formData, amexRate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        placeholder="3.2"
                        required
                        className="bg-background border-input"
                      />
                      {providerCost && Number(formData.amexRate) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Margen: +{calculateMargin(Number(formData.amexRate), 'amex')?.margin.toFixed(2)}% (Costo:{' '}
                          {calculateMargin(Number(formData.amexRate), 'amex')?.providerRate.toFixed(2)}%)
                        </p>
                      )}
                    </div>

                    {/* International Rate */}
                    <div className="grid gap-2">
                      <Label htmlFor="internationalRate">Tarifa Internacional (%) <span className="text-destructive">*</span></Label>
                      <Input
                        id="internationalRate"
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={formData.internationalRate}
                        onChange={e => setFormData({ ...formData, internationalRate: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                        placeholder="3.3"
                        required
                        className="bg-background border-input"
                      />
                      {providerCost && Number(formData.internationalRate) > 0 && (
                        <p className="text-xs text-green-600 dark:text-green-400">
                          Margen: +{calculateMargin(Number(formData.internationalRate), 'international')?.margin.toFixed(2)}% (Costo:{' '}
                          {calculateMargin(Number(formData.internationalRate), 'international')?.providerRate.toFixed(2)}%)
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Explanation */}
                <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <DollarSign className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-semibold mb-2">¿Por qué diferentes tipos de tarjeta?</p>
                        <p>
                          Cada tipo de tarjeta tiene costos distintos del procesador. Las tarjetas de <strong>débito</strong> son más baratas,
                          las de <strong>crédito</strong> cuestan más, <strong>AMEX</strong> tiene comisiones premium, y las tarjetas
                          <strong> internacionales</strong> incluyen cargos de conversión.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Step 3: Additional Details */}
            {currentStep === 3 && (
              <div className="space-y-6">
                {/* Info Banner */}
                <Card className="border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/20">
                  <CardContent className="pt-6">
                    <div className="flex gap-3">
                      <FileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-semibold text-indigo-900 dark:text-indigo-100 mb-2">
                          Paso 3: Detalles Adicionales (Opcional)
                        </p>
                        <p className="text-indigo-800 dark:text-indigo-200">
                          Agrega cuotas fijas, referencia del contrato y notas adicionales si es necesario.
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Fixed Fees */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="fixedFeePerTransaction">Cuota fija por transacción ($)</Label>
                    <Input
                      id="fixedFeePerTransaction"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.fixedFeePerTransaction}
                      onChange={e =>
                        setFormData({ ...formData, fixedFeePerTransaction: e.target.value === '' ? '' : parseFloat(e.target.value) })
                      }
                      placeholder="0.00"
                      className="bg-background border-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cargo fijo adicional por cada transacción
                    </p>
                  </div>

                  <div className="grid gap-2">
                    <Label htmlFor="monthlyServiceFee">Cuota mensual ($)</Label>
                    <Input
                      id="monthlyServiceFee"
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.monthlyServiceFee}
                      onChange={e => setFormData({ ...formData, monthlyServiceFee: e.target.value === '' ? '' : parseFloat(e.target.value) })}
                      placeholder="0.00"
                      className="bg-background border-input"
                    />
                    <p className="text-xs text-muted-foreground">
                      Cargo mensual de servicio
                    </p>
                  </div>
                </div>

                {/* Contract Reference */}
                <div className="grid gap-2">
                  <Label htmlFor="contractReference">Referencia de contrato</Label>
                  <Input
                    id="contractReference"
                    value={formData.contractReference}
                    onChange={e => setFormData({ ...formData, contractReference: e.target.value })}
                    placeholder="Ej: CONTRATO-2025-001"
                    className="bg-background border-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Número o código de referencia del contrato
                  </p>
                </div>

                {/* Notes */}
                <div className="grid gap-2">
                  <Label htmlFor="notes">Notas</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Notas adicionales sobre esta estructura de precios..."
                    rows={3}
                    className="bg-background border-input"
                  />
                  <p className="text-xs text-muted-foreground">
                    Cualquier información adicional relevante
                  </p>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            <div className="flex gap-2">
              {currentStep > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setCurrentStep((prev) => (prev - 1) as Step)}
                  disabled={loading}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Anterior
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading}
              >
                Cancelar
              </Button>
              {currentStep < 3 ? (
                <Button
                  type="button"
                  onClick={() => setCurrentStep((prev) => (prev + 1) as Step)}
                  disabled={
                    (currentStep === 1 && !canProceedToStep2) ||
                    (currentStep === 2 && !canProceedToStep3)
                  }
                >
                  Siguiente
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button type="submit" disabled={loading}>
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {pricingStructure ? 'Actualizar Tarifas' : 'Crear Estructura de Precios'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
