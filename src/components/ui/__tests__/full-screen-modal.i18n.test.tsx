/**
 * Codex F1 #5 (15-oct-2026): la X de FullScreenModal decía «Cerrar» fijo, también con la app en inglés. Ahora usa
 * `common:close`. Se prueba con una instancia REAL de i18next (no un `t` fingido): así se ve el nombre accesible que oye
 * un lector de pantalla en cada idioma, y que la llave existe de verdad (el lint de llaves no ve las que llevan namespace).
 */
import { render, screen } from '@testing-library/react'
import i18next from 'i18next'
import { I18nextProvider, initReactI18next } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import commonEn from '@/locales/en/common.json'
import commonEs from '@/locales/es/common.json'
import { FullScreenModal } from '../full-screen-modal'

async function pintar(lng: 'es' | 'en') {
  const i18n = i18next.createInstance()
  await i18n.use(initReactI18next).init({
    lng,
    ns: ['common'],
    defaultNS: 'common',
    resources: { es: { common: commonEs }, en: { common: commonEn } },
    interpolation: { escapeValue: false },
  })
  render(
    <I18nextProvider i18n={i18n}>
      <FullScreenModal open onClose={() => {}} title="Editor">
        <p>contenido</p>
      </FullScreenModal>
    </I18nextProvider>,
  )
}

describe('FullScreenModal — la X se nombra en el idioma de la app', () => {
  it.each([
    ['es', 'Cerrar'],
    ['en', 'Close'],
  ] as const)('%s: «%s»', async (lng, nombre) => {
    await pintar(lng)
    expect(screen.getByRole('button', { name: nombre })).toBeInTheDocument()
  })
})
