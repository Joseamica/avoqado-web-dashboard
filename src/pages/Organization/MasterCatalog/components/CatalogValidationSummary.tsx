import { AlertCircle, CheckCircle2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'

export interface CatalogFinding {
  code: string
  message: string
  severity: 'ERROR' | 'STALE' | 'WARNING'
}

export default function CatalogValidationSummary({ findings }: { findings: CatalogFinding[] }) {
  const { t } = useTranslation('organization')
  const blocking = findings.some(finding => finding.severity === 'ERROR' || finding.severity === 'STALE')

  return (
    <div role="status" aria-live="polite" className="space-y-3">
      {findings.length === 0 ? (
        <Alert>
          <CheckCircle2 aria-hidden="true" />
          <AlertTitle>{t('masterCatalog.validation.ready', { defaultValue: 'Listo para confirmar' })}</AlertTitle>
          <AlertDescription>
            {t('masterCatalog.validation.noBlockers', { defaultValue: 'La revisión no encontró bloqueos.' })}
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant={blocking ? 'destructive' : 'default'}>
          <AlertCircle aria-hidden="true" />
          <AlertTitle>
            {blocking
              ? t('masterCatalog.validation.blocked', { defaultValue: 'Revisión requerida' })
              : t('masterCatalog.validation.warnings', { defaultValue: 'Advertencias' })}
          </AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-5">
              {findings.map((finding, index) => (
                <li key={`${finding.code}-${index}`}>
                  {finding.message} <span className="font-mono text-xs">({finding.code})</span>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  )
}
