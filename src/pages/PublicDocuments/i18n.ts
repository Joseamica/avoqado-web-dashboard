import { createInstance } from 'i18next'
import { initReactI18next } from 'react-i18next'
import es from '@/locales/es/publicDocuments.json'
import en from '@/locales/en/publicDocuments.json'

// An isolated instance keeps this entry independent from dashboard/auth bootstraps.
const i18n = createInstance()
void i18n.use(initReactI18next).init({
  resources: { es: { publicDocuments: es }, en: { publicDocuments: en } },
  lng: navigator.language.startsWith('en') ? 'en' : 'es',
  fallbackLng: 'es',
  defaultNS: 'publicDocuments',
  interpolation: { escapeValue: false },
  initImmediate: false,
})
export default i18n
