import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import BaseIvaSwitch from '../components/BaseIvaSwitch'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

describe('BaseIvaSwitch (decisión D5 enmendada, spec §9-1)', () => {
  // G4 (guía E6c): el interruptor APAGADO junto a «Sin IVA» se leía como «sin IVA: no». Con interruptor, la etiqueta es la ACCIÓN
  // («Calcular con IVA»: apagado = sin IVA, el de fábrica) y debajo dice cómo está AHORA. Mismo valor guardado (`includeTax`).
  it('🔴 con interruptor, la etiqueta es la acción «Calcular con IVA» y debajo «Ahora: sin IVA» / «Ahora: con IVA»', () => {
    const { rerender } = render(<BaseIvaSwitch id="iva" checked={false} onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'wizard.step2.taxBaseAction' })).not.toBeChecked()
    expect(screen.getByText('wizard.step2.taxBaseNowWithout')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.taxBaseWithoutHint')).toBeInTheDocument()
    expect(screen.queryByText('wizard.step2.taxBaseWithout')).toBeNull()
    rerender(<BaseIvaSwitch id="iva" checked onChange={() => {}} />)
    expect(screen.getByRole('switch', { name: 'wizard.step2.taxBaseAction' })).toBeChecked()
    expect(screen.getByText('wizard.step2.taxBaseNowWith')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.taxBaseWithHint')).toBeInTheDocument()
    expect(screen.queryByText('wizard.step2.taxBaseWith')).toBeNull()
  })

  it('sin interruptor (la ficha del esquema) dice la base vigente: «Sin IVA» o «Con IVA», nunca la acción', () => {
    const { rerender } = render(<BaseIvaSwitch id="iva" checked={false} />)
    expect(screen.getByText('wizard.step2.taxBaseWithout')).toBeInTheDocument()
    expect(screen.getByText('wizard.step2.taxBaseWithoutHint')).toBeInTheDocument()
    expect(screen.queryByText('wizard.step2.taxBaseAction')).toBeNull()
    rerender(<BaseIvaSwitch id="iva" checked />)
    expect(screen.getByText('wizard.step2.taxBaseWith')).toBeInTheDocument()
    expect(screen.queryByText('wizard.step2.taxBaseAction')).toBeNull()
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
