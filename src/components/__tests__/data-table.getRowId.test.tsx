/**
 * `DataTable` con `getRowId` (Tarea 15, ronda 1): las filas se identifican por id. Sin él la llave es la POSICIÓN y React le pasa el
 * estado de una celda (un popover, un menú, lo tecleado) a la fila que quede en ese lugar tras un refetch.
 */
import type { ColumnDef } from '@tanstack/react-table'
import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'

const estables = vi.hoisted(() => {
  const t = (k: string) => k
  return { i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import DataTable from '../data-table'

type Fila = { id: string; name: string }

function Nota({ fila }: { fila: Fila }) {
  const [texto, setTexto] = useState('')
  return <input aria-label={`nota de ${fila.name}`} value={texto} onChange={e => setTexto(e.target.value)} />
}

const columnas: ColumnDef<Fila, unknown>[] = [
  { id: 'name', header: 'Nombre', cell: ({ row }) => <span>{row.original.name}</span> },
  { id: 'nota', header: 'Nota', cell: ({ row }) => <Nota fila={row.original} /> },
]
const porId = (f: Fila) => f.id
const a = { id: 'a', name: 'Aceite' }
const b = { id: 'b', name: 'Botella' }
const c = { id: 'c', name: 'Cera' }

describe('DataTable — getRowId', () => {
  it('🔴 lo que vive en una celda se queda con SU fila aunque un refetch quite la de arriba', () => {
    const { rerender } = render(<DataTable data={[a, b, c]} rowCount={3} columns={columnas} getRowId={porId} />)
    fireEvent.change(screen.getByLabelText('nota de Botella'), { target: { value: 'cuidado' } })
    rerender(<DataTable data={[b, c]} rowCount={2} columns={columnas} getRowId={porId} />)
    expect(screen.getByLabelText('nota de Botella')).toHaveValue('cuidado')
    expect(screen.getByLabelText('nota de Cera')).toHaveValue('')
  })

  it('arrastrar sobre las casillas elige las filas por su id', () => {
    const elegidas = vi.fn()
    render(<DataTable data={[a, b, c]} rowCount={3} columns={columnas} getRowId={porId} enableRowSelection onRowSelectionChange={elegidas} />)
    const casillas = screen.getAllByRole('checkbox', { name: 'Select row' })
    fireEvent.mouseDown(casillas[0].parentElement!)
    fireEvent.mouseEnter(screen.getByText('Cera').closest('tr')!)
    fireEvent.mouseUp(window)
    expect(elegidas).toHaveBeenLastCalledWith([a, b, c])
  })
})
