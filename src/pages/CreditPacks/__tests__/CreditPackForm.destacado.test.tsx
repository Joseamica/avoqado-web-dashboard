/**
 * Destacar un paquete: etiqueta (máx. 40) + ícono, con vista previa. Al editar, si cambia el texto o el ícono se mandan LOS DOS
 * juntos (el SERVIDOR rechaza un ícono sin texto en la misma petición); si no cambió ninguno, no se manda ninguno.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/locales/en/creditPacks.json'
import es from '@/locales/es/creditPacks.json'

const estables = vi.hoisted(() => ({
  i18n: {
    t: (k: string, o?: Record<string, unknown> | string) =>
      typeof o === 'object' ? [k, ...Object.entries(o).flatMap(([c, v]) => (c === 'defaultValue' ? [] : [String(v)]))].join(':') : k,
    i18n: { language: 'es' },
  },
}))
const paquetes = vi.hoisted(() => ({ getCreditPack: vi.fn(), createCreditPack: vi.fn(), updateCreditPack: vi.fn() }))
const red = vi.hoisted(() => ({ get: vi.fn() }))
const avisos = vi.hoisted(() => ({ toast: vi.fn() }))

vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))
vi.mock('@/services/creditPack.service', () => ({ default: paquetes }))
vi.mock('@/api', () => ({ default: red }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: avisos.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/components/search-combobox', () => ({
  SearchCombobox: ({ items, onSelect }: { items: { id: string; label: string }[]; onSelect: (i: { id: string }) => void }) => (
    <div>
      {items.map(i => (
        <button key={i.id} type="button" onClick={() => onSelect(i)}>
          elegir {i.label}
        </button>
      ))}
    </div>
  ),
}))

import CreditPackFormModal from '../CreditPackForm'

function pintar(packId?: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const envoltura = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return render(<CreditPackFormModal open onClose={() => {}} packId={packId} onSuccess={() => {}} />, { wrapper: envoltura })
}

const guardar = () => fireEvent.click(screen.getByRole('button', { name: 'actions.save' }))
const campoDestacado = () => screen.getByPlaceholderText('form.placeholders.badgeText')

const paqueteConDestacado = (extra: Record<string, unknown> = {}) => ({
  id: 'pk1',
  venueId: 'v1',
  name: 'Paquete 10',
  price: 1000,
  currency: 'MXN',
  active: true,
  displayOrder: 0,
  badgeText: 'Más popular',
  badgeIcon: 'star',
  items: [{ id: 'i1', productId: 'p1', quantity: 10, unlimited: false, product: { id: 'p1', name: 'Lagree', type: 'CLASS', price: 0 } }],
  createdAt: '',
  updatedAt: '',
  ...extra,
})

beforeEach(() => {
  red.get.mockResolvedValue({ data: { data: [{ id: 'p1', name: 'Lagree', price: 0 }] } })
  paquetes.createCreditPack.mockResolvedValue({ id: 'nuevo' })
  paquetes.updateCreditPack.mockResolvedValue({ id: 'pk1' })
})

describe('CreditPackForm · destacado', () => {
  it('al crear manda badgeText y badgeIcon y la vista previa enseña el texto', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'elegir Lagree' }))
    fireEvent.change(screen.getByPlaceholderText('form.placeholders.name'), { target: { value: 'Paquete 5' } })
    fireEvent.change(screen.getByPlaceholderText('form.placeholders.price'), { target: { value: '500' } })

    fireEvent.change(campoDestacado(), { target: { value: 'Más popular' } })
    const estrella = screen.getByRole('button', { name: 'form.badgeIcons.star' })
    fireEvent.click(estrella)
    expect(estrella).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByTestId('badge-preview')).toHaveTextContent('Más popular')

    guardar()
    await waitFor(() => expect(paquetes.createCreditPack).toHaveBeenCalledTimes(1))
    expect(paquetes.createCreditPack.mock.calls[0][1]).toEqual(expect.objectContaining({ badgeText: 'Más popular', badgeIcon: 'star' }))
  })

  it('al crear sin destacado no manda badgeText ni badgeIcon', async () => {
    pintar()
    fireEvent.click(await screen.findByRole('button', { name: 'elegir Lagree' }))
    fireEvent.change(screen.getByPlaceholderText('form.placeholders.name'), { target: { value: 'Paquete 5' } })
    fireEvent.change(screen.getByPlaceholderText('form.placeholders.price'), { target: { value: '500' } })
    guardar()
    await waitFor(() => expect(paquetes.createCreditPack).toHaveBeenCalledTimes(1))
    const cuerpo = paquetes.createCreditPack.mock.calls[0][1]
    expect(cuerpo).not.toHaveProperty('badgeText')
    expect(cuerpo).not.toHaveProperty('badgeIcon')
  })

  it('al editar, borrar el texto manda badgeText:null y badgeIcon:null', async () => {
    paquetes.getCreditPack.mockResolvedValue(paqueteConDestacado())
    pintar('pk1')
    await screen.findByText('Lagree')
    expect(campoDestacado()).toHaveValue('Más popular')
    fireEvent.change(campoDestacado(), { target: { value: '' } })
    guardar()
    await waitFor(() => expect(paquetes.updateCreditPack).toHaveBeenCalledTimes(1))
    expect(paquetes.updateCreditPack.mock.calls[0][2]).toEqual(expect.objectContaining({ badgeText: null, badgeIcon: null }))
  })

  it('al editar sólo el nombre, el payload no trae badgeText ni badgeIcon', async () => {
    paquetes.getCreditPack.mockResolvedValue(paqueteConDestacado())
    pintar('pk1')
    await screen.findByText('Lagree')
    fireEvent.change(screen.getByPlaceholderText('form.placeholders.name'), { target: { value: 'Paquete 10 nuevo' } })
    guardar()
    await waitFor(() => expect(paquetes.updateCreditPack).toHaveBeenCalledTimes(1))
    const cuerpo = paquetes.updateCreditPack.mock.calls[0][2]
    expect(cuerpo.name).toBe('Paquete 10 nuevo')
    expect(cuerpo).not.toHaveProperty('badgeText')
    expect(cuerpo).not.toHaveProperty('badgeIcon')
  })

  it('al editar y cambiar sólo el ícono, manda texto e ícono juntos', async () => {
    paquetes.getCreditPack.mockResolvedValue(paqueteConDestacado())
    pintar('pk1')
    await screen.findByText('Lagree')
    fireEvent.click(screen.getByRole('button', { name: 'form.badgeIcons.flame' }))
    guardar()
    await waitFor(() => expect(paquetes.updateCreditPack).toHaveBeenCalledTimes(1))
    expect(paquetes.updateCreditPack.mock.calls[0][2]).toEqual(expect.objectContaining({ badgeText: 'Más popular', badgeIcon: 'flame' }))
  })

  it('el texto del campo se limita a 40 caracteres', async () => {
    pintar()
    await screen.findByRole('button', { name: 'elegir Lagree' })
    expect(campoDestacado()).toHaveAttribute('maxLength', '40')
  })
})

describe('textos del destacado', () => {
  it('es y en traen los textos y los seis íconos', () => {
    expect(Object.keys(en.form.badgeIcons).sort()).toEqual(Object.keys(es.form.badgeIcons).sort())
    expect(Object.keys(es.form.badgeIcons).sort()).toEqual(['flame', 'heart', 'sparkles', 'star', 'tag', 'trophy'])
    expect(es.form.badgeTitle).toBe('Destacar este paquete (opcional)')
    expect(es.form.badgeHelp).toBe('Sale arriba del paquete en tu página de reservas, por ejemplo "Más popular"')
    expect(en.form.badgeTitle).toBeTruthy()
    expect(en.form.badgeHelp).toBeTruthy()
    expect(en.form.placeholders.badgeText).toBeTruthy()
  })
})
