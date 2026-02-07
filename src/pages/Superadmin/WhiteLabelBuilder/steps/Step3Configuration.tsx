/**
 * Step3Configuration - Per-feature configuration with permissions
 *
 * Sidebar + content panel layout:
 * - Left sidebar: clickable list of enabled features
 * - Right panel: selected feature's configuration and permissions (always visible)
 */

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FEATURE_CATEGORIES, FEATURE_REGISTRY } from '@/config/feature-registry'
import { cn } from '@/lib/utils'
import { StaffRole } from '@/types'
import type { DataScope, EnabledFeature, FeatureAccess, FeatureInstanceConfig } from '@/types/white-label'
import { AlertCircle, AlertTriangle, Info, Settings, Shield } from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ============================================
// Types
// ============================================

interface Step3ConfigurationProps {
  enabledFeatures: EnabledFeature[]
  featureConfigs: Record<string, FeatureInstanceConfig>
  onConfigChange: (featureCode: string, config: Record<string, unknown>) => void
  onAccessChange: (featureCode: string, access: FeatureAccess) => void
  errors: string[]
}

// All available roles for access configuration
const ALL_ROLES: StaffRole[] = [
  StaffRole.OWNER,
  StaffRole.ADMIN,
  StaffRole.MANAGER,
  StaffRole.CASHIER,
  StaffRole.WAITER,
  StaffRole.KITCHEN,
  StaffRole.HOST,
  StaffRole.VIEWER,
]

// Role display names
const ROLE_LABELS: Record<StaffRole, string> = {
  [StaffRole.OWNER]: 'Socio',
  [StaffRole.ADMIN]: 'Admin',
  [StaffRole.MANAGER]: 'Gerente',
  [StaffRole.CASHIER]: 'Cajero',
  [StaffRole.WAITER]: 'Mesero',
  [StaffRole.KITCHEN]: 'Cocina',
  [StaffRole.HOST]: 'Host',
  [StaffRole.VIEWER]: 'Visor',
  [StaffRole.SUPERADMIN]: 'Superadmin',
}

// Data scope descriptions
const DATA_SCOPE_OPTIONS: Array<{ value: DataScope; label: string; description: string }> = [
  {
    value: 'venue',
    label: 'Solo esta sucursal',
    description: 'El usuario solo ve datos de la sucursal actual',
  },
  {
    value: 'user-venues',
    label: 'Sucursales del usuario',
    description: 'El usuario ve datos de todas sus sucursales asignadas',
  },
  {
    value: 'organization',
    label: 'Toda la organizacion',
    description: 'El usuario ve datos de toda la organizacion (recomendado solo para OWNER)',
  },
]

// ============================================
// Component
// ============================================

export default function Step3Configuration({
  enabledFeatures,
  featureConfigs,
  onConfigChange,
  onAccessChange,
  errors,
}: Step3ConfigurationProps) {
  const { t } = useTranslation('superadmin')

  // Selected feature in sidebar
  const [selectedFeatureCode, setSelectedFeatureCode] = useState<string | null>(null)

  // Get feature definitions for enabled features
  const enabledFeatureDefinitions = useMemo(() => {
    return enabledFeatures.map(ef => ({
      definition: FEATURE_REGISTRY[ef.code],
      enabledFeature: ef,
    })).filter(item => item.definition)
  }, [enabledFeatures])

  // Auto-select first feature if none selected
  const activeFeatureCode = selectedFeatureCode ?? enabledFeatureDefinitions[0]?.definition.code ?? null
  const activeItem = enabledFeatureDefinitions.find(item => item.definition.code === activeFeatureCode)

  // Handle config field change
  const handleFieldChange = useCallback((featureCode: string, fieldName: string, value: unknown) => {
    const currentConfig = featureConfigs[featureCode]?.config || {}
    onConfigChange(featureCode, {
      ...currentConfig,
      [fieldName]: value,
    })
  }, [featureConfigs, onConfigChange])

  // Get current access for a feature (from EnabledFeature.access or default)
  const getFeatureAccess = useCallback((enabledFeature: EnabledFeature): FeatureAccess => {
    if (enabledFeature.access) {
      return enabledFeature.access
    }
    const definition = FEATURE_REGISTRY[enabledFeature.code]
    return definition?.defaultAccess || {
      allowedRoles: [StaffRole.OWNER, StaffRole.ADMIN, StaffRole.MANAGER],
      dataScope: 'user-venues',
    }
  }, [])

  // Handle role toggle
  const handleRoleToggle = useCallback((featureCode: string, role: StaffRole, enabled: boolean) => {
    const enabledFeature = enabledFeatures.find(ef => ef.code === featureCode)
    if (!enabledFeature) return

    const currentAccess = getFeatureAccess(enabledFeature)
    const newRoles = enabled
      ? [...currentAccess.allowedRoles, role]
      : currentAccess.allowedRoles.filter(r => r !== role)

    onAccessChange(featureCode, {
      ...currentAccess,
      allowedRoles: newRoles,
    })
  }, [enabledFeatures, getFeatureAccess, onAccessChange])

  // Handle data scope change
  const handleDataScopeChange = useCallback((featureCode: string, dataScope: DataScope) => {
    const enabledFeature = enabledFeatures.find(ef => ef.code === featureCode)
    if (!enabledFeature) return

    const currentAccess = getFeatureAccess(enabledFeature)

    const newRoles = dataScope === 'organization'
      ? currentAccess.allowedRoles.filter(r => r === StaffRole.OWNER || r === StaffRole.SUPERADMIN)
      : currentAccess.allowedRoles

    const finalRoles = dataScope === 'organization' && !newRoles.includes(StaffRole.OWNER)
      ? [StaffRole.OWNER, ...newRoles]
      : newRoles

    onAccessChange(featureCode, {
      allowedRoles: finalRoles,
      dataScope,
    })
  }, [enabledFeatures, getFeatureAccess, onAccessChange])

  if (enabledFeatures.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <Settings className="w-12 h-12 mx-auto mb-4 opacity-50" />
        <p>{t('whiteLabelWizard.configuration.noFeatures')}</p>
        <p className="text-sm mt-2">{t('whiteLabelWizard.configuration.goBack')}</p>
      </div>
    )
  }

  // Active feature data
  const activeFeature = activeItem?.definition
  const activeEnabledFeature = activeItem?.enabledFeature
  const activeConfig = activeFeature ? (featureConfigs[activeFeature.code]?.config || {}) : {}
  const activeSchema = activeFeature?.configSchema
  const hasConfigOptions = activeSchema?.properties && Object.keys(activeSchema.properties).length > 0
  const activeAccess = activeEnabledFeature ? getFeatureAccess(activeEnabledFeature) : null
  const hasOrgScopeWarning = activeAccess?.dataScope === 'organization' &&
    activeAccess.allowedRoles.some(r => r !== StaffRole.OWNER && r !== StaffRole.SUPERADMIN)

  return (
    <div className="space-y-4">
      {/* Errors */}
      {errors.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <ul className="list-disc list-inside">
              {errors.map((error, i) => (
                <li key={i}>{error}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold">{t('whiteLabelWizard.configuration.title')}</h2>
        <p className="text-sm text-muted-foreground">{t('whiteLabelWizard.configuration.description')}</p>
      </div>

      {/* Sidebar + Content Panel */}
      <div className="flex gap-0 min-h-[460px] rounded-xl border border-border/50 overflow-hidden bg-card">
        {/* Sidebar */}
        <nav className="w-56 shrink-0 border-r border-border/50 bg-muted/30 p-2 space-y-1 overflow-y-auto">
          {enabledFeatureDefinitions.map(({ definition: feature, enabledFeature }) => {
            const isActive = feature.code === activeFeatureCode
            const access = getFeatureAccess(enabledFeature)
            return (
              <button
                key={feature.code}
                onClick={() => setSelectedFeatureCode(feature.code)}
                className={cn(
                  'w-full text-left px-3 py-2.5 rounded-lg transition-colors',
                  isActive
                    ? 'bg-background border border-border shadow-sm'
                    : 'hover:bg-background/50 border border-transparent'
                )}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    'w-2 h-2 rounded-full shrink-0',
                    isActive ? 'bg-primary' : 'bg-green-500'
                  )} />
                  <span className={cn(
                    'text-sm truncate',
                    isActive ? 'font-semibold' : 'font-medium text-muted-foreground'
                  )}>
                    {feature.name}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 mt-1 ml-4">
                  <span className="text-[11px] text-muted-foreground">
                    {access.allowedRoles.length} roles
                  </span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[11px] text-muted-foreground truncate">
                    {FEATURE_CATEGORIES[feature.category]?.label || feature.category}
                  </span>
                </div>
              </button>
            )
          })}
        </nav>

        {/* Content Panel */}
        <div className="flex-1 min-w-0 overflow-y-auto p-6 space-y-6">
          {activeFeature && activeAccess && (
            <>
              {/* Feature Header */}
              <div className="flex items-start justify-between pb-4 border-b border-border/50">
                <div>
                  <h3 className="text-base font-semibold flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    {activeFeature.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{activeFeature.description}</p>
                </div>
                <Badge variant="outline">
                  {FEATURE_CATEGORIES[activeFeature.category]?.label || activeFeature.category}
                </Badge>
              </div>

              {/* Configuration Section */}
              {hasConfigOptions && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <Settings className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-sm font-semibold">Configuracion</h4>
                    <Badge variant="secondary" className="text-xs">
                      {Object.keys(activeConfig).length} ajustes
                    </Badge>
                  </div>
                  <div className="space-y-4 pl-6">
                    {Object.entries(activeSchema!.properties).map(([fieldName, fieldSchema]) => (
                      <SchemaField
                        key={fieldName}
                        fieldName={fieldName}
                        schema={fieldSchema}
                        value={activeConfig[fieldName]}
                        onChange={value => handleFieldChange(activeFeature.code, fieldName, value)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Permissions Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-sm font-semibold">Permisos de Acceso</h4>
                  <Badge variant="secondary" className="text-xs">
                    {activeAccess.allowedRoles.length} roles
                  </Badge>
                  {hasOrgScopeWarning && (
                    <AlertTriangle className="w-4 h-4 text-amber-500" />
                  )}
                </div>

                <div className="space-y-6 pl-6">
                  {/* Allowed Roles */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Roles permitidos</Label>
                    <p className="text-xs text-muted-foreground">
                      {activeAccess.dataScope === 'organization'
                        ? 'Solo OWNER puede acceder cuando el alcance es "Toda la organizacion"'
                        : 'Selecciona que roles pueden acceder a esta funcion'}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {ALL_ROLES.map(role => {
                        const isChecked = activeAccess.allowedRoles.includes(role)
                        const isDisabled = activeAccess.dataScope === 'organization' && role !== StaffRole.OWNER
                        return (
                          <label
                            key={role}
                            className={`flex items-center gap-2 p-3 rounded-lg border transition-colors ${
                              isDisabled
                                ? 'opacity-50 cursor-not-allowed'
                                : 'cursor-pointer'
                            } ${
                              isChecked
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            <Checkbox
                              checked={isChecked}
                              disabled={isDisabled}
                              onCheckedChange={(checked) => handleRoleToggle(activeFeature.code, role, !!checked)}
                            />
                            <span className="text-sm font-medium">{ROLE_LABELS[role]}</span>
                          </label>
                        )
                      })}
                    </div>
                  </div>

                  {/* Data Scope */}
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Alcance de datos</Label>
                    <p className="text-xs text-muted-foreground">
                      Define que datos puede ver el usuario con esta funcion
                    </p>
                    <Select
                      value={activeAccess.dataScope}
                      onValueChange={(value) => handleDataScopeChange(activeFeature.code, value as DataScope)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DATA_SCOPE_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            <div>
                              <span>{option.label}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{option.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Warning for organization scope with non-OWNER roles */}
                  {hasOrgScopeWarning && (
                    <div className="flex items-start gap-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                      <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-amber-800 dark:text-amber-200">
                        <strong>Atencion:</strong> El alcance "Toda la organizacion" permite ver datos de todas las sucursales.
                        Se recomienda limitar este alcance solo al rol OWNER para evitar filtraciones de datos entre sucursales.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ============================================
// Schema Field Component
// ============================================

interface SchemaFieldProps {
  fieldName: string
  schema: {
    type: string
    enum?: string[]
    default?: unknown
    description?: string
    title?: string
    minimum?: number
    maximum?: number
  }
  value: unknown
  onChange: (value: unknown) => void
}

function SchemaField({ fieldName, schema, value, onChange }: SchemaFieldProps) {
  const { t } = useTranslation('superadmin')

  // Use default value if no value is set
  const currentValue = value ?? schema.default

  // Render based on type
  switch (schema.type) {
    case 'boolean':
      return (
        <div className="flex items-center justify-between p-4 rounded-lg border border-border/50 bg-muted/30">
          <div className="space-y-0.5">
            <Label htmlFor={fieldName} className="font-medium">
              {schema.title || fieldName}
            </Label>
            {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
          </div>
          <Switch id={fieldName} checked={currentValue as boolean} onCheckedChange={onChange} />
        </div>
      )

    case 'string':
      if (schema.enum) {
        return (
          <div className="space-y-2">
            <Label htmlFor={fieldName} className="font-medium">
              {schema.title || fieldName}
            </Label>
            {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
            <Select value={(currentValue as string) || schema.enum[0]} onValueChange={onChange}>
              <SelectTrigger id={fieldName}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {schema.enum.map(option => (
                  <SelectItem key={option} value={option}>
                    {t(`whiteLabelWizard.configuration.enums.${option}`, option)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )
      }
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldName} className="font-medium">
            {schema.title || fieldName}
          </Label>
          {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
          <Input
            id={fieldName}
            value={(currentValue as string) || ''}
            onChange={e => onChange(e.target.value)}
            placeholder={schema.default as string}
          />
        </div>
      )

    case 'number': {
      const min = schema.minimum ?? 0
      const max = schema.maximum ?? 100
      const numValue = (currentValue as number) ?? schema.default ?? min

      return (
        <div className="space-y-2">
          <Label htmlFor={fieldName} className="font-medium">
            {schema.title || fieldName}
          </Label>
          {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
          <div className="flex items-center gap-2">
            <Input
              id={fieldName}
              type="number"
              min={min}
              max={max}
              value={String(numValue)}
              onChange={e => {
                const val = parseInt(e.target.value, 10)
                if (!isNaN(val)) {
                  onChange(Math.min(max, Math.max(min, val)))
                }
              }}
              className="w-24"
            />
            <span className="text-xs text-muted-foreground">
              ({min} - {max})
            </span>
          </div>
        </div>
      )
    }

    case 'array':
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldName} className="font-medium">
            {schema.title || fieldName}
          </Label>
          {schema.description && <p className="text-xs text-muted-foreground">{schema.description}</p>}
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border border-border/50 rounded-lg bg-muted/30">
            <Info className="w-4 h-4" />
            {t('whiteLabelWizard.configuration.arrayNotSupported')}
          </div>
        </div>
      )

    default:
      return (
        <div className="space-y-2">
          <Label htmlFor={fieldName} className="font-medium">
            {schema.title || fieldName}
          </Label>
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border border-border/50 rounded-lg bg-muted/30">
            <Info className="w-4 h-4" />
            {t('whiteLabelWizard.configuration.unsupportedType', { type: schema.type })}
          </div>
        </div>
      )
  }
}
