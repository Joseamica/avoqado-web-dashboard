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

  // sin hora o sin lugares no se guarda y se dice por qué
  it('sin hora o sin lugares no guarda y muestra el motivo', async () => {
    const user = userEvent.setup()
    const onSave = vi.fn()
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={onSave} saving={false} />)
    await user.click(screen.getByRole('button', { name: 'common:save' }))
    expect(onSave).not.toHaveBeenCalled()
    expect(screen.getByText('capacity.dialog.errors.time')).toBeInTheDocument()
    expect(screen.getByText('capacity.dialog.errors.spots')).toBeInTheDocument()
  })

  // mientras guarda, el botón dice «Guardando…» y no se puede volver a presionar
  it('guardando ⇒ botón deshabilitado con «Guardando…»', () => {
    render(<WeeklyRuleDialog open onClose={() => {}} onSave={() => {}} saving />)
    expect(screen.getByRole('button', { name: 'common:saving' })).toBeDisabled()
  })
})
