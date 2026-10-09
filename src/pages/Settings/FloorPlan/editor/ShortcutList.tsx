import { Fragment } from 'react'
import { useTranslation } from 'react-i18next'
import { MOD_KEY } from './useEditorShortcuts'

/** Una tecla, o (`{ text }`) un gesto del ratón que no es tecla: «clic», «arrastrar». */
type Key = string | { text: string }

function Keys({ keys }: { keys: Key[] }) {
  return (
    <span className="flex shrink-0 items-center gap-1">
      {keys.map((k, i) => (
        <Fragment key={i}>
          {typeof k !== 'string' ? (
            <span className="text-xs text-muted-foreground">{k.text}</span>
          ) : k === '+' ? (
            <span className="text-xs text-muted-foreground">+</span>
          ) : (
            <kbd className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-input bg-background px-1.5 font-sans text-[11px] font-medium text-foreground shadow-[0_1px_0_0_var(--border)]">
              {k}
            </kbd>
          )}
        </Fragment>
      ))}
    </span>
  )
}

/** Atajos del editor como teclas de verdad, no como texto corrido: se reconocen de un vistazo. */
export function ShortcutList() {
  const { t } = useTranslation('floorPlan')
  const rows: Array<{ label: string; keys: Key[] }> = [
    { label: t('shortcuts.selectMany'), keys: [t('keys.shift'), '+', { text: t('keys.click') }] },
    { label: t('shortcuts.move'), keys: ['←', '↑', '↓', '→'] },
    { label: t('shortcuts.moveFast'), keys: [t('keys.shift'), '+', '→'] },
    { label: t('shortcuts.rotate'), keys: ['R'] },
    { label: t('shortcuts.duplicate'), keys: [MOD_KEY, '+', 'D'] },
    { label: t('shortcuts.remove'), keys: [t('keys.delete')] },
    { label: t('shortcuts.undo'), keys: [MOD_KEY, '+', 'Z'] },
    { label: t('shortcuts.pan'), keys: [t('keys.space'), '+', { text: t('keys.drag') }] },
  ]
  return (
    <section className="space-y-3" aria-labelledby="floor-shortcuts-title" data-tour="floor-plan-shortcuts">
      <h3 id="floor-shortcuts-title" className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {t('shortcuts.title')}
      </h3>
      <dl className="space-y-2.5 text-sm">
        {rows.map(r => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <dt className="text-foreground">{r.label}</dt>
            <dd>
              <Keys keys={r.keys} />
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
