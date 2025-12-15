import { es as localeEs, fr as localeFr, enUS as localeEn } from 'date-fns/locale'

export function getIntlLocale(lang?: string): 'es-MX' | 'en-US' | 'fr-FR' {
  if (!lang) return 'es-MX'
  if (lang.startsWith('fr')) return 'fr-FR'
  if (lang.startsWith('en')) return 'en-US'
  return 'es-MX'
}

export function getDateFnsLocale(lang?: string) {
  if (!lang) return localeEs
  if (lang.startsWith('fr')) return localeFr
  if (lang.startsWith('en')) return localeEn
  return localeEs
}

