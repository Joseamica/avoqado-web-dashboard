import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { useUpdateGiftCardSettings } from '@/hooks/use-gift-cards'
import { useToast } from '@/hooks/use-toast'
import {
  MINIMO_POR_SOBRE,
  TOPE_POR_TARJETA,
  VIGENCIAS,
  borradorDesde,
  avisoDeError,
  validarReglas,
  type BorradorDeReglas,
  type VigenciaElegida,
} from '@/pages/GiftCards/giftCardText'
import { Currency } from '@/utils/currency'
import type { GiftCardSettingsView } from '@/types/giftCard'

/**
 * Montos sugeridos, mínimo, máximo y vigencia (spec §4.3). Aplica a lo que se venda DESDE AHORA: cada tarjeta vendida
 * conserva la vigencia y los términos que se le enseñaron al cliente (el server los congela en el sobre).
 * Campos de texto con teclado decimal, no `type=number`: se pueden vaciar sin que el valor rebote («Clearable Number
 * Inputs», ui-patterns.md). Mismas reglas que el server (A5, `validarReglas`), que vuelve a validar.
 * Guardar NUNCA manda `enabled` (nota 6): un negocio que bajó de plan sigue pudiendo guardar sus montos.
 */
export function GiftCardRulesForm({
  venueId,
  settings,
  canManage,
}: {
  venueId: string
  settings: GiftCardSettingsView
  canManage: boolean
}) {
  const { t } = useTranslation('giftCards')
  const { toast } = useToast()
  const update = useUpdateGiftCardSettings(venueId)
  const guardado = useMemo(() => borradorDesde(settings), [settings])
  const [borrador, setBorrador] = useState<BorradorDeReglas>(guardado)
  const [base, setBase] = useState(guardado)
  const [intentado, setIntentado] = useState(false)
  // Lo guardado cambió (otra sesión, o el switch): un borrador SIN editar lo sigue; uno editado se respeta (lote ⭐).
  // Ajuste durante el render (patrón de React para «el valor anterior»), sin un render de más con los montos viejos.
  if (base !== guardado) {
    setBase(guardado)
    if (JSON.stringify(borrador) === JSON.stringify(base)) setBorrador(guardado)
  }
  const cambio = JSON.stringify(borrador) !== JSON.stringify(guardado)
  const resultado = validarReglas(borrador)
  // `=== false` y no `!ok`: con `strict: false` la negación no estrecha la unión.
  const error = intentado && resultado.ok === false ? resultado.error : null

  const ponerSugerido = (i: 0 | 1 | 2, valor: string) =>
    setBorrador(b => {
      const sugeridos = [...b.sugeridos] as BorradorDeReglas['sugeridos']
      sugeridos[i] = valor
      return { ...b, sugeridos }
    })

  const guardar = async () => {
    setIntentado(true)
    if (!resultado.ok || update.isPending || !canManage) return
    try {
      const nuevo = await update.mutateAsync(resultado.input)
      // Lo que quedó guardado (ordenado, sin repetidos) vuelve al formulario: «Guardar» se apaga hasta el próximo cambio.
      setBorrador(borradorDesde(nuevo))
      setIntentado(false)
      toast({ title: t('settings.rules.saved') })
    } catch (err) {
      // Sólo el texto de un error CON `code` (nota 12). Las negativas de validación del server no traen código, pero
      // `validarReglas` ya atajó esos mismos casos antes de mandar.
      toast({
        title: t('settings.rules.saveError'),
        description: avisoDeError(err, t),
        variant: 'destructive',
      })
    }
  }

  const campoDeMonto = (id: string, etiqueta: string, valor: string, poner: (v: string) => void, tour: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{etiqueta}</Label>
      <div className="relative">
        <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
        <Input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={valor}
          onChange={e => poner(e.target.value)}
          className="pl-6"
          data-tour={tour}
        />
      </div>
    </div>
  )

  return (
    <div className="rounded-2xl border border-input bg-card p-6" data-tour="gift-card-rules">
      <h2 className="text-base font-semibold">{t('settings.rules.title')}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{t('settings.rules.description')}</p>

      <fieldset disabled={!canManage || update.isPending} className="mt-5 space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.rules.suggested')}</p>
          <p className="text-xs text-muted-foreground">{t('settings.rules.suggestedHint')}</p>
          <div className="grid grid-cols-3 gap-2">
            {([0, 1, 2] as const).map(i => (
              <div key={i} className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">$</span>
                <Input
                  inputMode="decimal"
                  autoComplete="off"
                  aria-label={t('settings.rules.suggestedN', { n: i + 1 })}
                  value={borrador.sugeridos[i]}
                  onChange={e => ponerSugerido(i, e.target.value)}
                  className="pl-6"
                  data-tour={`gift-card-suggested-${i + 1}`}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="grid gap-4 sm:grid-cols-2">
            {campoDeMonto(
              'gift-card-min',
              t('settings.rules.min'),
              borrador.minimo,
              v => setBorrador(b => ({ ...b, minimo: v })),
              'gift-card-min',
            )}
            {campoDeMonto(
              'gift-card-max',
              t('settings.rules.max'),
              borrador.maximo,
              v => setBorrador(b => ({ ...b, maximo: v })),
              'gift-card-max',
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {t('settings.rules.limitsHint', { floor: Currency(MINIMO_POR_SOBRE), cap: Currency(TOPE_POR_TARJETA) })}
          </p>
        </div>

        <div className="space-y-2">
          <p className="text-sm font-medium">{t('settings.rules.validity')}</p>
          <RadioGroup
            value={borrador.vigencia}
            onValueChange={v => setBorrador(b => ({ ...b, vigencia: v as VigenciaElegida }))}
            aria-label={t('settings.rules.validity')}
            className="gap-2"
            data-tour="gift-card-validity"
          >
            {VIGENCIAS.map(v => (
              <div key={v} className="flex items-center gap-2">
                <RadioGroupItem id={`gift-card-validity-${v}`} value={v} />
                <Label htmlFor={`gift-card-validity-${v}`} className="cursor-pointer font-normal">
                  {t(`settings.rules.validityOption.${v}`)}
                </Label>
              </div>
            ))}
          </RadioGroup>
          <p className="text-xs text-muted-foreground">{t('settings.rules.validityHint')}</p>
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mt-4 text-sm text-destructive">
          {t(error.key, {
            amount: Currency(error.amount ?? 0),
            min: Currency(error.min ?? 0),
            max: Currency(error.max ?? 0),
          })}
        </p>
      )}

      {canManage && (
        <div className="mt-6 flex justify-end">
          <Button onClick={() => void guardar()} disabled={!cambio || update.isPending} data-tour="gift-card-rules-save">
            {update.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            {t('settings.rules.save')}
          </Button>
        </div>
      )}
    </div>
  )
}
