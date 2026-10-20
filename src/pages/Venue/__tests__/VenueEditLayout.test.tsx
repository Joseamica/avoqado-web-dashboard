import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

const m = vi.hoisted(() => ({ denied: [] as string[], role: 'ADMIN' }))

vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => !m.denied.includes(p), role: m.role }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ fullBasePath: '/venues/taqueria' }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: ({ title }: { title: string }) => <h1>{title}</h1> }))

import VenueEditLayout from '../VenueEditLayout'

const pintar = () =>
  render(
    <MemoryRouter initialEntries={['/venues/taqueria/settings/local/basic-info']}>
      <VenueEditLayout />
    </MemoryRouter>,
  )

beforeEach(() => {
  m.denied = []
  m.role = 'ADMIN'
})

describe('VenueEditLayout — pestaña «Aviso de privacidad»', () => {
  it('con marketing:manage se ve la pestaña y lleva a settings/local/privacy', () => {
    pintar()
    expect(screen.getByRole('link', { name: 'edit.nav.privacy' })).toHaveAttribute('href', '/venues/taqueria/settings/local/privacy')
  })

  it('sin marketing:manage no se ve (la ruta tampoco lo dejaría pasar)', () => {
    m.denied = ['marketing:manage']
    pintar()
    expect(screen.queryByRole('link', { name: 'edit.nav.privacy' })).toBeNull()
    expect(screen.getByRole('link', { name: 'edit.nav.basicInfo' })).toBeInTheDocument()
  })
})
