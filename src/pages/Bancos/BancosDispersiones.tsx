/**
 * Bancos → Dispersiones. Paga a varios beneficiarios de un solo lote (nómina, comisiones) vía CSV.
 * MUEVE DINERO y no tiene backend todavía (roadmap Fase B5 del plan) — el formulario es real,
 * incluso lee el CSV para mostrar cuántas filas trae, pero el submit queda deshabilitado con
 * badge "Muy pronto". bankingHub.service.dispersionService.run() SIEMPRE lanza si se invocara
 * directo — nunca hay un envío que finja éxito. La lectura del CSV es solo una vista previa
 * local (no se sube a ningún lado).
 */
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FileSpreadsheet, Send } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { useToast } from '@/hooks/use-toast'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { BancosEmptyState, BancosErrorState } from '@/pages/Bancos/BancosEmptyState'
import { BancosPageHeader } from '@/pages/Bancos/BancosPageHeader'
import { useBancosData, type BancosData } from '@/pages/Bancos/useBancosData'

const CSV_MAX_BYTES = 5 * 1024 * 1024 // 5MB — solo vista previa local, no hace falta más.

function DispersionForm({ accounts }: { accounts: BancosData['accounts'] }) {
  const { t } = useTranslation('financialConnections')
  const { toast } = useToast()
  const eligibleAccounts = accounts.filter(a => a.connection.accountKind === 'CLIENT')

  const [sourceAccountId, setSourceAccountId] = useState(eligibleAccounts[0]?.account.id ?? '')
  const [file, setFile] = useState<File | null>(null)
  const [rowCount, setRowCount] = useState<number | null>(null)
  // Descarta la lectura si el usuario selecciona OTRO archivo antes de que termine `f.text()` —
  // sin esto, dos selecciones rápidas pueden dejar el rowCount de la primera junto al nombre
  // del segundo archivo.
  const readSeq = useRef(0)

  const handleFile = async (f: File | null) => {
    const seq = ++readSeq.current
    setFile(f)
    if (!f) {
      setRowCount(null)
      return
    }
    if (f.size > CSV_MAX_BYTES) {
      setRowCount(null)
      toast({ title: t('hub.dispersions.fileTooLarge'), variant: 'destructive' })
      return
    }
    const text = await f.text()
    if (seq !== readSeq.current) return // una selección más nueva ya está en curso
    // Sin encabezado esperado (mismo formato que ChangeCategoryDialog: una fila por registro) —
    // detectar "es encabezado" por presencia de letras es ambiguo aquí porque el nombre del
    // beneficiario, un campo de datos real, también trae letras.
    const rows = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean)
    setRowCount(rows.length)
  }

  if (eligibleAccounts.length === 0) {
    return (
      <div className="rounded-xl border border-input bg-muted/30 px-4 py-10 text-center text-sm text-muted-foreground">
        {t('hub.personalOnly')}
      </div>
    )
  }

  return (
    <Card className="border-input">
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle>{t('hub.dispersions.formTitle')}</CardTitle>
          <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
            {t('hub.comingSoonBadge')}
          </Badge>
        </div>
        <CardDescription>{t('hub.dispersions.formDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="grid gap-2">
          <Label htmlFor="dispersion-source">{t('hub.spei.fields.sourceAccount')}</Label>
          <Select value={sourceAccountId} onValueChange={setSourceAccountId}>
            <SelectTrigger id="dispersion-source" className="h-12 text-base">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {eligibleAccounts.map(({ account }) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.label ?? account.externalId}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-2">
          <Label htmlFor="dispersion-csv">{t('hub.dispersions.fields.csv')}</Label>
          <input
            id="dispersion-csv"
            type="file"
            accept=".csv,text/csv"
            onChange={e => handleFile(e.target.files?.[0] ?? null)}
            className="block w-full rounded-md border border-input bg-background p-2 text-sm"
          />
          <p className="text-xs text-muted-foreground">{t('hub.dispersions.csvHelp')}</p>
          {file && (
            <div className="flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-sm">
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="truncate">{file.name}</span>
              {rowCount != null && (
                <Badge variant="secondary" className="ml-auto shrink-0">
                  {t('hub.dispersions.rowsDetected', { count: rowCount })}
                </Badge>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-col gap-2 border-t border-border/40 pt-4">
          <p className="text-xs text-muted-foreground">{t('hub.dispersions.previewNote')}</p>
          <Button disabled className="w-full sm:w-auto">
            <Send className="mr-1 h-4 w-4" />
            {t('hub.dispersions.submit')}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BancosDispersiones() {
  const { t } = useTranslation('financialConnections')
  const { hasAccess } = useTierFeatureAccess('BANKING_HUB')
  const { venueId, accounts, hasConnection, hasPendingConnection, hasProviders, isLoading, isError, refetch } = useBancosData({
    enabled: hasAccess,
  })

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 p-4 sm:p-6">
      <BancosPageHeader
        title={
          <span className="flex items-center gap-2">
            {t('hub.dispersions.title')}
            <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
              {t('hub.comingSoonBadge')}
            </Badge>
          </span>
        }
        description={t('hub.dispersions.description')}
      />
      <FeatureGate feature="BANKING_HUB">
        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-xl" />
        ) : isError ? (
          <BancosErrorState onRetry={refetch} />
        ) : !hasConnection || !venueId ? (
          <BancosEmptyState venueId={venueId ?? ''} hasProviders={hasProviders} pendingReconnect={hasPendingConnection} />
        ) : (
          <DispersionForm accounts={accounts} />
        )}
      </FeatureGate>
    </div>
  )
}
