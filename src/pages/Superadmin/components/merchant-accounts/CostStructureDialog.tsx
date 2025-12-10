import React, { useState, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { useToast } from '@/hooks/use-toast'
import {
  AlertCircle,
  Calculator,
  CheckCircle2,
  ChevronRight,
  DollarSign,
  Info,
  Loader2,
  Pencil,
  Percent,
  RefreshCw,
} from 'lucide-react'
import {
  paymentProviderAPI,
  type MerchantAccount,
  type ProviderCostStructure,
  type MccLookupResult,
} from '@/services/paymentProvider.service'
import { cn } from '@/lib/utils'
import { GlassCard } from './shared-components'

interface CostStructureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  account: MerchantAccount | null
  venueType?: string
}

export const CostStructureDialog: React.FC<CostStructureDialogProps> = ({
  open,
  onOpenChange,
  account,
  venueType,
}) => {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [mode, setMode] = useState<'view' | 'create' | 'edit'>('view')
  const [isDetecting, setIsDetecting] = useState(false)
  const [mccResult, setMccResult] = useState<MccLookupResult | null>(null)
  const [businessCategory, setBusinessCategory] = useState(venueType || '')
  const [showAdditionalCosts, setShowAdditionalCosts] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [selectedStructure, setSelectedStructure] = useState<ProviderCostStructure | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    creditRate: '',
    debitRate: '',
    amexRate: '',
    internationalRate: '',
    fixedCostPerTransaction: '',
    monthlyFee: '',
    notes: '',
  })

  // Fetch ALL cost structures for this merchant account (for history)
  const {
    data: allCostStructures = [],
    isLoading: loadingCostStructure,
    refetch,
  } = useQuery({
    queryKey: ['cost-structures-all', account?.id],
    queryFn: () => paymentProviderAPI.getProviderCostStructuresByMerchantAccount(account!.id),
    enabled: open && !!account,
  })

  // The TRULY active structure is: active=true AND no effectiveTo date
  // If multiple have active=true, the one without effectiveTo is the real one
  const activeCostStructure =
    allCostStructures.find(s => s.active && !s.effectiveTo) ||
    allCostStructures.find(s => !s.effectiveTo) || // Fallback: any without end date
    allCostStructures[0] ||
    null

  // Helper to check if a structure is the truly active one
  const isTrulyActive = (structure: ProviderCostStructure) => structure.id === activeCostStructure?.id

  // Reset state when dialog opens/closes or account changes
  useEffect(() => {
    if (open && account) {
      setMode('view')
      setMccResult(null)
      setBusinessCategory(venueType || '')
      setShowAdditionalCosts(false)
      setSelectedStructure(null)
      setFormData({
        creditRate: '',
        debitRate: '',
        amexRate: '',
        internationalRate: '',
        fixedCostPerTransaction: '',
        monthlyFee: '',
        notes: '',
      })
    }
  }, [open, account, venueType])

  // Populate form when editing existing structure
  useEffect(() => {
    if (mode === 'edit' && selectedStructure) {
      setFormData({
        creditRate: (Number(selectedStructure.creditRate) * 100).toFixed(2),
        debitRate: (Number(selectedStructure.debitRate) * 100).toFixed(2),
        amexRate: (Number(selectedStructure.amexRate) * 100).toFixed(2),
        internationalRate: (Number(selectedStructure.internationalRate) * 100).toFixed(2),
        fixedCostPerTransaction: selectedStructure.fixedCostPerTransaction?.toString() || '',
        monthlyFee: selectedStructure.monthlyFee?.toString() || '',
        notes: selectedStructure.notes || '',
      })
      setShowAdditionalCosts(!!selectedStructure.fixedCostPerTransaction || !!selectedStructure.monthlyFee)
    }
  }, [mode, selectedStructure])

  if (!account) return null

  const handleDetectRates = async () => {
    if (!businessCategory.trim()) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Ingresa una categoría de negocio para detectar tasas',
      })
      return
    }

    setIsDetecting(true)
    try {
      const result = await paymentProviderAPI.getMccRateSuggestion(businessCategory)
      setMccResult(result)

      if (result.found && result.rates) {
        setFormData({
          creditRate: result.rates.credito.toFixed(2),
          debitRate: result.rates.debito.toFixed(2),
          amexRate: result.rates.amex.toFixed(2),
          internationalRate: result.rates.internacional.toFixed(2),
          fixedCostPerTransaction: '',
          monthlyFee: '',
          notes: `Auto-detectado: ${result.familia} (MCC ${result.mcc})`,
        })
        setMode('create')
        toast({
          title: 'Tasas detectadas',
          description: `Familia: ${result.familia} (MCC ${result.mcc}) - Confianza: ${result.confidence}%`,
        })
      } else {
        toast({
          variant: 'destructive',
          title: 'No encontrado',
          description: 'No se encontraron tasas para esta categoría. Puedes configurar manualmente.',
        })
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudieron detectar las tasas',
      })
    } finally {
      setIsDetecting(false)
    }
  }

  const handleManualCreate = () => {
    setMode('create')
    setFormData({
      creditRate: '2.30',
      debitRate: '1.68',
      amexRate: '3.00',
      internationalRate: '3.30',
      fixedCostPerTransaction: '',
      monthlyFee: '',
      notes: '',
    })
  }

  const handleSubmit = async () => {
    // Validate rates
    const creditRate = parseFloat(formData.creditRate)
    const debitRate = parseFloat(formData.debitRate)
    const amexRate = parseFloat(formData.amexRate)
    const internationalRate = parseFloat(formData.internationalRate)

    if (isNaN(creditRate) || isNaN(debitRate) || isNaN(amexRate) || isNaN(internationalRate)) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Todas las tasas principales son requeridas',
      })
      return
    }

    setIsSubmitting(true)
    try {
      if (mode === 'edit' && selectedStructure) {
        // Update existing structure
        await paymentProviderAPI.updateProviderCostStructure(selectedStructure.id, {
          creditRate: creditRate / 100,
          debitRate: debitRate / 100,
          amexRate: amexRate / 100,
          internationalRate: internationalRate / 100,
          fixedCostPerTransaction: formData.fixedCostPerTransaction
            ? parseFloat(formData.fixedCostPerTransaction)
            : null,
          monthlyFee: formData.monthlyFee ? parseFloat(formData.monthlyFee) : null,
          notes: formData.notes || null,
        })
        toast({
          title: 'Estructura actualizada',
          description: 'La estructura de costos ha sido actualizada exitosamente',
        })
      } else {
        // Create new structure
        await paymentProviderAPI.createProviderCostStructure({
          merchantAccountId: account.id,
          effectiveFrom: new Date().toISOString(),
          creditRate: creditRate / 100,
          debitRate: debitRate / 100,
          amexRate: amexRate / 100,
          internationalRate: internationalRate / 100,
          fixedCostPerTransaction: formData.fixedCostPerTransaction
            ? parseFloat(formData.fixedCostPerTransaction)
            : undefined,
          monthlyFee: formData.monthlyFee ? parseFloat(formData.monthlyFee) : undefined,
          notes: formData.notes || undefined,
        })
        toast({
          title: 'Estructura creada',
          description: 'La estructura de costos ha sido creada exitosamente',
        })
      }

      // Refresh data
      refetch()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts-all'] })
      setMode('view')
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.response?.data?.message || 'No se pudo guardar la estructura de costos',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] bg-background">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
              <Calculator className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <DialogTitle>Estructura de Costos</DialogTitle>
              <DialogDescription>
                {account.displayName || account.alias || account.externalMerchantId}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4 space-y-4">
          {loadingCostStructure ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Cargando estructura...</span>
            </div>
          ) : mode === 'view' ? (
            // VIEW MODE
            activeCostStructure ? (
              // Has existing structure
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800">
                  <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <p className="font-medium">Estructura activa</p>
                    <p className="text-xs mt-1">
                      Desde: {new Date(activeCostStructure.effectiveFrom).toLocaleDateString()}
                    </p>
                  </div>
                </div>

                <GlassCard className="p-4">
                  <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                    <Percent className="w-4 h-4 text-muted-foreground" />
                    Tasas de Procesamiento
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Crédito</p>
                      <p className="text-lg font-semibold">
                        {(Number(activeCostStructure.creditRate) * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Débito</p>
                      <p className="text-lg font-semibold">
                        {(Number(activeCostStructure.debitRate) * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Amex</p>
                      <p className="text-lg font-semibold">
                        {(Number(activeCostStructure.amexRate) * 100).toFixed(2)}%
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-muted/50">
                      <p className="text-xs text-muted-foreground">Internacional</p>
                      <p className="text-lg font-semibold">
                        {(Number(activeCostStructure.internationalRate) * 100).toFixed(2)}%
                      </p>
                    </div>
                  </div>

                  {(activeCostStructure.fixedCostPerTransaction || activeCostStructure.monthlyFee) && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <h4 className="text-sm font-medium mb-2">Costos Adicionales</h4>
                      <div className="flex gap-4 text-sm">
                        {activeCostStructure.fixedCostPerTransaction && (
                          <div>
                            <span className="text-muted-foreground">Costo fijo/tx:</span>{' '}
                            <span className="font-medium">
                              ${Number(activeCostStructure.fixedCostPerTransaction).toFixed(2)}
                            </span>
                          </div>
                        )}
                        {activeCostStructure.monthlyFee && (
                          <div>
                            <span className="text-muted-foreground">Cuota mensual:</span>{' '}
                            <span className="font-medium">
                              ${Number(activeCostStructure.monthlyFee).toFixed(2)}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {activeCostStructure.notes && (
                    <div className="mt-4 pt-4 border-t border-border/50">
                      <p className="text-xs text-muted-foreground">{activeCostStructure.notes}</p>
                    </div>
                  )}
                </GlassCard>

                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedStructure(activeCostStructure)
                    setMode('edit')
                  }}
                  className="w-full"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Editar Estructura Activa
                </Button>

                {/* History section - show all structures */}
                {allCostStructures.length > 1 && (
                  <Collapsible>
                    <CollapsibleTrigger asChild>
                      <Button variant="ghost" className="w-full justify-between">
                        <span className="text-sm">Ver historial ({allCostStructures.length} estructuras)</span>
                        <ChevronRight className="w-4 h-4 transition-transform ui-expanded:rotate-90" />
                      </Button>
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-2 space-y-2">
                      {allCostStructures.map((structure, index) => (
                        <div
                          key={structure.id}
                          className={cn(
                            'flex items-center justify-between p-3 rounded-lg border',
                            isTrulyActive(structure)
                              ? 'border-green-500/50 bg-green-50/50 dark:bg-green-950/20'
                              : 'border-border/50 bg-muted/30'
                          )}
                        >
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">
                                {isTrulyActive(structure)
                                  ? '✓ Activa'
                                  : `#${allCostStructures.length - index}`}
                              </span>
                              {isTrulyActive(structure) && (
                                <Badge
                                  variant="outline"
                                  className="text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300"
                                >
                                  Actual
                                </Badge>
                              )}
                              {structure.effectiveTo && (
                                <Badge variant="secondary" className="text-xs">
                                  Histórica
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1">
                              Desde: {new Date(structure.effectiveFrom).toLocaleDateString()}
                              {structure.effectiveTo &&
                                ` • Hasta: ${new Date(structure.effectiveTo).toLocaleDateString()}`}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Crédito: {(Number(structure.creditRate) * 100).toFixed(2)}% | Débito:{' '}
                              {(Number(structure.debitRate) * 100).toFixed(2)}%
                            </p>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setSelectedStructure(structure)
                              setMode('edit')
                            }}
                          >
                            <Pencil className="w-3 h-3" />
                          </Button>
                        </div>
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}
              </div>
            ) : (
              // No existing structure
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800">
                  <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-yellow-700 dark:text-yellow-300">
                    <p className="font-medium">Sin estructura de costos</p>
                    <p className="text-xs mt-1">
                      Esta cuenta no tiene tasas configuradas. Sin esto, no se puede calcular el margen de
                      ganancia.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label className="text-sm">Categoría del negocio</Label>
                    <div className="flex gap-2">
                      <Input
                        value={businessCategory}
                        onChange={e => setBusinessCategory(e.target.value)}
                        placeholder="Ej: Restaurante, Gimnasio, Tienda..."
                        className="flex-1"
                      />
                      <Button
                        onClick={handleDetectRates}
                        disabled={isDetecting || !businessCategory.trim()}
                        className="shrink-0"
                      >
                        {isDetecting ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <RefreshCw className="w-4 h-4 mr-2" />
                        )}
                        Detectar
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Ingresa el tipo de negocio para detectar automáticamente las tasas según el MCC de
                      Blumon
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="h-px flex-1 bg-border" />
                    <span className="text-xs text-muted-foreground px-2">o</span>
                    <div className="h-px flex-1 bg-border" />
                  </div>

                  <Button variant="outline" onClick={handleManualCreate} className="w-full">
                    <Pencil className="w-4 h-4 mr-2" />
                    Configurar Manualmente
                  </Button>
                </div>
              </div>
            )
          ) : (
            // CREATE/EDIT MODE
            <div className="space-y-4">
              {mccResult && mccResult.found && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800">
                  <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-700 dark:text-blue-300">
                    <p className="font-medium">Tasas detectadas: {mccResult.familia}</p>
                    <p>
                      MCC {mccResult.mcc} • Confianza: {mccResult.confidence}%
                    </p>
                  </div>
                </div>
              )}

              <GlassCard className="p-4">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <Percent className="w-4 h-4 text-muted-foreground" />
                  Tasas de Procesamiento
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">Crédito (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.creditRate}
                      onChange={e => setFormData({ ...formData, creditRate: e.target.value })}
                      placeholder="2.30"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Débito (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.debitRate}
                      onChange={e => setFormData({ ...formData, debitRate: e.target.value })}
                      placeholder="1.68"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Amex (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.amexRate}
                      onChange={e => setFormData({ ...formData, amexRate: e.target.value })}
                      placeholder="3.00"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">Internacional (%)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={formData.internationalRate}
                      onChange={e => setFormData({ ...formData, internationalRate: e.target.value })}
                      placeholder="3.30"
                    />
                  </div>
                </div>
              </GlassCard>

              <Collapsible open={showAdditionalCosts} onOpenChange={setShowAdditionalCosts}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between h-auto py-2">
                    <span className="flex items-center gap-2 text-sm">
                      <DollarSign className="w-4 h-4" />
                      Costos adicionales (opcional)
                    </span>
                    <ChevronRight className={cn('w-4 h-4 transition-transform', showAdditionalCosts && 'rotate-90')} />
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <GlassCard className="p-4 mt-2">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <Label className="text-xs">Costo fijo/transacción ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.fixedCostPerTransaction}
                          onChange={e =>
                            setFormData({ ...formData, fixedCostPerTransaction: e.target.value })
                          }
                          placeholder="0.00"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs">Cuota mensual ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={formData.monthlyFee}
                          onChange={e => setFormData({ ...formData, monthlyFee: e.target.value })}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                    <div className="mt-3 space-y-1.5">
                      <Label className="text-xs">Notas</Label>
                      <Textarea
                        value={formData.notes}
                        onChange={e => setFormData({ ...formData, notes: e.target.value })}
                        placeholder="Notas adicionales..."
                        rows={2}
                      />
                    </div>
                  </GlassCard>
                </CollapsibleContent>
              </Collapsible>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setMode('view')} className="flex-1" disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button
                  onClick={handleSubmit}
                  className="flex-1 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  disabled={isSubmitting}
                >
                  {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  {mode === 'edit' ? 'Guardar Cambios' : 'Crear Estructura'}
                </Button>
              </div>
            </div>
          )}
        </div>

        {mode === 'view' && (
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  )
}
