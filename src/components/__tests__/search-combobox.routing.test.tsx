import { useState } from 'react'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@/i18n'
import { SearchCombobox } from '../search-combobox'
beforeAll(() => {
  Element.prototype.scrollIntoView = () => {}
})
describe('SearchCombobox optional routing integration', () => {
  it('without new props retains selection and closes', async () => {
    const select = vi.fn()
    render(<SearchCombobox value="" onChange={() => {}} items={[{ id: 'p1', label: 'Café' }]} onSelect={select} inputId="legacy" />)
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByRole('option', { name: 'Café' }))
    expect(select).toHaveBeenCalledWith({ id: 'p1', label: 'Café' })
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })
  it('reports open and close, and renders the supplied footer only inside the open selector', async () => {
    const open = vi.fn(),
      more = vi.fn(),
      select = vi.fn()
    render(
      <SearchCombobox
        value=""
        onChange={() => {}}
        items={[{ id: 'p1', label: 'Café' }]}
        onSelect={select}
        onOpenChange={open}
        footer={<button onClick={more}>Cargar más</button>}
      />,
    )
    expect(screen.queryByRole('button', { name: 'Cargar más' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('combobox'))
    expect(open).toHaveBeenCalledWith(true)
    await userEvent.click(screen.getByRole('button', { name: 'Cargar más' }))
    expect(more).toHaveBeenCalledOnce()
    await userEvent.keyboard('{Enter}')
    expect(more).toHaveBeenCalledTimes(2)
    expect(select).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('option', { name: 'Café' }))
    expect(open).toHaveBeenLastCalledWith(false)
  })
  it.each(['input', 'label'])('keeps the input focused after opening via %s and arrows so typing still searches', async target => {
    function LegacySelector() {
      const [value, setValue] = useState('')
      return (
        <>
          <label htmlFor="focus-product">Buscar producto</label>
          <SearchCombobox
            inputId="focus-product"
            value={value}
            onChange={setValue}
            items={[
              { id: 'p1', label: 'Café' },
              { id: 'p2', label: 'Té' },
            ]}
            onSelect={() => {}}
          />
        </>
      )
    }
    render(<LegacySelector />)
    const input = screen.getByLabelText('Buscar producto')
    expect(input).toHaveAttribute('id', 'focus-product')
    await act(async () => {
      await userEvent.click(target === 'input' ? input : screen.getByText('Buscar producto'))
    })
    await screen.findByRole('listbox')
    expect(input).toHaveFocus()
    await act(async () => {
      await userEvent.keyboard('{ArrowDown}')
    })
    expect(input).toHaveFocus()
    await act(async () => {
      await userEvent.keyboard('x')
    })
    expect(input).toHaveValue('x')
  })
  it('links a keyboard combobox to its list and selects with arrows and Enter', async () => {
    const select = vi.fn()
    render(
      <>
        <label htmlFor="keyboard-product">Producto</label>
        <SearchCombobox
          inputId="keyboard-product"
          value=""
          onChange={() => {}}
          items={[
            { id: 'p1', label: 'Café' },
            { id: 'p2', label: 'Té' },
          ]}
          onSelect={select}
        />
      </>,
    )
    const input = screen.getByLabelText('Producto')
    await userEvent.click(input)
    const list = await screen.findByRole('listbox')
    expect(input).toHaveAttribute('role', 'combobox')
    expect(input).toHaveAttribute('aria-expanded', 'true')
    expect(input).toHaveAttribute('aria-controls', list.id)
    await userEvent.keyboard('{ArrowDown}')
    const activeId = input.getAttribute('aria-activedescendant')
    expect(activeId).toBeTruthy()
    expect(document.getElementById(activeId!)).toHaveAttribute('role', 'option')
    await userEvent.keyboard('{ArrowUp}{Enter}')
    expect(select).toHaveBeenCalledWith({ id: 'p1', label: 'Café' })
    expect(input).toHaveAttribute('aria-expanded', 'false')
  })
})
