import { Lock, Palette, Type } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { VenueTierBadge } from '@/components/venue-tier-badge'
import { cn } from '@/lib/utils'
import { contarCaracteres, limitarTexto, MAX_TEXTO, MUESTRAS_DE_COLOR, PALETA_DE_LA_TABLET, type BorradorDelEditor } from './model'

function Seccion({
  icono,
  titulo,
  extra,
  tour,
  children,
}: {
  icono: ReactNode
  titulo: string
  extra?: ReactNode
  tour: string
  children: ReactNode
}) {
  return (
    <section data-tour={tour} className="space-y-4 rounded-2xl border border-border/50 bg-card p-6">
      <div className="flex flex-wrap items-center gap-2">
        {icono}
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{titulo}</h3>
        {extra}
      </div>
      {children}
    </section>
  )
}

export interface BrandFieldsProps {
  borrador: BorradorDelEditor
  onCambio: (parcial: Partial<BorradorDelEditor>) => void
  /** true mientras se guarda, restablece o recarga: nada escrito ahí se perdería (Codex #5). */
  bloqueado: boolean
  logo: ReactNode
  hex: string
  onHex: (texto: string) => void
  hexInvalido: boolean
  onMuestra: (color: string | null) => void
}

export function BrandFields({ borrador, onCambio, bloqueado, logo, hex, onHex, hexInvalido, onMuestra }: BrandFieldsProps) {
  const { t } = useTranslation('customerDisplay')
  return (
    <Seccion
      icono={<Palette className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      titulo={t('editor.brand')}
      tour="customer-display-editor-brand"
    >
      {logo}
      <div className="space-y-2">
        <span className="text-sm font-medium">{t('editor.theme')}</span>
        <div className="flex">
          {/* Esquinas de 0.5rem y no de píldora: dentro de FullScreenModal todo <button> queda así (index.css,
              `[data-fsm-content] button`), y una cápsula con botones cuadrados por dentro se ve rota. */}
          <div className="inline-flex rounded-lg border border-border bg-muted/60 p-1" role="group" aria-label={t('editor.theme')}>
            {(['LIGHT', 'DARK'] as const).map(tema => (
              <button
                key={tema}
                type="button"
                aria-pressed={borrador.theme === tema}
                onClick={() => onCambio({ theme: tema })}
                disabled={bloqueado}
                className={cn(
                  'cursor-pointer rounded-md px-4 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-50',
                  borrador.theme === tema ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground',
                )}
                data-tour={tema === 'LIGHT' ? 'customer-display-editor-theme-light' : 'customer-display-editor-theme-dark'}
              >
                {t(tema === 'LIGHT' ? 'editor.themeLight' : 'editor.themeDark')}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <span className="text-sm font-medium">{t('editor.color')}</span>
        <div className="flex flex-wrap items-center gap-2">
          {MUESTRAS_DE_COLOR.map(m => {
            const elegida = borrador.accentColor === m.color
            return (
              <button
                key={m.clave}
                type="button"
                aria-pressed={elegida}
                aria-label={t(`editor.colors.${m.clave}`)}
                title={t(`editor.colors.${m.clave}`)}
                onClick={() => onMuestra(m.color)}
                disabled={bloqueado}
                className="group grid h-8 w-8 cursor-pointer place-items-center bg-transparent p-0 outline-none disabled:cursor-not-allowed disabled:opacity-50"
                data-tour={`customer-display-editor-color-${m.clave}`}
              >
                {/* El círculo es un <span>: dentro de FullScreenModal todo <button> queda con esquinas de 0.5rem
                    (index.css, `[data-fsm-content] button`, con !important) y la muestra saldría cuadrada. */}
                <span
                  aria-hidden="true"
                  className={cn(
                    'h-8 w-8 rounded-full border-2 border-background ring-1 ring-input group-focus-visible:ring-2 group-focus-visible:ring-ring',
                    elegida && 'ring-2 ring-foreground',
                  )}
                  // Las muestras son colores del APARATO (dato), no de la interfaz. «El de siempre» es el acento que la tablet
                  // usa sin color propio, y depende del tema elegido para ELLA (no del tema del dashboard).
                  style={{ backgroundColor: m.color ?? PALETA_DE_LA_TABLET[borrador.theme].acento }}
                />
              </button>
            )
          })}
          <Input
            value={hex}
            onChange={e => onHex(e.target.value)}
            disabled={bloqueado}
            maxLength={9}
            placeholder="#RRGGBB"
            aria-label={t('editor.hexLabel')}
            aria-invalid={hexInvalido}
            // Cabe en la misma línea que las muestras, como en el prototipo aprobado.
            className="h-12 w-28 font-mono text-base"
            data-tour="customer-display-editor-hex"
          />
        </div>
        {hexInvalido && <p className="text-xs text-destructive">{t('editor.hexInvalid')}</p>}
      </div>
    </Seccion>
  )
}

export function TextFields({
  borrador,
  onCambio,
  bloqueado,
}: {
  borrador: BorradorDelEditor
  onCambio: (parcial: Partial<BorradorDelEditor>) => void
  bloqueado: boolean
}) {
  const { t } = useTranslation('customerDisplay')
  const campos = [
    { clave: 'welcomeText', etiqueta: 'editor.welcome', defecto: 'preview.defaultWelcome', tour: 'customer-display-editor-welcome' },
    { clave: 'thanksText', etiqueta: 'editor.thanks', defecto: 'preview.defaultThanks', tour: 'customer-display-editor-thanks' },
  ] as const
  return (
    <Seccion
      icono={<Type className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      titulo={t('editor.texts')}
      tour="customer-display-editor-texts"
    >
      {campos.map(c => (
        <div key={c.clave} className="space-y-1.5">
          <Label htmlFor={`cd-${c.clave}`}>{t(c.etiqueta)}</Label>
          <Input
            id={`cd-${c.clave}`}
            value={borrador[c.clave]}
            // Se corta en 40 code points al escribir o pegar: el server rechaza lo largo (no lo recorta).
            onChange={e =>
              onCambio(
                c.clave === 'welcomeText' ? { welcomeText: limitarTexto(e.target.value) } : { thanksText: limitarTexto(e.target.value) },
              )
            }
            placeholder={t(c.defecto)}
            disabled={bloqueado}
            className="h-12 text-base"
            data-tour={c.tour}
          />
          <div className="flex justify-between gap-2 text-xs text-muted-foreground">
            <span>{t('editor.textEmptyHint', { text: t(c.defecto) })}</span>
            <span className="font-mono">{t('editor.counter', { count: contarCaracteres(borrador[c.clave]), max: MAX_TEXTO })}</span>
          </div>
        </div>
      ))}
    </Seccion>
  )
}

/**
 * Las promos en reposo son de F3 (carrusel, precio y fila Feature). Aquí se VEN, con su candado y «Próximamente», y se
 * explica en qué plan vendrán. 🔴 Sin botón de compra: no se vende algo que todavía no existe.
 */
export function PromosTeaser({ incluidas }: { incluidas: boolean }) {
  const { t } = useTranslation(['customerDisplay', 'common'])
  return (
    <Seccion
      icono={<Lock className="h-4 w-4 text-muted-foreground" aria-hidden="true" />}
      titulo={t('editor.promos')}
      tour="customer-display-editor-promos"
      extra={
        <>
          <VenueTierBadge tier="PRO" />
          <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
            {t('common:comingSoon')}
          </Badge>
        </>
      }
    >
      <div className="space-y-3 rounded-xl border border-dashed border-input bg-muted/40 p-4" aria-disabled="true">
        <span className="text-sm font-medium">{t('editor.promosSlots')}</span>
        <div className="grid grid-cols-4 gap-2" aria-hidden="true">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-[16/10] rounded-md border border-dashed border-input bg-card opacity-60" />
          ))}
        </div>
        <p className="text-xs text-muted-foreground">{t(incluidas ? 'editor.promosIncluded' : 'editor.promosPro')}</p>
      </div>
    </Seccion>
  )
}
