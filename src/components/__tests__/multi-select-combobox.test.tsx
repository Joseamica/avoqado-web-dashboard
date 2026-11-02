/**
 * `disabled` (Menú del aparato, B4): mientras una fila guarda su elección, su selector no abre ni deja quitar un chip.
 * Sin la prop, el componente se comporta igual que antes (el primer caso lo comprueba, para que el segundo no pase vacío).
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

import { MultiSelectCombobox } from '../multi-select-combobox'

const opciones = [
  { value: 'a', label: 'Desayunos' },
  { value: 'b', label: 'Comidas' },
]

describe('MultiSelectCombobox', () => {
  it('sin disabled abre la lista y la X quita el chip (como siempre)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<MultiSelectCombobox options={opciones} selected={[opciones[0]]} onChange={onChange} placeholder="Todos" emptyText="Nada" />)
    await user.click(screen.getByText('Desayunos'))
    expect(onChange).toHaveBeenCalledWith([])
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByRole('option', { name: 'Comidas' })).toBeInTheDocument()
  })

  it('MultiSelectCombobox con disabled no abre ni quita', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <MultiSelectCombobox options={opciones} selected={[opciones[0]]} onChange={onChange} placeholder="Todos" emptyText="Nada" disabled />,
    )
    expect(screen.getByRole('combobox')).toBeDisabled()
    // Se dispara directo en el chip: un botón deshabilitado del navegador ya se traga el clic, pero la prueba no debe depender de eso.
    screen.getByText('Desayunos').click()
    await user.click(screen.getByRole('combobox'))
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.queryByRole('option')).not.toBeInTheDocument()
  })

  it('sin searchPlaceholder el buscador usa placeholder; con él, su propio texto', async () => {
    const user = userEvent.setup()
    const { unmount } = render(
      <MultiSelectCombobox options={opciones} selected={[]} onChange={vi.fn()} placeholder="Todos" emptyText="Nada" />,
    )
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByPlaceholderText('Todos')).toBeInTheDocument()
    unmount()
    render(
      <MultiSelectCombobox
        options={opciones}
        selected={[]}
        onChange={vi.fn()}
        placeholder="Todos"
        emptyText="Nada"
        searchPlaceholder="Buscar"
        ariaLabel="Menús de Caja"
      />,
    )
    expect(screen.getByRole('combobox', { name: 'Menús de Caja' })).toBeInTheDocument()
    await user.click(screen.getByRole('combobox'))
    expect(await screen.findByPlaceholderText('Buscar')).toBeInTheDocument()
  })
})
