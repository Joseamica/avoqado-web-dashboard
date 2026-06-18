import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { CheckCircle2, AlertTriangle, XCircle, Landmark, FileText, Receipt, FileSpreadsheet } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { AccountingErrorState } from '@/components/accounting/AccountingErrorState'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { useFiscalReadiness } from '@/hooks/useFiscalReadiness'
import type { FiscalReadinessResponse, ReadinessStatus } from '@/services/fiscal/fiscalReadiness.service'
import { cn } from '@/lib/utils'

const SAMPLE: FiscalReadinessResponse = {
  needsFiscalSetup: false,
  organizationId: null,
  rfc: 'TESC900101AAA',
  legalName: 'Mi Negocio SA de CV',
  regimenFiscal: '601',
  checks: [
    { key: 'rfc', label: 'RFC del contribuyente', status: 'ok', detail: 'RFC TESC900101AAA configurado.' },
    { key: 'emisor', label: 'Emisor fiscal', status: 'ok', detail: 'Mi Negocio SA de CV · régimen 601 · lugar de expedición 06700.' },
    { key: 'csd', label: 'Sello digital (CSD)', status: 'ok', detail: 'CSD activo: puedes timbrar.' },
    { key: 'cp', label: 'Código postal del local', status: 'ok', detail: 'CP 06700.' },
    { key: 'catalogo', label: 'Catálogo de cuentas', status: 'ok', detail: 'Catálogo sembrado.' },
    { key: 'mapeos', label: 'Configuración contable', status: 'warn', detail: '24/28 movimientos con cuenta; faltan 4. El posteo te dirá cuáles al correr.' },
    { key: 'nomina', label: 'Nómina (empleados)', status: 'ok', detail: '3 empleado(s) activos con sus datos fiscales completos.' },
  ],
  capabilities: { puedeFacturar: true, puedeTimbrarNomina: true, contabilidadElectronicaLista: false },
  resumen: { ok: 6, warn: 1, missing: 0 },
}

const STATUS_ICON: Record<ReadinessStatus, typeof CheckCircle2> = { ok: CheckCircle2, warn: AlertTriangle, missing: XCircle }
const STATUS_COLOR: Record<ReadinessStatus, string> = {
  ok: 'text-emerald-600 dark:text-emerald-400',
  warn: 'text-amber-600 dark:text-amber-400',
  missing: 'text-red-600 dark:text-red-400',
}

function Capability({ label, ready, icon: Icon }: { label: string; ready: boolean; icon: typeof Receipt }) {
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-xl border p-3',
        ready ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-input bg-muted/40',
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', ready ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground')} />
      <span className={cn('text-sm font-medium', ready ? 'text-foreground' : 'text-muted-foreground')}>{label}</span>
      {ready ? (
        <CheckCircle2 className="ml-auto h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
      ) : (
        <span className="ml-auto text-[10px] font-medium uppercase text-muted-foreground">—</span>
      )}
    </div>
  )
}

function FiscalReadinessInner() {
  const { t } = useTranslation('reports')
  const { fullBasePath } = useCurrentVenue()
  const { hasAccess } = useTierFeatureAccess('CFDI')

  const query = useFiscalReadiness({ enabled: hasAccess })
  const data = hasAccess ? query.data : SAMPLE
  const needsFiscalSetup = hasAccess && query.data?.needsFiscalSetup

  return (
    <div className="space-y-5 p-4 bg-background">
      <header>
        <h1 className="text-xl font-semibold text-foreground">{t('fiscalReadiness.title')}</h1>
        <p className="text-sm text-muted-foreground">
          {data?.rfc
            ? t('subtitleSuffix', { base: t('fiscalReadiness.subtitle'), suffix: t('chartOfAccounts.rfcLabel', { rfc: data.rfc }) })
            : t('fiscalReadiness.subtitle')}
        </p>
      </header>

      {query.isLoading && hasAccess ? (
        <Skeleton className="h-96 rounded-2xl" />
      ) : query.isError && hasAccess ? (
        <AccountingErrorState onRetry={() => query.refetch()} />
      ) : needsFiscalSetup ? (
        <Card className="border-input">
          <CardContent className="flex flex-col items-center gap-3 py-10 text-center">
            <Landmark className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium text-foreground">{t('chartOfAccounts.needsFiscalSetupTitle')}</p>
            <p className="max-w-md text-sm text-muted-foreground">{t('chartOfAccounts.needsFiscalSetupBody')}</p>
            <Link to={`${fullBasePath}/cfdi/configuracion`}>
              <Button size="sm" variant="outline">
                {t('chartOfAccounts.goToFiscalConfig')}
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Resumen + capacidades */}
          <Card className="border-input">
            <CardContent className="space-y-4 py-4">
              <div className="flex flex-wrap items-center gap-3 text-sm">
                <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="h-4 w-4" /> {t('fiscalReadiness.summary.ok', { n: data?.resumen.ok ?? 0 })}
                </span>
                <span className="inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" /> {t('fiscalReadiness.summary.warn', { n: data?.resumen.warn ?? 0 })}
                </span>
                <span className="inline-flex items-center gap-1.5 text-red-600 dark:text-red-400">
                  <XCircle className="h-4 w-4" /> {t('fiscalReadiness.summary.missing', { n: data?.resumen.missing ?? 0 })}
                </span>
              </div>
              <div className="grid gap-2 sm:grid-cols-3">
                <Capability label={t('fiscalReadiness.cap.invoice')} ready={!!data?.capabilities.puedeFacturar} icon={Receipt} />
                <Capability label={t('fiscalReadiness.cap.payroll')} ready={!!data?.capabilities.puedeTimbrarNomina} icon={FileText} />
                <Capability
                  label={t('fiscalReadiness.cap.electronic')}
                  ready={!!data?.capabilities.contabilidadElectronicaLista}
                  icon={FileSpreadsheet}
                />
              </div>
            </CardContent>
          </Card>

          {/* Checklist */}
          <Card className="border-input">
            <CardContent className="divide-y divide-border/60 py-1">
              {data?.checks.map(c => {
                const Icon = STATUS_ICON[c.status]
                return (
                  <div key={c.key} className="flex items-start gap-3 py-3">
                    <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', STATUS_COLOR[c.status])} />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">{c.label}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                    </div>
                  </div>
                )
              })}
            </CardContent>
          </Card>

          <Card className="border-input">
            <CardContent className="py-3 text-xs text-muted-foreground">
              <p>{t('fiscalReadiness.disclosure')}</p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

/**
 * Preparación fiscal (onboarding) — checklist de "¿qué le falta a este local para operar la
 * contabilidad fiscal?" + capacidades desbloqueadas (facturar / timbrar nómina / contabilidad
 * electrónica). Read-only. Gated PREMIUM (FeatureGate CFDI).
 */
export default function FiscalReadiness() {
  return (
    <FeatureGate feature="CFDI">
      <FiscalReadinessInner />
    </FeatureGate>
  )
}
