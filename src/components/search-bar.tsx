import { Input } from '@/components/ui/input'
import { Search } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import React from 'react'

type SearchBarProps = {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  placeholderKey?: string
  className?: string
  inputClassName?: string
  ariaLabelKey?: string
}

export function SearchBar({
  value,
  onChange,
  placeholder,
  placeholderKey,
  className,
  inputClassName,
  ariaLabelKey,
}: SearchBarProps) {
  const { t } = useTranslation()
  const finalPlaceholder = placeholder ?? (placeholderKey ? t(placeholderKey) : t('common.search'))
  const ariaLabel = ariaLabelKey ? t(ariaLabelKey) : finalPlaceholder

  return (
    <div className={`relative w-full max-w-2xl ${className ?? ''}`}>
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="text"
        placeholder={finalPlaceholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={`pl-9 bg-background border-input w-full ${inputClassName ?? ''}`}
      />
    </div>
  )
}

export default SearchBar

