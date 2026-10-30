import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { NewAreaDialog } from '../NewAreaDialog'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))

function renderDialog() {
  render(<NewAreaDialog open first existingNames={[]} adoptCount={0} maxTables={60} onCancel={vi.fn()} onCreate={vi.fn()} />)
}

describe('NewAreaDialog: cajas de número', () => {
  // PostHog, 19 y 23-oct: el dueño picaba 3 o 4 veces la caja para borrar el número que ya traía. Si escribía detrás
  // de él, «6» + «20» daba 620 y la caja saltaba al tope (60).
  it.each([
    ['new-area-count', '20'],
    ['new-area-capacity', '6'],
  ])('al picar %s y escribir, el número nuevo reemplaza al que traía', async (testId, typed) => {
    const user = userEvent.setup()
    renderDialog()
    const input = screen.getByTestId(testId)
    await user.click(input)
    await user.keyboard(typed)
    expect(input).toHaveValue(Number(typed))
  })
})
