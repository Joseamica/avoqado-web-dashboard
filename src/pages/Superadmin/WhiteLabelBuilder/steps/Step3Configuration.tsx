/**
 * Step3Configuration - Per-feature configuration with permissions
 *
 * Third step of the white-label wizard where users can:
 * 1. Configure each enabled feature using auto-generated forms
 * 2. Configure access permissions (roles and data scope) per feature
 * 3. Forms are generated from configSchema in the Feature Registry
 */

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { FEATURE_CATEGORIES, FEATURE_REGISTRY } from '@/config/feature-registry'
import { StaffRole } from '@/types'
import type { DataScope, EnabledFeature, FeatureAccess, FeatureInstanceConfig } from '@/types/white-label'
import { AlertCircle, AlertTriangle, ChevronDown, Info, Settings, Shield } from 'lucide-react'
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

  // Track which accordions are open per feature
  const [openSections, setOpenSections] = useState<Record<string, { config: boolean; permissions: boolean }>>({})

  // Get feature definitions for enabled features
  const enabledFeatureDefinitions = useMemo(() => {
    return enabledFeatures.map(ef => ({
      definition: FEATURE_REGISTRY[ef.code],
      enabledFeature: ef,
    })).filter(item => item.definition)
  }, [enabledFeatures])

  // Toggle accordion section
  const toggleSection = useCallback((featureCode: string, section: 'config' | 'permissions') => {
    setOpenSections(prev => ({
      ...prev,
      [featureCode]: {
        config: section === 'config' ? !prev[featureCode]?.config : (prev[featureCode]?.config ?? false),
        permissions: section === 'permissions' ? !prev[featureCode]?.permissions : (prev[featureCode]?.permissions ?? false),
      },
    }))
  }, [])

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
  // When 'organization' scope is selected, auto-restrict to OWNER only
  const handleDataScopeChange = useCallback((featureCode: string, dataScope: DataScope) => {
    const enabledFeature = enabledFeatures.find(ef => ef.code === featureCode)
    if (!enabledFeature) return

    const currentAccess = getFeatureAccess(enabledFeature)

    // If organization scope, restrict to OWNER only (and SUPERADMIN if present)
    const newRoles = dataScope === 'organization'
      ? currentAccess.allowedRoles.filter(r => r === StaffRole.OWNER || r === StaffRole.SUPERADMIN)
      : currentAccess.allowedRoles

    // Ensure OWNER is always included for organization scope
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

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
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

      {/* Feature Cards */}
      <div className="space-y-4">
        {enabledFeatureDefinitions.map(({ definition: feature, enabledFeature }) => {
          const config = featureConfigs[feature.code]?.config || {}
          const schema = feature.configSchema
          const hasConfigOptions = schema?.properties && Object.keys(schema.properties).length > 0
          const access = getFeatureAccess(enabledFeature)
          const sections = openSections[feature.code] || { config: false, permissions: false }

          // Check if organization scope is selected but non-OWNER roles are included
          const hasOrgScopeWarning = access.dataScope === 'organization' &&
            access.allowedRoles.some(r => r !== StaffRole.OWNER && r !== StaffRole.SUPERADMIN)

          return (
            <Card key={feature.code} className="overflow-hidden">
              {/* Feature Header */}
              <CardHeader className="pb-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-green-500" />
                      {feature.name}
                    </CardTitle>
                    <CardDescription className="mt-1">{feature.description}</CardDescription>
                  </div>
                  <Badge variant="outline">{FEATURE_CATEGORIES[feature.category]?.label || feature.category}</Badge>
                </div>
              </CardHeader>

              <CardContent className="pt-0 space-y-2">
                {/* Configuration Accordion */}
                {hasConfigOptions && (
                  <Collapsible
                    open={sections.config}
                    onOpenChange={() => toggleSection(feature.code, 'config')}
                  >
                    <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-2">
                        <Settings className="w-4 h-4 text-muted-foreground" />
                        <span className="text-sm font-medium">Configuracion</span>
                        <Badge variant="secondary" className="text-xs">
                          {Object.keys(config).length} ajustes
                        </Badge>
                      </div>
                      <ChevronDown
                        className={`w-4 h-4 text-muted-foreground transition-transform ${
                          sections.config ? 'rotate-180' : ''
                        }`}
                      />
                    </CollapsibleTrigger>
                    <CollapsibleContent className="pt-4 space-y-4">
                      {Object.entries(schema.properties).map(([fieldName, fieldSchema]) => (
                        <SchemaField
                          key={fieldName}
                          fieldName={fieldName}
                          schema={fieldSchema}
                          value={config[fieldName]}
                          onChange={value => handleFieldChange(feature.code, fieldName, value)}
                        />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )}

                {/* Permissions Accordion */}
                <Collapsible
                  open={sections.permissions}
                  onOpenChange={() => toggleSection(feature.code, 'permissions')}
                >
                  <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted/70 transition-colors">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Permisos de Acceso</span>
                      <Badge variant="secondary" className="text-xs">
                        {access.allowedRoles.length} roles
                      </Badge>
                      {hasOrgScopeWarning && (
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                      )}
                    </div>
                    <ChevronDown
                      className={`w-4 h-4 text-muted-foreground transition-transform ${
                        sections.permissions ? 'rotate-180' : ''
                      }`}
                    />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-4 space-y-6">
                    {/* Allowed Roles */}
                    <div className="space-y-3">
                      <Label className="text-sm font-medium">Roles permitidos</Label>
                      <p className="text-xs text-muted-foreground">
                        {access.dataScope === 'organization'
                          ? 'Solo OWNER puede acceder cuando el alcance es "Toda la organizacion"'
                          : 'Selecciona que roles pueden acceder a esta funcion'}
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {ALL_ROLES.map(role => {
                          const isChecked = access.allowedRoles.includes(role)
                          // Disable non-OWNER roles when organization scope is selected
                          const isDisabled = access.dataScope === 'organization' && role !== StaffRole.OWNER
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
                                onCheckedChange={(checked) => handleRoleToggle(feature.code, role, !!checked)}
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
                      <RadioGroup
                        value={access.dataScope}
                        onValueChange={(value) => handleDataScopeChange(feature.code, value as DataScope)}
                        className="space-y-2"
                      >
                        {DATA_SCOPE_OPTIONS.map(option => (
                          <label
                            key={option.value}
                            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                              access.dataScope === option.value
                                ? 'border-primary bg-primary/5'
                                : 'border-border hover:border-muted-foreground/50'
                            }`}
                          >
                            <RadioGroupItem value={option.value} className="mt-0.5" />
                            <div className="flex-1">
                              <span className="text-sm font-medium">{option.label}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                            </div>
                          </label>
                        ))}
                      </RadioGroup>
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
                  </CollapsibleContent>
                </Collapsible>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Info className="w-4 h-4" />
            {t('whiteLabelWizard.configuration.summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enabledFeatureDefinitions.map(({ definition: feature, enabledFeature }) => {
              const access = getFeatureAccess(enabledFeature)
              return (
                <div key={feature.code} className="p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">{feature.name}</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {access.allowedRoles.slice(0, 3).map(role => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {ROLE_LABELS[role]}
                      </Badge>
                    ))}
                    {access.allowedRoles.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{access.allowedRoles.length - 3}
                      </Badge>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
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
        <div className="flex items-center justify-between p-4 rounded-lg border bg-muted/30">
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
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
          <div className="flex items-center gap-2 text-sm text-muted-foreground p-4 border rounded-lg bg-muted/30">
            <Info className="w-4 h-4" />
            {t('whiteLabelWizard.configuration.unsupportedType', { type: schema.type })}
          </div>
        </div>
      )
  }
}
