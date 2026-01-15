/**
 * Step3Configuration - Per-feature configuration
 *
 * Third step of the white-label wizard where users can:
 * 1. Configure each enabled feature using auto-generated forms
 * 2. Forms are generated from configSchema in the Feature Registry
 */

import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FEATURE_CATEGORIES, FEATURE_REGISTRY } from '@/config/feature-registry'
import type { EnabledFeature, FeatureInstanceConfig } from '@/types/white-label'
import { AlertCircle, Check, Info, Settings } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

// ============================================
// Types
// ============================================

interface Step3ConfigurationProps {
  enabledFeatures: EnabledFeature[]
  featureConfigs: Record<string, FeatureInstanceConfig>
  onConfigChange: (featureCode: string, config: Record<string, unknown>) => void
  errors: string[]
}

// ============================================
// Component
// ============================================

export default function Step3Configuration({ enabledFeatures, featureConfigs, onConfigChange, errors }: Step3ConfigurationProps) {
  const { t } = useTranslation('superadmin')

  // Selected feature tab
  const [selectedFeature, setSelectedFeature] = useState<string>(enabledFeatures[0]?.code || '')

  // Get feature definitions for enabled features
  const enabledFeatureDefinitions = useMemo(() => {
    return enabledFeatures.map(ef => FEATURE_REGISTRY[ef.code]).filter(Boolean)
  }, [enabledFeatures])

  // Handle config field change
  const handleFieldChange = (featureCode: string, fieldName: string, value: unknown) => {
    const currentConfig = featureConfigs[featureCode]?.config || {}
    onConfigChange(featureCode, {
      ...currentConfig,
      [fieldName]: value,
    })
  }

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

      {/* Feature Tabs with Configuration */}
      <Tabs value={selectedFeature} onValueChange={setSelectedFeature} className="w-full">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border flex-wrap gap-1">
          {enabledFeatureDefinitions.map(feature => (
            <TabsTrigger
              key={feature.code}
              value={feature.code}
              className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
            >
              {feature.name}
            </TabsTrigger>
          ))}
        </TabsList>

        {enabledFeatureDefinitions.map(feature => {
          const config = featureConfigs[feature.code]?.config || {}
          const schema = feature.configSchema

          return (
            <TabsContent key={feature.code} value={feature.code} className="mt-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Settings className="w-4 h-4" />
                        {feature.name}
                      </CardTitle>
                      <CardDescription className="mt-1">{feature.description}</CardDescription>
                    </div>
                    <Badge variant="outline">{FEATURE_CATEGORIES[feature.category]?.label || feature.category}</Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-6">
                  {schema?.properties && Object.keys(schema.properties).length > 0 ? (
                    Object.entries(schema.properties).map(([fieldName, fieldSchema]) => (
                      <SchemaField
                        key={fieldName}
                        fieldName={fieldName}
                        schema={fieldSchema}
                        value={config[fieldName]}
                        onChange={value => handleFieldChange(feature.code, fieldName, value)}
                      />
                    ))
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                      <Info className="w-4 h-4" />
                      {t('whiteLabelWizard.configuration.noConfigOptions')}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          )
        })}
      </Tabs>

      {/* Configuration Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Check className="w-4 h-4" />
            {t('whiteLabelWizard.configuration.summary')}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {enabledFeatureDefinitions.map(feature => {
              const config = featureConfigs[feature.code]?.config || {}
              const configCount = Object.keys(config).length

              return (
                <div key={feature.code} className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <span className="text-sm font-medium">{feature.name}</span>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {configCount} {t('whiteLabelWizard.configuration.settings')}
                  </Badge>
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
