import type { Dispatch, SetStateAction } from 'react'
import { useTranslation } from 'react-i18next'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { useAccess } from '@/hooks/use-access'
import { Currency } from '@/utils/currency'
import { BONO_MAX, HORAS_MAX, type ErrorRegla, type ReglasForm } from '../reglas'

/**
 * Las reglas de clase de la tabla (spec §6.6): suplencia con poco aviso y cancelación tardía. Apagadas de fábrica; se
 * publican con la tabla (cambiarlas es publicar otra versión). Los campos son texto: se pueden vaciar. Sin
 * `staffpay:manage` se ven pero no se mueven, y se dice por qué (E4-fix: «Guardar tabla» ya no aparece sin ese permiso).
 */
export function ReglasDeClase({
  reglas,
  errores,
  onChange,
  onTocar,
}: {
  reglas: ReglasForm
  /** Los errores que se DICEN (`erroresVisibles`): no los de un campo vacío que todavía no se deja. */
  errores: ErrorRegla[]
  onChange: Dispatch<SetStateAction<ReglasForm>>
  /** Al salir de un campo: desde ahí su error se dice aunque esté vacío (E6a-fix F12). */
  onTocar?: (campo: ErrorRegla) => void
}) {
  const { t } = useTranslation('staffPay')
  const { can } = useAccess()
  const bloqueado = !can('staffpay:manage')
  return (
    <fieldset className="space-y-3 rounded-lg border border-input p-3" data-tour="staffpay-rules">
      <legend className="px-1 text-sm font-medium">{t('rules.title')}</legend>
      <p className="text-xs text-muted-foreground">{t('rules.help')}</p>
      {bloqueado && <p className="text-xs text-muted-foreground">{t('rules.noPermission')}</p>}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <Switch
            id="staffpay-regla-suplencia"
            checked={reglas.suplencia}
            onCheckedChange={v => onChange(r => ({ ...r, suplencia: v }))}
            disabled={bloqueado}
            className="cursor-pointer"
            data-tour="staffpay-rule-cover"
          />
          <Label htmlFor="staffpay-regla-suplencia">{t('rules.cover')}</Label>
        </div>
        {reglas.suplencia && (
          <div className="flex flex-wrap items-center gap-2 text-sm sm:pl-12">
            <span>{t('rules.coverPrefix')}</span>
            <Input
              aria-label={t('rules.coverHours')}
              type="number"
              min={1}
              max={HORAS_MAX}
              className="w-20"
              value={reglas.coverBonusHours}
              disabled={bloqueado}
              aria-invalid={errores.includes('coverHours')}
              onChange={e => onChange(r => ({ ...r, coverBonusHours: e.target.value }))}
              onBlur={() => onTocar?.('coverHours')}
            />
            <span>{t('rules.coverMiddle')}</span>
            {/* Con su «$» delante (QA H14): «cobra su nivel más [$ 100]», no un número suelto. */}
            <div className="relative">
              <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                $
              </span>
              <Input
                aria-label={t('rules.coverAmount')}
                type="number"
                min={0}
                step="0.01"
                className="w-28 pl-6"
                value={reglas.coverBonusAmount}
                disabled={bloqueado}
                aria-invalid={errores.includes('coverAmount')}
                onChange={e => onChange(r => ({ ...r, coverBonusAmount: e.target.value }))}
                onBlur={() => onTocar?.('coverAmount')}
              />
            </div>
          </div>
        )}
        <div className="flex items-center gap-3">
          <Switch
            id="staffpay-regla-cancelacion"
            checked={reglas.cancelacion}
            onCheckedChange={v => onChange(r => ({ ...r, cancelacion: v }))}
            disabled={bloqueado}
            className="cursor-pointer"
            data-tour="staffpay-rule-late-cancel"
          />
          <Label htmlFor="staffpay-regla-cancelacion">{t('rules.lateCancel')}</Label>
        </div>
        {reglas.cancelacion && (
          <div className="flex flex-wrap items-center gap-2 text-sm sm:pl-12">
            <span>{t('rules.latePrefix')}</span>
            <Input
              aria-label={t('rules.lateHours')}
              type="number"
              min={1}
              max={HORAS_MAX}
              className="w-20"
              value={reglas.lateCancelHours}
              disabled={bloqueado}
              aria-invalid={errores.includes('lateHours')}
              onChange={e => onChange(r => ({ ...r, lateCancelHours: e.target.value }))}
              onBlur={() => onTocar?.('lateHours')}
            />
            <span>{t('rules.lateSuffix')}</span>
          </div>
        )}
      </div>
      {errores.length > 0 && (
        <p role="alert" className="text-sm text-destructive">
          {errores.map(e => t(`rules.error.${e}`, { max: e === 'coverAmount' ? Currency(BONO_MAX) : HORAS_MAX })).join(' ')}
        </p>
      )}
    </fieldset>
  )
}
