import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BaseIvaSwitch from '../components/BaseIvaSwitch'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('BaseIvaSwitch (decisión D5 enmendada, spec §9-1)', () => {
  it('apagado dice «Sin IVA» y por qué; prendido, «Con IVA»', () => {
    const { rerender } = render(<BaseIvaSwitch id="iva" checked={false} onChange={() => {}} />)
    expect(screen.getByText('wizard.step2.taxBaseWithout')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.taxBaseWithoutHint')).toBeInTheDocument()
    rerender(<BaseIvaSwitch id="iva" checked onChange={() => {}} />)
    expect(screen.getByText('wizard.step2.taxBaseWith')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.taxBaseWithHint')).toBeInTheDocument()
  })

  it('el interruptor cambia la base; sin onChange (la ficha del esquema) sólo se lee', () => {
    const onChange = vi.fn()
    const { rerender } = render(<BaseIvaSwitch id="iva" checked={false} onChange={onChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(onChange).toHaveBeenCalledWith(true)
    rerender(<BaseIvaSwitch id="iva" checked={false} />)
    expect(screen.queryByRole('switch')).toBeNull()
  })
})
