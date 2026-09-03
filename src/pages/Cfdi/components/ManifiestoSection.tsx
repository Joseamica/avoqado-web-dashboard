import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FileSignature, ShieldCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { useEmisorProviderStatus } from '@/hooks/use-cfdi'
import type { Emisor } from '@/services/cfdi.service'

/**
 * Módulo de firma embebible de Facturapi: sin logos y sin parámetros — el RFC
 * se lee de la propia e.firma que sube quien firma, por eso la URL es fija.
 * Facturapi lo sirve con `frame-ancestors *` (verificado 2026-09-01).
 */
const MANIFIESTO_EMBED_URL = 'https://www.facturapi.io/embedded/manifiesto'

interface ManifiestoSectionProps {
  emisor: Emisor
}

/**
 * Paso 4 del onboarding fiscal: la Carta Manifiesto (la autorización legal al
 * PAC para timbrar por este RFC). Sólo se monta para emisores ya conectados
 * (providerOrgId) — antes de conectar no hay organización que firmar.
 *
 * El iframe no avisa cuando la firma termina (no hay callback documentado),
 * así que al cerrar el modal se re-consulta el estado al servidor.
 */
export function ManifiestoSection({ emisor }: ManifiestoSectionProps) {
  const { t } = useTranslation('cfdi')
  const [open, setOpen] = useState(false)
  const status = useEmisorProviderStatus(emisor.id, { enabled: !!emisor.providerOrgId })

  if (!emisor.providerOrgId || status.isLoading) return null

  const pending = status.data ? status.data.pendingSteps.includes('manifiesto') : null

  const handleClose = () => {
    setOpen(false)
    void status.refetch()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {pending === null ? (
        <Badge variant="outline">{t('manifiesto.unknown')}</Badge>
      ) : pending ? (
        <>
          <Badge variant="outline">{t('manifiesto.pending')}</Badge>
          <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
            <FileSignature className="mr-2 h-4 w-4" />
            {t('manifiesto.sign')}
          </Button>
        </>
      ) : (
        <Badge variant="secondary">
          <ShieldCheck className="h-3 w-3" />
          {t('manifiesto.signed')}
        </Badge>
      )}

      <FullScreenModal
        open={open}
        onClose={handleClose}
        title={t('manifiesto.modalTitle')}
        contentClassName="bg-muted/30"
        actions={<Button onClick={handleClose}>{t('manifiesto.done')}</Button>}
      >
        <div className="mx-auto max-w-4xl space-y-4 p-6">
          <section className="rounded-2xl border border-input bg-card p-5 space-y-2">
            <p className="text-sm font-medium">{t('manifiesto.efirmaNoticeTitle')}</p>
            <p className="text-sm text-muted-foreground">{t('manifiesto.efirmaNotice')}</p>
            <a
              href={MANIFIESTO_EMBED_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {t('manifiesto.openInNewTab')}
            </a>
          </section>

          <section className="overflow-hidden rounded-2xl border border-input bg-card">
            <iframe src={MANIFIESTO_EMBED_URL} title={t('manifiesto.iframeTitle')} className="h-[70vh] w-full border-0" />
          </section>
        </div>
      </FullScreenModal>
    </div>
  )
}
