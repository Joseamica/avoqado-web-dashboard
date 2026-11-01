import { useTranslation } from 'react-i18next'
import { Checkbox } from '@/components/ui/checkbox'

export type DondeSeUsa = { appliesToDevices: boolean; appliesToOnline: boolean }

export function DondeSeUsaField({
  value,
  onChange,
  tieneHorario,
}: {
  value: DondeSeUsa
  onChange: (v: DondeSeUsa) => void
  tieneHorario: boolean
}) {
  const { t } = useTranslation('menu')
  const base = 'menus.dondeSeUsa'
  const items = [
    { key: 'appliesToDevices' as const, label: t(`${base}.aparatos`), hint: t(`${base}.pistaAparatos`) },
    { key: 'appliesToOnline' as const, label: t(`${base}.tiendaEnLinea`), hint: t(`${base}.pistaTienda`) },
  ]
  const soloUna = value.appliesToDevices !== value.appliesToOnline

  return (
    <div className="space-y-3" data-tour="menu-donde-se-usa">
      <p className="text-sm font-semibold">{t(`${base}.title`)}</p>
      {items.map(({ key, label, hint }) => {
        const bloqueada = soloUna && value[key]
        const id = `donde-se-usa-${key}`
        return (
          <div key={key} className="flex items-start gap-2">
            <Checkbox
              id={id}
              checked={value[key]}
              disabled={bloqueada}
              title={bloqueada ? t(`${base}.alMenosUna`) : undefined}
              onCheckedChange={checked => onChange({ ...value, [key]: checked === true })}
              className="mt-0.5"
            />
            <label htmlFor={id} className="text-sm leading-tight">
              {label}
              <span className="block text-xs text-muted-foreground">{hint}</span>
            </label>
          </div>
        )
      })}
      {tieneHorario && !value.appliesToOnline && <p className="text-xs text-muted-foreground">{t(`${base}.avisoHorario`)}</p>}
    </div>
  )
}
