import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

import { WeeklyRuleDialog } from '../WeeklyRuleDialog'

describe('WeeklyRuleDialog', () => {
  // día + hora + lugares → startMinute en minutos locales
  it('guarda día, hora y lugares como weekday/startMinute/maxSpots', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={onSave} saving={false} />)
    fireEvent.change(screen.getByLabelText('capacity.dialog.weekday'), { target: { value: '6' } })
    fireEvent.change(screen.getByLabelText('capacity.dialog.time'), { target: { value: '09:00' } })
    fireEvent.change(screen.getByLabelText('capacity.dialog.spots'), { target: { value: '1' } })
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(onSave).toHaveBeenCalledWith({ weekday: 6, startMinute: 540, maxSpots: 1 })
  })

  // «Todo el día» manda startMinute null
  it('con «Todo el día» marcado manda startMinute null y no exige hora', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={onSave} saving={false} />)
    await user.click(screen.getByRole('switch', { name: 'capacity.dialog.allDay' }))
    fireEvent.change(screen.getByLabelText('capacity.dialog.spots'), { target: { value: '0' } })
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(onSave).toHaveBeenCalledWith({ weekday: 1, startMinute: null, maxSpots: 0 })
  })

  // R2b-39: los lugares, igual que el tope general y el de la clase: texto con teclado numérico, sólo dígitos
  it('los lugares sólo aceptan dígitos: «e5» queda en 5', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={onSave} saving={false} />)
    await user.click(screen.getByRole('switch', { name: 'capacity.dialog.allDay' }))
    const spots = screen.getByLabelText('capacity.dialog.spots')
    expect(spots).toHaveAttribute('inputmode', 'numeric')
    await user.type(spots, 'e')
    expect(spots).toHaveValue('')
    await user.type(spots, '5')
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(onSave).toHaveBeenCalledWith({ weekday: 1, startMinute: null, maxSpots: 5 })
  })

  // sin hora o sin lugares no se guarda y se dice por qué
  it('sin hora o sin lugares no guarda y muestra el motivo', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={onSave} saving={false} />)
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('capacity.dialog.errors.time')).toBeInTheDocument()
    expect(screen.getByText('capacity.dialog.errors.spots')).toBeInTheDocument()
    // H5: el lector de pantalla oye el motivo con el campo
    expect(screen.getByLabelText('capacity.dialog.time')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('capacity.dialog.time')).toHaveAccessibleDescription('capacity.dialog.errors.time')
    expect(screen.getByLabelText('capacity.dialog.spots')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('capacity.dialog.spots')).toHaveAccessibleDescription(
      'capacity.dialog.spotsHint capacity.dialog.errors.spots',
    )
  })

  // H3: ese día y hora ya tienen excepción con otro valor ⇒ se dice antes de reemplazarla; con el mismo valor, nada
  it('día y hora con excepción existente ⇒ avisa que se reemplaza', () => {
    render(
      <WeeklyRuleDialog
        open
        onClose={() => {}}
        onSave={() => {}}
        saving={false}
        existing={[{ id: 'r1', weekday: 6, startMinute: 540, maxSpots: 2 }]}
      />,
    )
    fireEvent.change(screen.getByLabelText('capacity.dialog.weekday'), { target: { value: '6' } })
    expect(screen.queryByText('capacity.weekly.replaces')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('capacity.dialog.time'), { target: { value: '09:00' } })
    expect(screen.getByText('capacity.weekly.replaces')).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('capacity.dialog.spots'), { target: { value: '2' } })
    expect(screen.queryByText('capacity.weekly.replaces')).not.toBeInTheDocument()
  })

  // H1: el error del server se pinta dentro del diálogo
  it('con error del server ⇒ Alert destructivo dentro del diálogo', () => {
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={() => {}} saving={false} error="Mensaje del servidor" />)
    expect(screen.getByRole('alert')).toHaveTextContent('Mensaje del servidor')
  })

  // mientras guarda, el botón dice «Guardando…» y no se puede volver a presionar
  it('guardando ⇒ botón deshabilitado con «Guardando…»', () => {
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={() => {}} saving />)
    expect(screen.getByRole('button', { name: 'common:saving' })).toBeDisabled()
  })
})
