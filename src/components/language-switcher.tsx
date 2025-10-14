import React from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type SupportedLanguage = 'es' | 'en'

const FlagIcon: React.FC<{ code: SupportedLanguage; className?: string }> = ({ code, className }) => {
  if (code === 'es') {
    return (
      <span className={cn('inline-flex items-center', className)} aria-hidden="true">
        <svg viewBox="0 0 24 16" width="24" height="16" role="img" aria-label="Bandera de España">
          <rect width="24" height="16" fill="#AA151B" rx="2" />
          <rect y="4" width="24" height="8" fill="#F1BF00" />
        </svg>
      </span>
    )
  }

  return (
    <span className={cn('inline-flex items-center', className)} aria-hidden="true">
      <svg viewBox="0 0 24 16" width="24" height="16" role="img" aria-label="Flag of the United Kingdom">
        <rect width="24" height="16" fill="#012169" rx="2" />
        <path d="M0 0 L9 6 H11 L2 0 Z M24 0 L15 6 H13 L22 0 Z M0 16 L9 10 H11 L2 16 Z M24 16 L15 10 H13 L22 16 Z" fill="#FFFFFF" />
        <path d="M10 6 H0 V10 H10 V16 H14 V10 H24 V6 H14 V0 H10 Z" fill="#FFFFFF" />
        <path d="M11 0 H13 V7 H24 V9 H13 V16 H11 V9 H0 V7 H11 Z" fill="#C8102E" />
        <path d="M0 1.5 L9.5 7.5 H12 L2.5 1.5 Z M24 1.5 L14.5 7.5 H12 L21.5 1.5 Z M0 14.5 L9.5 8.5 H12 L2.5 14.5 Z M24 14.5 L14.5 8.5 H12 L21.5 14.5 Z" fill="#C8102E" />
      </svg>
    </span>
  )
}

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation()
  const current: SupportedLanguage = i18n.language?.startsWith('en') ? 'en' : 'es'

  const options: Array<{ lng: SupportedLanguage; label: string }> = [
    { lng: 'es', label: 'Español' },
    { lng: 'en', label: 'English' },
  ]

  const changeLang = (lng: SupportedLanguage) => {
    i18n.changeLanguage(lng)
    localStorage.setItem('lang', lng)
  }

  const currentOption = options.find(o => o.lng === current) ?? options[0]

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="px-3 flex items-center gap-2" aria-label={currentOption.label}>
          <FlagIcon code={currentOption.lng} />
          <span className="sr-only">{currentOption.label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(opt => (
          <DropdownMenuItem key={opt.lng} onClick={() => changeLang(opt.lng)} className="flex items-center gap-2">
            <FlagIcon code={opt.lng} />
            <span>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
