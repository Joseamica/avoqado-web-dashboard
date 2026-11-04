import { beforeAll, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import i18n from '@/i18n'
import { PermissionToggle } from '../PermissionToggle'

const base = { isDefault: true, isCritical: false, onChange: () => {} }

describe('PermissionToggle en pantalla angosta', () => {
  beforeAll(async () => {
    await i18n.changeLanguage('es')
  })

  it('enseña el mismo texto que el panel y que el buscador', () => {
    render(<PermissionToggle {...base} permission="giftCards:enable" isEnabled={false} />)
    expect(screen.getByText('Prender y apagar las tarjetas de regalo')).toBeInTheDocument()
  })

  it('dice en qué permiso viene incluido, a la vista', () => {
    render(<PermissionToggle {...base} permission="giftCards:read" isEnabled impliedBy="giftCards:manage" />)
    expect(screen.getByText(/incluido en Ajustar, bloquear, reponer y cancelar tarjetas de regalo/)).toBeInTheDocument()
    expect(screen.queryByText(/giftCards:manage/)).not.toBeInTheDocument()
  })
})
