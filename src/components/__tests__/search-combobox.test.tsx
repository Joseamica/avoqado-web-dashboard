// E6a-fix2 K5 (full-testing E6a): la lista del buscador decía «Suggestions» (la etiqueta de fábrica de cmdk) a los lectores de
// pantalla, en un dashboard en español; y «Sin resultados» iba fijo en español para quien usa el dashboard en inglés.
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SearchCombobox } from '../search-combobox'
import { Command, CommandItem, CommandList } from '../ui/command'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => `t:${k}` }) }))

const abrir = (props: Partial<Parameters<typeof SearchCombobox>[0]> = {}) => {
  render(<SearchCombobox items={[{ id: 's1', label: 'Carlos QA' }]} value="" onChange={() => {}} onSelect={() => {}} inputId="buscar" {...props} />)
  fireEvent.focus(screen.getByRole('textbox'))
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
