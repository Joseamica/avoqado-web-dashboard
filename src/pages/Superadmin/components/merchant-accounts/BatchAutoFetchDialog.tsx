import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { paymentProviderAPI } from '@/services/paymentProvider.service'
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock,
  HelpCircle,
  Layers,
  Loader2,
  Plus,
  Trash2,
  XCircle,
  Zap,
} from 'lucide-react'
import React, { useState } from 'react'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface TerminalEntry {
  id: string
  serialNumber: string
  brand: string
  model: string
}

interface BatchResult {
  serialNumber: string
  success: boolean
  accountId?: string
  displayName?: string | null
  posId?: string | null
  terminalsAttached?: number
  settlementConfigsCreated?: number
  alreadyExists?: boolean
  error?: string
}

interface BatchAutoFetchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

// Default settlement days
const DEFAULT_SETTLEMENT_DAYS = {
  DEBIT: 1,
  CREDIT: 2,
  AMEX: 3,
  INTERNATIONAL: 3,
  OTHER: 2,
}

export const BatchAutoFetchDialog: React.FC<BatchAutoFetchDialogProps> = ({ open, onOpenChange, onSuccess }) => {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [step, setStep] = useState<'input' | 'results'>('input')
  const [results, setResults] = useState<{
    total: number
    successful: number
    failed: number
    alreadyExisted: number
    results: BatchResult[]
  } | null>(null)

  // Form state
  const [terminals, setTerminals] = useState<TerminalEntry[]>([
    { id: crypto.randomUUID(), serialNumber: '', brand: 'PAX', model: 'A910S' },
  ])
  const [environment, setEnvironment] = useState<'SANDBOX' | 'PRODUCTION'>('SANDBOX')
  const [displayNamePrefix, setDisplayNamePrefix] = useState('')
  const [bulkInput, setBulkInput] = useState('')
  const [showBulkInput, setShowBulkInput] = useState(false)

  // Settlement config state
  const [settlementOpen, setSettlementOpen] = useState(false)
  const [createSettlement, setCreateSettlement] = useState(true)
  const [settlementConfig, setSettlementConfig] = useState({
    dayType: 'BUSINESS_DAYS' as 'BUSINESS_DAYS' | 'CALENDAR_DAYS',
    cutoffTime: '23:00',
    debitDays: DEFAULT_SETTLEMENT_DAYS.DEBIT,
    creditDays: DEFAULT_SETTLEMENT_DAYS.CREDIT,
    amexDays: DEFAULT_SETTLEMENT_DAYS.AMEX,
    internationalDays: DEFAULT_SETTLEMENT_DAYS.INTERNATIONAL,
    otherDays: DEFAULT_SETTLEMENT_DAYS.OTHER,
  })

  const resetDialog = () => {
    setStep('input')
    setResults(null)
    setTerminals([{ id: crypto.randomUUID(), serialNumber: '', brand: 'PAX', model: 'A910S' }])
    setEnvironment('SANDBOX')
    setDisplayNamePrefix('')
    setBulkInput('')
    setShowBulkInput(false)
    setSettlementOpen(false)
    setCreateSettlement(true)
    setSettlementConfig({
      dayType: 'BUSINESS_DAYS',
      cutoffTime: '23:00',
      debitDays: DEFAULT_SETTLEMENT_DAYS.DEBIT,
      creditDays: DEFAULT_SETTLEMENT_DAYS.CREDIT,
      amexDays: DEFAULT_SETTLEMENT_DAYS.AMEX,
      internationalDays: DEFAULT_SETTLEMENT_DAYS.INTERNATIONAL,
      otherDays: DEFAULT_SETTLEMENT_DAYS.OTHER,
    })
  }

  const handleClose = () => {
    onOpenChange(false)
    setTimeout(resetDialog, 300)
  }

  const addTerminal = () => {
    setTerminals([...terminals, { id: crypto.randomUUID(), serialNumber: '', brand: 'PAX', model: 'A910S' }])
  }

  const removeTerminal = (id: string) => {
    if (terminals.length > 1) {
      setTerminals(terminals.filter(t => t.id !== id))
    }
  }

  const updateTerminal = (id: string, field: keyof TerminalEntry, value: string) => {
    setTerminals(terminals.map(t => (t.id === id ? { ...t, [field]: value } : t)))
  }

  const parseBulkInput = () => {
    // Parse bulk input: one serial per line, optionally with brand/model comma-separated
    // Format: serial OR serial,brand,model
    const lines = bulkInput
      .split('\n')
      .map(l => l.trim())
      .filter(l => l.length > 0)
    const parsed: TerminalEntry[] = lines.map(line => {
      const parts = line.split(',').map(p => p.trim())
      return {
        id: crypto.randomUUID(),
        serialNumber: parts[0] || '',
        brand: parts[1] || 'PAX',
        model: parts[2] || 'A910S',
      }
    })
    if (parsed.length > 0) {
      setTerminals(parsed)
      setShowBulkInput(false)
      setBulkInput('')
    }
  }

  const handleSubmit = async () => {
    // Validate
    const validTerminals = terminals.filter(t => t.serialNumber.trim().length > 0)
    if (validTerminals.length === 0) {
      toast({
        title: 'Error',
        description: 'Agrega al menos un serial de terminal',
        variant: 'destructive',
      })
      return
    }

    if (validTerminals.length > 50) {
      toast({
        title: 'Error',
        description: 'Maximo 50 terminales por lote',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const result = await paymentProviderAPI.batchAutoFetchBlumonCredentials({
        terminals: validTerminals.map(t => ({
          serialNumber: t.serialNumber.trim(),
          brand: t.brand,
          model: t.model,
        })),
        environment,
        displayNamePrefix: displayNamePrefix.trim() || undefined,
        skipCostStructure: false,
        settlementConfig: createSettlement
          ? {
              enabled: true,
              dayType: settlementConfig.dayType,
              cutoffTime: settlementConfig.cutoffTime,
              cutoffTimezone: 'America/Mexico_City',
              debitDays: settlementConfig.debitDays,
              creditDays: settlementConfig.creditDays,
              amexDays: settlementConfig.amexDays,
              internationalDays: settlementConfig.internationalDays,
              otherDays: settlementConfig.otherDays,
            }
          : undefined,
      })

      setResults(result)
      setStep('results')

      if (result.successful > 0) {
        toast({
          title: 'Batch Auto-Fetch Completado',
          description: `${result.successful} exitosos, ${result.failed} fallidos, ${result.alreadyExisted} ya existian`,
        })
        onSuccess()
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Error al procesar el batch',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogTitle className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-gradient-to-r from-yellow-500/20 to-yellow-500/5">
            <Layers className="w-5 h-5 text-yellow-600" />
          </div>
          Blumon Batch Auto-Fetch
        </DialogTitle>
        <DialogDescription>
          Crea multiples MerchantAccounts en paralelo. Cada terminal obtiene credenciales unicas (OAuth + DUKPT).
        </DialogDescription>

        {step === 'input' && (
          <>
            {/* Environment Selection */}
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Ambiente</Label>
                  <Select value={environment} onValueChange={v => setEnvironment(v as 'SANDBOX' | 'PRODUCTION')}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SANDBOX">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-yellow-500" />
                          Sandbox (Pruebas)
                        </div>
                      </SelectItem>
                      <SelectItem value="PRODUCTION">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-green-500" />
                          Production (Real)
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label>Prefijo de Nombre</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger>
                          <HelpCircle className="w-3.5 h-3.5 text-muted-foreground cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Opcional. Las cuentas se nombraran "{displayNamePrefix || 'Prefijo'} 1", "{displayNamePrefix || 'Prefijo'} 2", etc.</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    value={displayNamePrefix}
                    onChange={e => setDisplayNamePrefix(e.target.value)}
                    placeholder="ej: Terminal Cancún"
                  />
                </div>
              </div>

              {/* Bulk Input Toggle */}
              <div className="flex items-center justify-between">
                <Label>Terminales ({terminals.filter(t => t.serialNumber.trim()).length})</Label>
                <Button variant="ghost" size="sm" onClick={() => setShowBulkInput(!showBulkInput)}>
                  {showBulkInput ? 'Modo Lista' : 'Importar Bulk'}
                </Button>
              </div>

              {showBulkInput ? (
                <div className="space-y-2">
                  <Textarea
                    value={bulkInput}
                    onChange={e => setBulkInput(e.target.value)}
                    placeholder={`Pega seriales, uno por linea:
2841548417
2841548418
2841548419

O con brand/model:
2841548417,PAX,A910S
2841548418,PAX,A920`}
                    className="min-h-[150px] font-mono text-sm"
                  />
                  <Button onClick={parseBulkInput} size="sm" variant="secondary" className="w-full">
                    <Zap className="w-4 h-4 mr-2" />
                    Parsear y Agregar
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 max-h-[200px] overflow-y-auto pr-2">
                  {terminals.map((terminal, index) => (
                    <div key={terminal.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 bg-muted/30">
                      <span className="text-xs text-muted-foreground w-6">{index + 1}.</span>
                      <Input
                        value={terminal.serialNumber}
                        onChange={e => updateTerminal(terminal.id, 'serialNumber', e.target.value)}
                        placeholder="Serial"
                        className="flex-1 h-8"
                      />
                      <Select value={terminal.brand} onValueChange={v => updateTerminal(terminal.id, 'brand', v)}>
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="PAX">PAX</SelectItem>
                          <SelectItem value="INGENICO">Ingenico</SelectItem>
                          <SelectItem value="VERIFONE">Verifone</SelectItem>
                        </SelectContent>
                      </Select>
                      <Select value={terminal.model} onValueChange={v => updateTerminal(terminal.id, 'model', v)}>
                        <SelectTrigger className="w-24 h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A910S">A910S</SelectItem>
                          <SelectItem value="A920">A920</SelectItem>
                          <SelectItem value="A930">A930</SelectItem>
                          <SelectItem value="A77">A77</SelectItem>
                          <SelectItem value="A80">A80</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => removeTerminal(terminal.id)}
                        disabled={terminals.length === 1}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  ))}
                  <Button variant="outline" size="sm" onClick={addTerminal} className="w-full">
                    <Plus className="w-4 h-4 mr-2" />
                    Agregar Terminal
                  </Button>
                </div>
              )}

              {/* Settlement Configuration - Collapsible */}
              <Collapsible open={settlementOpen} onOpenChange={setSettlementOpen}>
                <div className="rounded-xl border border-border/50 bg-card/80 backdrop-blur-sm">
                  <CollapsibleTrigger asChild>
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-xl">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                          <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <h3 className="font-medium text-sm">Plazos de Liquidación</h3>
                          <p className="text-xs text-muted-foreground">
                            {createSettlement ? 'Se crearán con valores configurados' : 'No se crearán automáticamente'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant={createSettlement ? 'default' : 'outline'} className="text-xs">
                          {createSettlement ? 'Activado' : 'Desactivado'}
                        </Badge>
                        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', settlementOpen && 'rotate-90')} />
                      </div>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <div className="px-4 pb-4 space-y-4">
                      <div className="h-px bg-border/50" />

                      {/* Enable/Disable Toggle */}
                      <div
                        className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-muted/30 cursor-pointer hover:bg-muted/50"
                        onClick={() => setCreateSettlement(!createSettlement)}
                      >
                        <Checkbox
                          checked={createSettlement}
                          onClick={e => e.stopPropagation()}
                          className="cursor-pointer"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-medium">Crear configuraciones de liquidación</p>
                          <p className="text-xs text-muted-foreground">
                            Se aplicarán los mismos plazos a todas las cuentas creadas
                          </p>
                        </div>
                      </div>

                      {createSettlement && (
                        <>
                          {/* Day Type and Cutoff */}
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <Label className="text-xs">Tipo de Días</Label>
                              <Select
                                value={settlementConfig.dayType}
                                onValueChange={v => setSettlementConfig({ ...settlementConfig, dayType: v as any })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="BUSINESS_DAYS">Días Hábiles</SelectItem>
                                  <SelectItem value="CALENDAR_DAYS">Días Naturales</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <Label className="text-xs">Hora de Corte</Label>
                              <Select
                                value={settlementConfig.cutoffTime}
                                onValueChange={v => setSettlementConfig({ ...settlementConfig, cutoffTime: v })}
                              >
                                <SelectTrigger className="h-9">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="18:00">18:00</SelectItem>
                                  <SelectItem value="20:00">20:00</SelectItem>
                                  <SelectItem value="21:00">21:00</SelectItem>
                                  <SelectItem value="22:00">22:00</SelectItem>
                                  <SelectItem value="23:00">23:00</SelectItem>
                                  <SelectItem value="23:59">23:59</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>

                          {/* Settlement Days per Card Type */}
                          <div className="space-y-2">
                            <Label className="text-xs">Días por Tipo de Tarjeta</Label>
                            <div className="grid grid-cols-5 gap-2">
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Débito</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={30}
                                  value={settlementConfig.debitDays}
                                  onChange={e => setSettlementConfig({ ...settlementConfig, debitDays: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Crédito</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={30}
                                  value={settlementConfig.creditDays}
                                  onChange={e => setSettlementConfig({ ...settlementConfig, creditDays: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">AMEX</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={30}
                                  value={settlementConfig.amexDays}
                                  onChange={e => setSettlementConfig({ ...settlementConfig, amexDays: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Int'l</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={30}
                                  value={settlementConfig.internationalDays}
                                  onChange={e => setSettlementConfig({ ...settlementConfig, internationalDays: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-center"
                                />
                              </div>
                              <div className="space-y-1">
                                <Label className="text-[10px] text-muted-foreground">Otros</Label>
                                <Input
                                  type="number"
                                  min={0}
                                  max={30}
                                  value={settlementConfig.otherDays}
                                  onChange={e => setSettlementConfig({ ...settlementConfig, otherDays: parseInt(e.target.value) || 0 })}
                                  className="h-8 text-center"
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={handleClose}>
                Cancelar
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={loading || terminals.filter(t => t.serialNumber.trim()).length === 0}
                className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Procesando {terminals.filter(t => t.serialNumber.trim()).length} terminales...
                  </>
                ) : (
                  <>
                    <Zap className="w-4 h-4 mr-2" />
                    Iniciar Batch Auto-Fetch
                  </>
                )}
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'results' && results && (
          <>
            {/* Summary */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{results.total}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              <div className="p-3 rounded-lg bg-green-500/10 text-center">
                <p className="text-2xl font-bold text-green-600">{results.successful}</p>
                <p className="text-xs text-muted-foreground">Exitosos</p>
              </div>
              <div className="p-3 rounded-lg bg-red-500/10 text-center">
                <p className="text-2xl font-bold text-red-600">{results.failed}</p>
                <p className="text-xs text-muted-foreground">Fallidos</p>
              </div>
              <div className="p-3 rounded-lg bg-blue-500/10 text-center">
                <p className="text-2xl font-bold text-blue-600">{results.alreadyExisted}</p>
                <p className="text-xs text-muted-foreground">Ya existian</p>
              </div>
            </div>

            {/* Results List */}
            <div className="space-y-2 max-h-[350px] overflow-y-auto mt-4">
              {results.results.map((result, index) => (
                <div
                  key={index}
                  className={cn(
                    'p-3 rounded-lg border',
                    result.success && !result.alreadyExists && 'border-green-500/30 bg-green-500/5',
                    result.success && result.alreadyExists && 'border-blue-500/30 bg-blue-500/5',
                    !result.success && 'border-red-500/30 bg-red-500/5',
                  )}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      {result.success && !result.alreadyExists && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                      {result.success && result.alreadyExists && <AlertCircle className="w-4 h-4 text-blue-600" />}
                      {!result.success && <XCircle className="w-4 h-4 text-red-600" />}
                      <span className="font-mono text-sm">{result.serialNumber}</span>
                    </div>
                    {result.success && (
                      <Badge variant="outline" className={cn(result.alreadyExists ? 'text-blue-600' : 'text-green-600')}>
                        {result.alreadyExists ? 'Ya existia' : 'Creado'}
                      </Badge>
                    )}
                    {!result.success && <Badge variant="destructive">Error</Badge>}
                  </div>
                  {result.success && (
                    <div className="mt-2 text-xs text-muted-foreground space-y-1">
                      <p>
                        <span className="font-medium">Nombre:</span> {result.displayName || 'N/A'}
                      </p>
                      <p>
                        <span className="font-medium">POS ID:</span> {result.posId || 'N/A'}
                      </p>
                      {result.terminalsAttached !== undefined && result.terminalsAttached > 0 && (
                        <p className="text-green-600">
                          <span className="font-medium">Auto-attached:</span> {result.terminalsAttached} terminal(es)
                        </p>
                      )}
                      {result.settlementConfigsCreated !== undefined && result.settlementConfigsCreated > 0 && (
                        <p className="text-blue-600">
                          <span className="font-medium">Settlement configs:</span> {result.settlementConfigsCreated} creados
                        </p>
                      )}
                    </div>
                  )}
                  {!result.success && <p className="mt-2 text-xs text-red-600">{result.error}</p>}
                </div>
              ))}
            </div>

            <DialogFooter className="mt-6">
              <Button variant="outline" onClick={resetDialog}>
                Procesar Otro Lote
              </Button>
              <Button onClick={handleClose}>Cerrar</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
