/**
 * «Enviar Invitación» se habilita con `onValidChange`. Con `mode: 'onBlur'` el formulario seguía inválido mientras el último campo
 * tenía el foco: el clic en el botón sólo quitaba el foco y lo habilitaba, y ese clic ya no enviaba (D5, medido con ratón real).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'es' } }),
  initReactI18next: { type: '3rdParty', init: () => {} },
}))
vi.mock('@/context/AuthContext', () => ({
  useAuth: () => ({ user: { role: 'OWNER' }, staffInfo: { role: 'OWNER' }, allVenues: [] }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/hooks/use-role-config', () => ({
  useRoleConfig: () => ({ getDisplayName: (role: string) => role, isRoleActive: () => true }),
}))
vi.mock('@/hooks/useWhiteLabelConfig', () => ({ useWhiteLabelConfig: () => ({ isWhiteLabelEnabled: false, enabledFeatures: [] }) }))
vi.mock('@/services/team.service', () => ({ default: { inviteTeamMember: vi.fn() } }))
vi.mock('@/services/storesAnalysis.service', () => ({ getTeam: vi.fn() }))
vi.mock('@/services/superadmin-staff.service', () => ({ resetPassword: vi.fn() }))
vi.mock('../RoleAccessPreview', () => ({ RoleAccessPreview: () => null }))

import InviteTeamMemberForm from '../InviteTeamMemberForm'

function montar() {
  const onValidChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <InviteTeamMemberForm venueId="v1" onSuccess={() => undefined} onValidChange={onValidChange} />
    </QueryClientProvider>,
  )
  return onValidChange
}
const rol = async () => {
  await userEvent.click(document.querySelector('[data-tour="team-invite-role"]') as HTMLElement)
  await userEvent.click(await screen.findByRole('option', { name: /WAITER/ }))
}
const ultimo = <T,>(fn: { mock: { calls: T[][] } }) => fn.mock.calls[fn.mock.calls.length - 1]?.[0]

describe('Invitar: el botón se habilita sin que el último campo pierda el foco', () => {
  beforeEach(() => vi.clearAllMocks())

  it('Con correo: válido con el correo aún enfocado, sin un error a media escritura', async () => {
    const onValidChange = montar()
    await rol()
    await userEvent.type(document.querySelector('#firstName') as HTMLElement, 'Ana')
    await userEvent.type(document.querySelector('#lastName') as HTMLElement, 'Prueba')
    const correo = document.querySelector('#email') as HTMLElement
    await userEvent.type(correo, 'ana@')
    expect(screen.queryByText('invite.validation.emailFormat')).not.toBeInTheDocument()
    await userEvent.type(correo, 'example.com')
    expect(document.activeElement).toBe(correo)
    await waitFor(() => expect(ultimo(onValidChange)).toBe(true))
  })

  it('Solo TPV: válido con el PIN aún enfocado', async () => {
    const onValidChange = montar()
    await userEvent.click(screen.getByText('invite.typeTpvOnly'))
    await rol()
    await userEvent.type(document.querySelector('#firstName') as HTMLElement, 'Ana')
    await userEvent.type(document.querySelector('#lastName') as HTMLElement, 'Prueba')
    const pin = document.querySelector('#pin') as HTMLElement
    await userEvent.type(pin, '48213')
    expect(document.activeElement).toBe(pin)
    await waitFor(() => expect(ultimo(onValidChange)).toBe(true))
  })

  it('sigue inválido mientras falte un campo', async () => {
    const onValidChange = montar()
    await rol()
    await userEvent.type(document.querySelector('#firstName') as HTMLElement, 'Ana')
    await userEvent.type(document.querySelector('#email') as HTMLElement, 'ana@example.com')
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(ultimo(onValidChange)).toBe(false)
  })
})
