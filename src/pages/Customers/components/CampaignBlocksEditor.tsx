import { useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import type { CampaignBlock } from '@/services/marketing.service'

import { TIPOS_DE_BLOQUE, bloqueVacio } from './campaignBlocks'

interface Props {
  bloques: CampaignBlock[]
  onChange: (bloques: CampaignBlock[]) => void
  soloLectura?: boolean
  /** Etiqueta de la sección; cada pantalla la nombra a su manera. */
  label?: string
}

/**
 * Editor del contenido de un correo, por BLOQUES.
 *
 * 🔴 Vive aparte porque lo usan DOS pantallas —las campañas puntuales y la felicitación de
 * cumpleaños— y es exactamente el tipo de cosa que no puede estar copiada: un tipo de
 * bloque nuevo, o un arreglo de accesibilidad, tendría que aplicarse en dos sitios y la
 * copia olvidada se quedaría atrás sin que nada lo notara.
 *
 * El dashboard NO escribe HTML en ningún punto: el servidor renderiza estos bloques. Por eso
 * aquí no hay nada que sanitizar — el riesgo no se mitiga, no existe.
 */
export function CampaignBlocksEditor({ bloques, onChange, soloLectura = false, label }: Props) {
  const { t } = useTranslation('customers')

  const mover = (i: number, delta: number) => {
    const j = i + delta
    if (j < 0 || j >= bloques.length) return
    const copia = [...bloques]
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
    onChange(copia)
  }

  const actualizar = (i: number, campos: Partial<CampaignBlock>) => {
    onChange(bloques.map((b, k) => (k === i ? ({ ...b, ...campos } as CampaignBlock) : b)))
  }

  return (
    <div className="space-y-3">
      <Label>{label ?? t('campaigns.content')}</Label>
      {bloques.map((b, i) => (
        <div key={i} className="rounded-2xl border border-border/50 bg-card p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{t(`campaigns.blocks.${b.type}`)}</span>
            {!soloLectura && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => mover(i, -1)}
                  disabled={i === 0}
                  aria-label={t('campaigns.blocks.moveUp')}
                >
                  <ArrowUp className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => mover(i, 1)}
                  disabled={i === bloques.length - 1}
                  aria-label={t('campaigns.blocks.moveDown')}
                >
                  <ArrowDown className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onChange(bloques.filter((_, k) => k !== i))}
                  disabled={bloques.length === 1}
                  aria-label={t('campaigns.blocks.remove')}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>

          {b.type === 'heading' && <Input value={b.text} onChange={e => actualizar(i, { text: e.target.value })} disabled={soloLectura} />}
          {b.type === 'paragraph' && (
            <Textarea value={b.text} onChange={e => actualizar(i, { text: e.target.value })} rows={4} disabled={soloLectura} />
          )}
          {b.type === 'image' && (
            <div className="space-y-2">
              <Input
                value={b.url}
                onChange={e => actualizar(i, { url: e.target.value })}
                placeholder={t('campaigns.blocks.urlPlaceholder')}
                disabled={soloLectura}
              />
              <Input
                value={b.alt}
                onChange={e => actualizar(i, { alt: e.target.value })}
                placeholder={t('campaigns.blocks.altPlaceholder')}
                disabled={soloLectura}
              />
            </div>
          )}
          {b.type === 'button' && (
            <div className="space-y-2">
              <Input
                value={b.label}
                onChange={e => actualizar(i, { label: e.target.value })}
                placeholder={t('campaigns.blocks.labelPlaceholder')}
                disabled={soloLectura}
              />
              <Input
                value={b.url}
                onChange={e => actualizar(i, { url: e.target.value })}
                placeholder={t('campaigns.blocks.urlPlaceholder')}
                disabled={soloLectura}
              />
            </div>
          )}
          {b.type === 'divider' && <div className="h-px bg-border" />}
        </div>
      ))}

      {!soloLectura && (
        <div className="flex flex-wrap gap-2">
          {TIPOS_DE_BLOQUE.map(tipo => (
            <Button key={tipo} variant="outline" size="sm" onClick={() => onChange([...bloques, bloqueVacio(tipo)])}>
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t(`campaigns.blocks.${tipo}`)}
            </Button>
          ))}
        </div>
      )}
    </div>
  )
}

export default CampaignBlocksEditor
