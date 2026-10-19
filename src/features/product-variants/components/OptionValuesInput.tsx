import { X } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Badge } from '@/components/ui/badge'

interface Props {
  values: string[]
  onChange: (values: string[]) => void
  disabled?: boolean
  placeholder?: string
  'aria-label': string
}

/** Valores de una opción como fichas: Enter o coma agrega; Retroceso en vacío quita el último; pegar «S, M, L» agrega tres. */
export function OptionValuesInput({ values, onChange, disabled, placeholder, 'aria-label': ariaLabel }: Props) {
  const { t } = useTranslation('variants')
  const [texto, setTexto] = useState('')
  const agregar = (raw: string) => {
    const nuevos = raw.split(',').map(s => s.trim()).filter(Boolean)
    setTexto('')
    if (nuevos.length) onChange([...values, ...nuevos]) // repetidos y espacios los limpia limpiarOpciones
  }
  return (
    <div className="flex min-h-12 flex-wrap items-center gap-2 rounded-md border border-input px-3 py-2">
      {values.map((v, i) => (
        <Badge key={`${v}-${i}`} variant="secondary" className="gap-1 text-sm">
          {v}
          <button
            type="button"
            className="cursor-pointer rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t('opciones.quitarValor', { name: v })}
            disabled={disabled}
            onClick={() => onChange(values.filter((_, j) => j !== i))}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}
      {/* `data-por-confirmar`: lo escrito aquí todavía no es ficha; quien escucha Esc (Radix, en captura) lo reconoce para no cerrar. */}
      <input
        className="min-w-24 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground"
        aria-label={ariaLabel}
        data-por-confirmar=""
        value={texto}
        disabled={disabled}
        placeholder={values.length ? '' : placeholder}
        onChange={e => (e.target.value.includes(',') ? agregar(e.target.value) : setTexto(e.target.value))}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.preventDefault()
            agregar(texto)
          } else if (e.key === 'Backspace' && !texto && values.length) onChange(values.slice(0, -1))
        }}
        onBlur={() => agregar(texto)}
      />
    </div>
  )
}
