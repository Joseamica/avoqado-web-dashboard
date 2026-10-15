import { Loader2, Upload } from 'lucide-react'
import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { TIPOS_DE_IMAGEN } from './model'

export interface LogoFieldProps {
  modo: 'negocio' | 'propio'
  onModo: (modo: 'negocio' | 'propio') => void
  hayLogoPropio: boolean
  subiendo: boolean
  /** Guardando, restableciendo o recargando: el logo no se cambia. */
  bloqueado: boolean
  error: string | null
  rechazado: boolean
  onArchivo: (archivo: File) => void
}

/**
 * El logo: el del negocio (heredado) u otro que se sube por el SERVER (nunca directo a Firebase, spec §5.4).
 * 🔴 Mientras sube, «El logo de tu negocio» se deshabilita: una subida tardía no puede contradecir lo elegido (Codex #6).
 */
export function LogoField({ modo, onModo, hayLogoPropio, subiendo, bloqueado, error, rechazado, onArchivo }: LogoFieldProps) {
  const { t } = useTranslation('customerDisplay')
  const entrada = useRef<HTMLInputElement>(null)
  return (
    <div className="space-y-2" data-tour="customer-display-editor-logo">
      <span className="text-sm font-medium">{t('editor.logo')}</span>
      <RadioGroup value={modo} onValueChange={v => onModo(v as 'negocio' | 'propio')} disabled={bloqueado} className="gap-2">
        <div className="flex items-center gap-2">
          <RadioGroupItem
            value="negocio"
            id="cd-logo-negocio"
            disabled={subiendo || bloqueado}
            data-tour="customer-display-editor-logo-venue"
          />
          <Label htmlFor="cd-logo-negocio" className="cursor-pointer font-normal">
            {t('editor.logoVenue')}
          </Label>
        </div>
        <div className="flex items-center gap-2">
          <RadioGroupItem value="propio" id="cd-logo-propio" data-tour="customer-display-editor-logo-own" />
          <Label htmlFor="cd-logo-propio" className="cursor-pointer font-normal">
            {t('editor.logoOwn')}
          </Label>
        </div>
      </RadioGroup>
      {modo === 'propio' && (
        <div className="space-y-1.5 pl-6">
          <input
            ref={entrada}
            type="file"
            accept={TIPOS_DE_IMAGEN.join(',')}
            className="sr-only"
            data-testid="customer-display-logo-input"
            onChange={e => {
              const archivo = e.target.files?.[0]
              e.target.value = ''
              if (archivo) onArchivo(archivo)
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="cursor-pointer"
            onClick={() => entrada.current?.click()}
            disabled={subiendo || bloqueado}
            data-tour="customer-display-editor-logo-upload"
          >
            {subiendo ? (
              <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            ) : (
              <Upload className="mr-2 h-3.5 w-3.5" aria-hidden="true" />
            )}
            {subiendo ? t('editor.logoUploading') : t(hayLogoPropio ? 'editor.logoReplace' : 'editor.logoPick')}
          </Button>
          {hayLogoPropio && !subiendo && !error && !rechazado && <p className="text-xs text-muted-foreground">{t('editor.logoReady')}</p>}
          <p className="text-xs text-muted-foreground">{t('editor.logoHelp')}</p>
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          {rechazado && (
            <p role="alert" className="text-xs text-destructive">
              {t('editor.assetRejected')}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
