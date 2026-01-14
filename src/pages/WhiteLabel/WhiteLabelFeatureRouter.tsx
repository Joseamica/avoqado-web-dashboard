/**
 * WhiteLabelFeatureRouter - Routes to individual features
 *
 * Extracts the feature slug from the URL and loads the appropriate component
 * using DynamicFeatureLoader.
 */

import { useParams } from 'react-router-dom'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { AlertCircle } from 'lucide-react'
import DynamicFeatureLoader from '@/components/WhiteLabel/DynamicFeatureLoader'
import { unslugify } from '@/hooks/useWhiteLabelConfig'
import { getFeatureByCode } from '@/config/feature-registry'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export default function WhiteLabelFeatureRouter() {
  const { featureSlug } = useParams<{ featureSlug: string }>()
  const { t } = useTranslation('whitelabel')

  // Convert slug to feature code
  const featureCode = useMemo(() => {
    if (!featureSlug) return null
    return unslugify(featureSlug)
  }, [featureSlug])

  // Validate feature exists
  const featureDefinition = useMemo(() => {
    if (!featureCode) return null
    return getFeatureByCode(featureCode)
  }, [featureCode])

  // No feature slug provided
  if (!featureSlug || !featureCode) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-muted-foreground" />
            {t('noFeatureSelected', { defaultValue: 'No feature selected' })}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('selectFeatureFromNav', {
              defaultValue: 'Please select a feature from the navigation menu.',
            })}
          </p>
        </CardContent>
      </Card>
    )
  }

  // Feature not found in registry
  if (!featureDefinition) {
    return (
      <Card className="max-w-md mx-auto mt-12">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-destructive">
            <AlertCircle className="h-5 w-5" />
            {t('featureNotFound', { defaultValue: 'Feature not found' })}
          </CardTitle>
          <CardDescription>
            <code className="px-2 py-1 bg-muted rounded text-xs">
              {featureCode}
            </code>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            {t('featureNotFoundDesc', {
              defaultValue: 'The requested feature does not exist in the registry.',
            })}
          </p>
        </CardContent>
      </Card>
    )
  }

  return <DynamicFeatureLoader featureCode={featureCode} />
}
