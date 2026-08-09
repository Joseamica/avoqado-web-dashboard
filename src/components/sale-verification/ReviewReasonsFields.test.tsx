import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ReviewReasonsFields, isPromoterFeedbackValid } from './ReviewReasonsFields'

describe('isPromoterFeedbackValid', () => {
  it('rechaza vacío, espacios y menos de 5 caracteres', () => {
    expect(isPromoterFeedbackValid('')).toBe(false)
    expect(isPromoterFeedbackValid('     ')).toBe(false)
    expect(isPromoterFeedbackValid('mal')).toBe(false)
  })

  it('acepta 5 caracteres o más', () => {
    expect(isPromoterFeedbackValid('ilegible')).toBe(true)
  })
})

describe('ReviewReasonsFields', () => {
  it('marca las observaciones como obligatorias', () => {
    render(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={vi.fn()} />)
    expect(screen.getByText(/observaciones/i)).toBeInTheDocument()
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('muestra el error sólo cuando showError está activo', () => {
    const { rerender } = render(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={vi.fn()} />)
    expect(screen.queryByText(/mínimo 5 caracteres/i)).not.toBeInTheDocument()

    rerender(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={vi.fn()} showError />)
    expect(screen.getByText(/mínimo 5 caracteres/i)).toBeInTheDocument()
  })

  it('no muestra error si el texto ya es válido, aunque showError esté activo', () => {
    render(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="Falta vinculación" onNotesChange={vi.fn()} showError />)
    expect(screen.queryByText(/mínimo 5 caracteres/i)).not.toBeInTheDocument()
  })

  it('avisa al padre cuando se escribe una observación', () => {
    const onNotesChange = vi.fn()
    render(<ReviewReasonsFields reasons={[]} onReasonsChange={vi.fn()} notes="" onNotesChange={onNotesChange} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'Falta vinculación' } })
    expect(onNotesChange).toHaveBeenCalledWith('Falta vinculación')
  })

  it('agrega y quita motivos sin perder los ya marcados', () => {
    const onReasonsChange = vi.fn()
    const { rerender } = render(
      <ReviewReasonsFields
        reasons={['REVIEW_PORTABILIDAD']}
        onReasonsChange={onReasonsChange}
        notes="algo válido"
        onNotesChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText(/ilegibles/i))
    expect(onReasonsChange).toHaveBeenCalledWith(['REVIEW_PORTABILIDAD', 'REVIEW_ILLEGIBLE_IMAGES'])

    onReasonsChange.mockClear()
    rerender(
      <ReviewReasonsFields
        reasons={['REVIEW_PORTABILIDAD', 'REVIEW_ILLEGIBLE_IMAGES']}
        onReasonsChange={onReasonsChange}
        notes="algo válido"
        onNotesChange={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByLabelText(/ilegibles/i))
    expect(onReasonsChange).toHaveBeenCalledWith(['REVIEW_PORTABILIDAD'])
  })
})
