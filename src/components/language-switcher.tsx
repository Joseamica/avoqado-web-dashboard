import React from 'react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Button } from '@/components/ui/button'

const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation()
  const current = i18n.language?.startsWith('en') ? 'en' : 'es'

  const options: Array<{ lng: 'es' | 'en'; label: string; flag: string }> = [
    { lng: 'es', label: 'Español', flag: '🇪🇸' },
    { lng: 'en', label: 'English', flag: '🇬🇧' },
  ]

  const changeLang = (lng: 'es' | 'en') => {
    i18n.changeLanguage(lng)
    localStorage.setItem('lang', lng)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="px-3 flex items-center gap-2">
          <span>{options.find(o => o.lng === current)?.flag}</span>
          <span className="font-medium uppercase">{current}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {options.map(opt => (
          <DropdownMenuItem key={opt.lng} onClick={() => changeLang(opt.lng)}>
            <span className="mr-2">{opt.flag}</span>
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default LanguageSwitcher
