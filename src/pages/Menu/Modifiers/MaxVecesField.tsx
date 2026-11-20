import type { Control, FieldValues, Path } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'

/**
 * «Veces que se puede elegir» de UNA opción en un grupo que deja repetir (encargo a508f4, como el «max.» por opción de Fudo).
 * Vacío = hasta el máximo del grupo (se guarda `null`). Sólo se muestra si el grupo deja repetir: en los demás no cuenta.
 */
export function MaxVecesField<T extends FieldValues>({ control, name }: { control: Control<T>; name: Path<T> }) {
  const { t } = useTranslation('menu')
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem data-tour="modifier-max-quantity">
          <FormLabel>{t('modifiers.repeat.maxQuantity')}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              max={99}
              className="h-12 text-base"
              placeholder={t('modifiers.repeat.maxQuantityPlaceholder')}
              value={field.value ?? ''}
              onChange={e => {
                const v = e.target.value.trim()
                if (v === '') return field.onChange(null)
                const n = parseInt(v, 10)
                field.onChange(Number.isFinite(n) ? n : null)
              }}
              onBlur={field.onBlur}
              name={field.name}
              ref={field.ref}
            />
          </FormControl>
          <FormDescription>{t('modifiers.repeat.maxQuantityDesc')}</FormDescription>
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
