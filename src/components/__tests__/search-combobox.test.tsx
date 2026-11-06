// E6a-fix2 K5 (full-testing E6a): la lista del buscador decía «Suggestions» (la etiqueta de fábrica de cmdk) a los lectores de
// pantalla, en un dashboard en español; y «Sin resultados» iba fijo en español para quien usa el dashboard en inglés.
import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchCombobox } from '../search-combobox'
import { Command, CommandItem, CommandList } from '../ui/command'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => `t:${k}` }) }))

const abrir = (props: Partial<Parameters<typeof SearchCombobox>[0]> = {}) => {
  render(<SearchCombobox items={[{ id: 's1', label: 'Carlos QA' }]} value="" onChange={() => {}} onSelect={() => {}} inputId="buscar" {...props} />)
  // Desde develop (9c2fc8ff) el buscador es el `Command.Input` de cmdk: se anuncia como «combobox», ya no como «textbox».
  fireEvent.focus(screen.getByRole('combobox'))
}

describe('SearchCombobox', () => {
  it('🔴 la lista se nombra con texto traducido, nunca «Suggestions»', () => {
    abrir()
    const lista = screen.getByRole('listbox')
    expect(lista).toHaveAttribute('aria-label', 't:suggestions')
    expect(lista).not.toHaveAttribute('aria-label', 'Suggestions')
  })

  it('🔴 quien la usa le puede dar su propio nombre («Personas que coinciden»)', () => {
    abrir({ listLabel: 'Personas que coinciden' })
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 'Personas que coinciden')
  })

  it('🔴 «sin resultados» también va traducido', () => {
    abrir({ items: [], value: 'zzz' })
    expect(screen.getByText('t:noResults')).toBeInTheDocument()
    expect(screen.queryByText('Sin resultados')).toBeNull()
  })
})

// Los otros 19 buscadores del dashboard usan `CommandList` directo: la etiqueta traducida vive en el envoltorio, para todos.
describe('CommandList', () => {
  it('🔴 sin etiqueta propia, se nombra con «Sugerencias» traducido, no con «Suggestions» de cmdk', () => {
    render(
      <Command>
        <CommandList>
          <CommandItem>Uno</CommandItem>
        </CommandList>
      </Command>,
    )
    expect(screen.getByRole('listbox')).toHaveAttribute('aria-label', 't:suggestions')
  })
})

// Pizarrón D1 (5-nov, medido en Safari de iPhone con una bitácora en pantalla): iOS mueve el foco a la lista (`tabIndex=-1` de
// cmdk) DESPUÉS del clic, no al presionar como Chrome. El regreso del foco al campo corría con la lista ya cerrada por la
// elección, y el `onFocus` del campo la volvía a abrir: la lista se reabría sola y en horizontal tapaba «Finalizar».
describe('SearchCombobox: el foco que llega a la lista después de elegir (orden de iOS)', () => {
  it('🔴 elegir no vuelve a abrir la lista aunque el foco llegue a la lista en el mismo toque', async () => {
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()
    render(<SearchCombobox items={[{ id: 'c1', label: 'Bebidas' }]} value="" onChange={() => {}} onSelect={onSelect} onOpenChange={onOpenChange} />)
    fireEvent.focus(screen.getByRole('combobox'))
    const opcion = await screen.findByRole('option', { name: 'Bebidas' })
    const lista = screen.getByRole('listbox')
    // Como en Safari: el foco cae en la lista y el clic elige, en el mismo toque y antes de que React vuelva a pintar.
    lista.focus()
    opcion.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    await act(async () => { await new Promise(r => setTimeout(r, 0)) })
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onOpenChange).toHaveBeenLastCalledWith(false)
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument()
  })

  it('con la lista abierta, el foco que cae en ella regresa al campo (escribir sigue buscando)', async () => {
    render(<SearchCombobox items={[{ id: 'c1', label: 'Bebidas' }]} value="" onChange={() => {}} onSelect={() => {}} />)
    const campo = screen.getByRole('combobox')
    fireEvent.focus(campo)
    const lista = await screen.findByRole('listbox')
    await act(async () => { lista.focus(); await Promise.resolve() })
    expect(campo).toHaveFocus()
    expect(screen.getByRole('listbox')).toBeInTheDocument()
  })
})
