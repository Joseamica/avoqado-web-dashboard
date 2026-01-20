import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Code2,
  FileJson,
  HelpCircle,
  Layers,
  Lightbulb,
  Package,
  Plus,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import React, { useState } from 'react'

// ============================================
// Types
// ============================================

interface ConfigField {
  id: string
  key: string
  type: 'string' | 'number' | 'boolean' | 'select' | 'json'
  label: string
  defaultValue: string | number | boolean
  options?: string[] // For select type
  description?: string
}

interface Preset {
  id: string
  name: string
  description: string
  overrides: Record<string, any>
}

interface WizardData {
  code: string
  name: string
  description: string
  configFields: ConfigField[]
  presets: Preset[]
}

interface ModuleCreationWizardProps {
  onComplete: (data: {
    code: string
    name: string
    description?: string
    defaultConfig: Record<string, any>
    presets: Record<string, Record<string, any>>
  }) => void
  onCancel: () => void
  isSubmitting?: boolean
}

// ============================================
// Helper Components
// ============================================

const ExampleCard: React.FC<{ title: string; examples: string[] }> = ({ title, examples }) => (
  <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
    <div className="flex items-center gap-2 mb-2">
      <Lightbulb className="w-4 h-4 text-blue-500" />
      <span className="text-xs font-medium text-blue-600 dark:text-blue-400">{title}</span>
    </div>
    <ul className="text-xs text-muted-foreground space-y-1">
      {examples.map((ex, i) => (
        <li key={i}>• {ex}</li>
      ))}
    </ul>
  </div>
)

const HelpText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex items-start gap-2 p-3 rounded-lg bg-muted/50 text-sm text-muted-foreground">
    <HelpCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
    <div>{children}</div>
  </div>
)

// ============================================
// Step Components
// ============================================

const StepIndicator: React.FC<{ currentStep: number; totalSteps: number; stepTitles: string[] }> = ({
  currentStep,
  totalSteps,
  stepTitles,
}) => {
  return (
    <div className="flex items-center justify-between mb-8">
      {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step, index) => (
        <React.Fragment key={step}>
          <div className="flex flex-col items-center">
            <div
              className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                step < currentStep && 'bg-green-500 text-primary-foreground',
                step === currentStep && 'bg-gradient-to-r from-amber-400 to-pink-500 text-primary-foreground',
                step > currentStep && 'bg-muted text-muted-foreground'
              )}
            >
              {step < currentStep ? <Check className="w-5 h-5" /> : step}
            </div>
            <span className={cn(
              'text-xs mt-2 text-center max-w-[80px]',
              step === currentStep ? 'text-foreground font-medium' : 'text-muted-foreground'
            )}>
              {stepTitles[index]}
            </span>
          </div>
          {index < totalSteps - 1 && (
            <div
              className={cn(
                'flex-1 h-1 mx-2 rounded',
                step < currentStep ? 'bg-green-500' : 'bg-muted'
              )}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  )
}

// Step 1: Basic Info
const Step1BasicInfo: React.FC<{
  data: WizardData
  onChange: (data: Partial<WizardData>) => void
}> = ({ data, onChange }) => {

  const handleCodeChange = (value: string) => {
    // Auto-format to UPPERCASE_SNAKE_CASE
    const formatted = value.toUpperCase().replace(/[^A-Z0-9_]/g, '_').replace(/_+/g, '_')
    onChange({ code: formatted })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
          <Package className="w-6 h-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Paso 1: Información Básica</h3>
          <p className="text-sm text-muted-foreground">Define qué es este módulo y cómo se identificará en el sistema</p>
        </div>
      </div>

      <HelpText>
        Un <strong>módulo</strong> es una funcionalidad extra que los venues pueden activar.
        Por ejemplo: "Programa de Lealtad", "Reservaciones", "Inventario Serializado".
        Cada venue decide si lo quiere usar o no.
      </HelpText>

      <div className="grid gap-6">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="module-code">Código del Módulo</Label>
            <Input
              id="module-code"
              value={data.code}
              onChange={(e) => handleCodeChange(e.target.value)}
              placeholder="LOYALTY_PROGRAM"
              className="font-mono"
            />
            <p className="text-xs text-muted-foreground">
              Identificador único para el código. Se convierte automáticamente a MAYÚSCULAS_CON_GUIONES.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="module-name">Nombre para mostrar</Label>
            <Input
              id="module-name"
              value={data.name}
              onChange={(e) => onChange({ name: e.target.value })}
              placeholder="Programa de Lealtad"
            />
            <p className="text-xs text-muted-foreground">
              El nombre que verán los admins en el dashboard.
            </p>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="module-description">Descripción</Label>
          <Textarea
            id="module-description"
            value={data.description}
            onChange={(e) => onChange({ description: e.target.value })}
            placeholder="Sistema de puntos y recompensas para clientes frecuentes. Acumulan puntos por cada compra y pueden canjearlos por descuentos."
            rows={3}
          />
          <p className="text-xs text-muted-foreground">
            Explica qué hace el módulo para que los admins sepan si les sirve.
          </p>
        </div>

        <ExampleCard
          title="Ejemplos de módulos"
          examples={[
            "LOYALTY_PROGRAM → Programa de Lealtad",
            "RESERVATIONS → Sistema de Reservaciones",
            "SERIALIZED_INVENTORY → Inventario con Números de Serie",
            "AI_CHATBOT → Asistente Virtual con IA",
            "KITCHEN_DISPLAY → Pantalla de Cocina"
          ]}
        />

        {/* Preview */}
        {data.code && data.name && (
          <Card className="bg-muted/50 border-green-500/30">
            <CardContent className="pt-4">
              <p className="text-xs text-green-600 dark:text-green-400 mb-2 font-medium">✓ Vista previa de tu módulo:</p>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-background">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <p className="font-medium">{data.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{data.code}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

// Step 2: Config Builder
const Step2ConfigBuilder: React.FC<{
  data: WizardData
  onChange: (data: Partial<WizardData>) => void
}> = ({ data, onChange }) => {

  const addField = () => {
    const newField: ConfigField = {
      id: `field_${Date.now()}`,
      key: '',
      type: 'string',
      label: '',
      defaultValue: '',
    }
    onChange({ configFields: [...data.configFields, newField] })
  }

  const updateField = (id: string, updates: Partial<ConfigField>) => {
    onChange({
      configFields: data.configFields.map((f) =>
        f.id === id ? { ...f, ...updates } : f
      ),
    })
  }

  const removeField = (id: string) => {
    onChange({ configFields: data.configFields.filter((f) => f.id !== id) })
  }

  const getDefaultForType = (type: ConfigField['type']): string | number | boolean => {
    switch (type) {
      case 'boolean': return false
      case 'number': return 0
      case 'json': return '{}'
      default: return ''
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
            <Settings className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Paso 2: Configuración del Módulo</h3>
            <p className="text-sm text-muted-foreground">Define qué opciones pueden personalizar los venues</p>
          </div>
        </div>
        <Button onClick={addField} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Opción
        </Button>
      </div>

      <HelpText>
        Aquí defines las <strong>opciones configurables</strong> de tu módulo.
        Es como crear un formulario de ajustes. Cada opción tiene:
        <ul className="mt-2 ml-4 space-y-1">
          <li>• <strong>Clave:</strong> El nombre técnico (ej: <code className="bg-muted px-1 rounded">pointsPerPeso</code>)</li>
          <li>• <strong>Tipo:</strong> Qué tipo de dato es (número, texto, sí/no)</li>
          <li>• <strong>Valor por defecto:</strong> El valor inicial cuando activan el módulo</li>
        </ul>
      </HelpText>

      {data.configFields.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Settings className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">Sin opciones de configuración</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Si tu módulo no necesita configuración, puedes saltar este paso.
              Si sí la necesita, agrega las opciones que los venues podrán personalizar.
            </p>
            <Button onClick={addField} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Agregar Primera Opción
            </Button>

            <div className="mt-6 pt-6 border-t">
              <ExampleCard
                title="Ejemplos para un módulo de Lealtad"
                examples={[
                  "pointsPerPeso (Number) = 1 → Cuántos puntos ganan por peso",
                  "minimumToRedeem (Number) = 100 → Mínimo de puntos para canjear",
                  "expirationDays (Number) = 365 → Días hasta que expiren los puntos",
                  "showPointsInReceipt (Boolean) = true → Mostrar puntos en el ticket"
                ]}
              />
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.configFields.map((field, index) => (
            <Card key={field.id} className="relative">
              <CardContent className="pt-4">
                <div className="absolute top-2 right-2 flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    Opción {index + 1}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => removeField(field.id)}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>

                <div className="grid grid-cols-12 gap-4">
                  {/* Key */}
                  <div className="col-span-3 space-y-2">
                    <Label className="text-xs">Clave (para el código)</Label>
                    <Input
                      value={field.key}
                      onChange={(e) => updateField(field.id, { key: e.target.value.replace(/[^a-zA-Z0-9_]/g, '') })}
                      placeholder="pointsPerPeso"
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      camelCase, sin espacios
                    </p>
                  </div>

                  {/* Type */}
                  <div className="col-span-2 space-y-2">
                    <Label className="text-xs">Tipo de dato</Label>
                    <Select
                      value={field.type}
                      onValueChange={(value: ConfigField['type']) => {
                        updateField(field.id, {
                          type: value,
                          defaultValue: getDefaultForType(value),
                          options: value === 'select' ? ['opcion1', 'opcion2'] : undefined,
                        })
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="string">Texto</SelectItem>
                        <SelectItem value="number">Número</SelectItem>
                        <SelectItem value="boolean">Sí/No</SelectItem>
                        <SelectItem value="select">Opciones</SelectItem>
                        <SelectItem value="json">JSON</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Default Value */}
                  <div className="col-span-7 space-y-2">
                    <Label className="text-xs">Valor por defecto</Label>
                    {field.type === 'boolean' ? (
                      <div className="flex items-center h-10 gap-3">
                        <Switch
                          checked={field.defaultValue as boolean}
                          onCheckedChange={(checked) => updateField(field.id, { defaultValue: checked })}
                        />
                        <span className="text-sm text-muted-foreground">
                          {field.defaultValue ? '✓ Activado por defecto' : '✗ Desactivado por defecto'}
                        </span>
                      </div>
                    ) : field.type === 'number' ? (
                      <Input
                        type="number"
                        value={field.defaultValue as number}
                        onChange={(e) => updateField(field.id, { defaultValue: Number(e.target.value) })}
                        placeholder="0"
                      />
                    ) : field.type === 'select' ? (
                      <div className="space-y-2">
                        <Input
                          value={(field.options || []).join(', ')}
                          onChange={(e) => updateField(field.id, {
                            options: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="opcion1, opcion2, opcion3"
                        />
                        <p className="text-xs text-muted-foreground">
                          Lista de opciones separadas por coma. Ej: "bajo, medio, alto"
                        </p>
                      </div>
                    ) : field.type === 'json' ? (
                      <Textarea
                        value={field.defaultValue as string}
                        onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                        placeholder='{"key": "value"}'
                        className="font-mono text-sm"
                        rows={2}
                      />
                    ) : (
                      <Input
                        value={field.defaultValue as string}
                        onChange={(e) => updateField(field.id, { defaultValue: e.target.value })}
                        placeholder="valor por defecto"
                      />
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          <Button onClick={addField} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Otra Opción
          </Button>
        </div>
      )}
    </div>
  )
}

// Step 3: Presets Builder
const Step3PresetsBuilder: React.FC<{
  data: WizardData
  onChange: (data: Partial<WizardData>) => void
}> = ({ data, onChange }) => {

  const addPreset = () => {
    const newPreset: Preset = {
      id: `preset_${Date.now()}`,
      name: '',
      description: '',
      overrides: {},
    }
    onChange({ presets: [...data.presets, newPreset] })
  }

  const updatePreset = (id: string, updates: Partial<Preset>) => {
    onChange({
      presets: data.presets.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })
  }

  const removePreset = (id: string) => {
    onChange({ presets: data.presets.filter((p) => p.id !== id) })
  }

  const updatePresetOverride = (presetId: string, fieldKey: string, value: any) => {
    const preset = data.presets.find((p) => p.id === presetId)
    if (!preset) return

    const newOverrides = { ...preset.overrides }
    if (value === null || value === undefined || value === '') {
      delete newOverrides[fieldKey]
    } else {
      newOverrides[fieldKey] = value
    }

    updatePreset(presetId, { overrides: newOverrides })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
            <Layers className="w-6 h-6 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-lg font-semibold">Paso 3: Presets (Opcional)</h3>
            <p className="text-sm text-muted-foreground">Configuraciones predefinidas para distintos tipos de negocio</p>
          </div>
        </div>
        <Button onClick={addPreset} variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Agregar Preset
        </Button>
      </div>

      <HelpText>
        Los <strong>presets</strong> son configuraciones listas para usar según el tipo de negocio.
        <br /><br />
        <strong>Ejemplo:</strong> Para un módulo de inventario serializado:
        <ul className="mt-2 ml-4 space-y-1">
          <li>• Preset <code className="bg-muted px-1 rounded">telecom</code>: Para tiendas de celulares (IMEI obligatorio)</li>
          <li>• Preset <code className="bg-muted px-1 rounded">joyeria</code>: Para joyerías (número de serie opcional)</li>
          <li>• Preset <code className="bg-muted px-1 rounded">electronica</code>: Para electrónicos (con garantía)</li>
        </ul>
        <br />
        Cuando un venue activa el módulo, puede elegir un preset y la configuración se aplica automáticamente.
      </HelpText>

      {data.presets.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-8 text-center">
            <Layers className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="font-medium mb-2">Sin presets</h4>
            <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
              Los presets son opcionales. Si tu módulo funciona igual para todos los tipos de negocio,
              puedes saltar este paso.
            </p>
            <Button onClick={addPreset} variant="outline">
              <Plus className="w-4 h-4 mr-2" />
              Crear Primer Preset
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {data.presets.map((preset, index) => (
            <Card key={preset.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <Badge variant="outline">Preset {index + 1}</Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removePreset(preset.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-3">
                  <div>
                    <Label className="text-xs mb-1 block">Nombre del preset</Label>
                    <Input
                      value={preset.name}
                      onChange={(e) => updatePreset(preset.id, { name: e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '_') })}
                      placeholder="telecom"
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      minúsculas, sin espacios (ej: restaurante, retail, telecom)
                    </p>
                  </div>
                  <div>
                    <Label className="text-xs mb-1 block">Descripción</Label>
                    <Input
                      value={preset.description}
                      onChange={(e) => updatePreset(preset.id, { description: e.target.value })}
                      placeholder="Configuración optimizada para tiendas de telefonía"
                    />
                  </div>
                </div>
              </CardHeader>
              {data.configFields.length > 0 && (
                <CardContent className="pt-0">
                  <div className="border-t pt-4">
                    <Label className="text-xs text-muted-foreground mb-3 block">
                      Valores para este preset (modifica solo los que sean diferentes al default):
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      {data.configFields.map((field) => (
                        <div key={field.id} className="flex items-center gap-2 p-2 rounded bg-muted/30">
                          <span className="text-sm font-mono text-muted-foreground min-w-[120px]">
                            {field.key || '(sin clave)'}:
                          </span>
                          {field.type === 'boolean' ? (
                            <Switch
                              checked={preset.overrides[field.key] ?? (field.defaultValue as boolean)}
                              onCheckedChange={(checked) => updatePresetOverride(preset.id, field.key, checked)}
                            />
                          ) : field.type === 'number' ? (
                            <Input
                              type="number"
                              value={preset.overrides[field.key] ?? field.defaultValue}
                              onChange={(e) => updatePresetOverride(preset.id, field.key, Number(e.target.value))}
                              className="h-8 w-24"
                            />
                          ) : (
                            <Input
                              value={preset.overrides[field.key] ?? field.defaultValue}
                              onChange={(e) => updatePresetOverride(preset.id, field.key, e.target.value)}
                              className="h-8"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              )}
              {data.configFields.length === 0 && (
                <CardContent className="pt-0">
                  <p className="text-xs text-muted-foreground italic">
                    No hay opciones de configuración. Regresa al paso 2 para agregar opciones que este preset pueda modificar.
                  </p>
                </CardContent>
              )}
            </Card>
          ))}

          <Button onClick={addPreset} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Agregar Otro Preset
          </Button>
        </div>
      )}
    </div>
  )
}

// Step 4: Review & Create
const Step4Review: React.FC<{
  data: WizardData
  showJsonPreview: boolean
  setShowJsonPreview: (show: boolean) => void
}> = ({ data, showJsonPreview, setShowJsonPreview }) => {

  // Build the final JSON objects
  const defaultConfig: Record<string, any> = {}
  data.configFields.forEach((field) => {
    if (field.key) {
      if (field.type === 'json') {
        try {
          defaultConfig[field.key] = JSON.parse(field.defaultValue as string)
        } catch {
          defaultConfig[field.key] = {}
        }
      } else {
        defaultConfig[field.key] = field.defaultValue
      }
    }
  })

  const presets: Record<string, Record<string, any>> = {}
  data.presets.forEach((preset) => {
    if (preset.name) {
      presets[preset.name] = preset.overrides
    }
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-amber-500/20 to-pink-500/10">
          <Sparkles className="w-6 h-6 text-amber-600 dark:text-amber-400" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">Paso 4: Revisar y Crear</h3>
          <p className="text-sm text-muted-foreground">Verifica que todo esté correcto antes de crear el módulo</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Module Info */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="w-4 h-4" />
              Información del Módulo
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs text-muted-foreground">Nombre</Label>
              <p className="font-medium">{data.name || '(sin nombre)'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Código</Label>
              <p className="font-mono text-sm bg-muted px-2 py-1 rounded inline-block">{data.code || '(sin código)'}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Descripción</Label>
              <p className="text-sm text-muted-foreground">{data.description || '(sin descripción)'}</p>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Resumen
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{data.configFields.length}</p>
                <p className="text-xs text-muted-foreground">Opciones de config</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 text-center">
                <p className="text-2xl font-bold">{data.presets.length}</p>
                <p className="text-xs text-muted-foreground">Presets</p>
              </div>
            </div>

            {data.configFields.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Opciones definidas:</p>
                <div className="flex flex-wrap gap-1">
                  {data.configFields.map(f => (
                    <Badge key={f.id} variant="secondary" className="font-mono text-xs">
                      {f.key || '?'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {data.presets.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">Presets disponibles:</p>
                <div className="flex flex-wrap gap-1">
                  {data.presets.map(p => (
                    <Badge key={p.id} variant="outline" className="font-mono text-xs">
                      {p.name || '?'}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* JSON Preview - Collapsible */}
      <Collapsible open={showJsonPreview} onOpenChange={setShowJsonPreview}>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <CardTitle className="text-sm flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  Vista Previa del JSON
                  <Badge variant="outline" className="text-xs font-normal">
                    Avanzado
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Este es el JSON que se guardará en la base de datos. El código del módulo leerá estos valores.
                </CardDescription>
              </div>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  {showJsonPreview ? 'Ocultar' : 'Mostrar'}
                  <ChevronDown className={cn('w-4 h-4 transition-transform', showJsonPreview && 'rotate-180')} />
                </Button>
              </CollapsibleTrigger>
            </div>
          </CardHeader>
          <CollapsibleContent>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs mb-2 block flex items-center gap-2">
                    <span className="bg-purple-500/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded text-xs">defaultConfig</span>
                    <span className="text-muted-foreground">- Valores por defecto</span>
                  </Label>
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-auto max-h-48">
                    {JSON.stringify(defaultConfig, null, 2) || '{}'}
                  </pre>
                </div>
                <div>
                  <Label className="text-xs mb-2 block flex items-center gap-2">
                    <span className="bg-green-500/20 text-green-600 dark:text-green-400 px-2 py-0.5 rounded text-xs">presets</span>
                    <span className="text-muted-foreground">- Configuraciones rápidas</span>
                  </Label>
                  <pre className="p-3 rounded-lg bg-muted text-xs font-mono overflow-auto max-h-48">
                    {JSON.stringify(presets, null, 2) || '{}'}
                  </pre>
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      <HelpText>
        <strong>¿Qué sigue?</strong> Después de crear el módulo:
        <ol className="mt-2 ml-4 space-y-1 list-decimal">
          <li>El módulo aparecerá en la lista de módulos disponibles</li>
          <li>Podrás activarlo para venues específicos</li>
          <li>Cada venue que lo active recibirá una copia de la configuración</li>
          <li>El código del módulo leerá <code className="bg-muted px-1 rounded">config.nombreDeLaClave</code> para personalizar su comportamiento</li>
        </ol>
      </HelpText>
    </div>
  )
}

// ============================================
// Main Wizard Component
// ============================================

const ModuleCreationWizard: React.FC<ModuleCreationWizardProps> = ({
  onComplete,
  onCancel,
  isSubmitting = false,
}) => {
  const [currentStep, setCurrentStep] = useState(1)
  const [data, setData] = useState<WizardData>({
    code: '',
    name: '',
    description: '',
    configFields: [],
    presets: [],
  })
  const [showJsonPreview, setShowJsonPreview] = useState(false)

  const totalSteps = 4
  const stepTitles = ['Información', 'Configuración', 'Presets', 'Revisar']

  const updateData = (updates: Partial<WizardData>) => {
    setData((prev) => ({ ...prev, ...updates }))
  }

  const canProceed = () => {
    switch (currentStep) {
      case 1:
        return data.code.length >= 3 && data.name.length >= 2
      case 2:
        // Allow empty config (some modules don't need config)
        return data.configFields.every((f) => f.key)
      case 3:
        // Allow empty presets
        return data.presets.every((p) => p.name)
      case 4:
        return true
      default:
        return false
    }
  }

  const handleNext = () => {
    if (currentStep < totalSteps) {
      setCurrentStep((prev) => prev + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
    }
  }

  const handleSubmit = () => {
    // Build final data
    const defaultConfig: Record<string, any> = {}
    data.configFields.forEach((field) => {
      if (field.key) {
        if (field.type === 'json') {
          try {
            defaultConfig[field.key] = JSON.parse(field.defaultValue as string)
          } catch {
            defaultConfig[field.key] = {}
          }
        } else {
          defaultConfig[field.key] = field.defaultValue
        }
      }
    })

    const presets: Record<string, Record<string, any>> = {}
    data.presets.forEach((preset) => {
      if (preset.name) {
        presets[preset.name] = preset.overrides
      }
    })

    onComplete({
      code: data.code,
      name: data.name,
      description: data.description || undefined,
      defaultConfig,
      presets,
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
            <Code2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-xl font-bold">Crear Nuevo Módulo</h2>
            <p className="text-sm text-muted-foreground">Asistente interactivo para crear módulos paso a paso</p>
          </div>
        </div>
        <Badge variant="secondary" className="font-mono">
          v2 wizard
        </Badge>
      </div>

      {/* Step Indicator */}
      <StepIndicator
        currentStep={currentStep}
        totalSteps={totalSteps}
        stepTitles={stepTitles}
      />

      {/* Step Content */}
      <div className="min-h-[450px]">
        {currentStep === 1 && <Step1BasicInfo data={data} onChange={updateData} />}
        {currentStep === 2 && <Step2ConfigBuilder data={data} onChange={updateData} />}
        {currentStep === 3 && <Step3PresetsBuilder data={data} onChange={updateData} />}
        {currentStep === 4 && (
          <Step4Review
            data={data}
            showJsonPreview={showJsonPreview}
            setShowJsonPreview={setShowJsonPreview}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between pt-4 border-t">
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <Button variant="outline" onClick={handlePrev}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Anterior
            </Button>
          )}
          {currentStep < totalSteps ? (
            <Button onClick={handleNext} disabled={!canProceed()}>
              Siguiente
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600"
            >
              {isSubmitting ? (
                'Creando...'
              ) : (
                <>
                  <Check className="w-4 h-4 mr-2" />
                  Crear Módulo
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default ModuleCreationWizard
