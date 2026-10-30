import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/services/auth.service', () => ({
  validateResetToken: () => Promise.resolve({ valid: true, email: 'a@test.mx' }),
  resetPassword: vi.fn(),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/theme-toggle', () => ({ ThemeToggle: () => null }))
vi.mock('@/components/language-switcher', () => ({ default: () => null }))
vi.mock('react-i18next', () => {
  const t = (k: string) => k
  const translation = { t, i18n: { language: 'es' } }
  return { useTranslation: () => translation }
})

import ResetPassword from '../ResetPassword'

describe('ResetPassword: requisitos de contraseña', () => {
  it('sólo pide 8 caracteres: ya no muestra mayúscula, minúscula, número ni símbolo', async () => {
    render(
      <MemoryRouter initialEntries={['/auth/reset-password/tok']}>
        <Routes>
          <Route path="/auth/reset-password/:token" element={<ResetPassword />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(await screen.findByText('resetPassword.requirementMinLength')).toBeInTheDocument()
    for (const k of ['Uppercase', 'Lowercase', 'Number', 'Special']) {
      expect(screen.queryByText(`resetPassword.requirement${k}`)).not.toBeInTheDocument()
    }
  })
})
