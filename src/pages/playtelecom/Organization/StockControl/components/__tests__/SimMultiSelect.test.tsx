/**
 * SimMultiSelect unit tests.
 *
 * Covers:
 *   - Default allowedStates (['ADMIN_HELD']) — shows ADMIN_HELD items, hides others.
 *   - Custom allowedStates (['PROMOTER_HELD']) — shows PROMOTER_HELD items, hides ADMIN_HELD.
 *   - Regression: AssignToSupervisorDialog path (no allowedStates prop) still works.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SimMultiSelect } from '../SimMultiSelect'
import type { OrgStockOverviewItem } from '@/services/stockDashboard.service'

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeItem(
  serialNumber: string,
  custodyState: OrgStockOverviewItem['custodyState'],
): OrgStockOverviewItem {
  return {
    id: serialNumber,
    serialNumber,
    status: 'AVAILABLE',
    categoryId: 'cat-1',
    categoryName: 'Test Cat',
    createdAt: '2026-01-01T00:00:00Z',
    soldAt: null,
    registeredFromVenueId: null,
    registeredFromVenueName: null,
    sellingVenueId: null,
    sellingVenueName: null,
    currentVenueId: null,
    currentVenueName: null,
    createdById: null,
    createdByName: null,
    custodyState,
  }
}

const ADMIN_ITEM = makeItem('891000000000001', 'ADMIN_HELD')
const PROMOTER_ITEM = makeItem('891000000000002', 'PROMOTER_HELD')
const SUPERVISOR_ITEM = makeItem('891000000000003', 'SUPERVISOR_HELD')

function renderSelect(props: Partial<Parameters<typeof SimMultiSelect>[0]> = {}) {
  const onChange = vi.fn()
  const utils = render(
    <SimMultiSelect
      items={[ADMIN_ITEM, PROMOTER_ITEM, SUPERVISOR_ITEM]}
      value={[]}
      onChange={onChange}
      {...props}
    />,
  )
  // Focus the input to open the dropdown
  const input = utils.getByRole('textbox')
  fireEvent.focus(input)
  return { ...utils, onChange }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('SimMultiSelect — allowedStates filtering', () => {
  it('default (no allowedStates prop) shows only ADMIN_HELD items — AssignToSupervisorDialog regression', () => {
    renderSelect()

    // ADMIN_HELD should appear in dropdown
    expect(screen.getByText(ADMIN_ITEM.serialNumber)).toBeInTheDocument()
    // PROMOTER_HELD and SUPERVISOR_HELD must NOT appear
    expect(screen.queryByText(PROMOTER_ITEM.serialNumber)).not.toBeInTheDocument()
    expect(screen.queryByText(SUPERVISOR_ITEM.serialNumber)).not.toBeInTheDocument()
  })

  it('allowedStates={["PROMOTER_HELD"]} surfaces PROMOTER_HELD and hides others', () => {
    renderSelect({ allowedStates: ['PROMOTER_HELD'] })

    expect(screen.getByText(PROMOTER_ITEM.serialNumber)).toBeInTheDocument()
    expect(screen.queryByText(ADMIN_ITEM.serialNumber)).not.toBeInTheDocument()
    expect(screen.queryByText(SUPERVISOR_ITEM.serialNumber)).not.toBeInTheDocument()
  })

  it('allowedStates covering multiple states surfaces all matching items', () => {
    renderSelect({ allowedStates: ['ADMIN_HELD', 'SUPERVISOR_HELD', 'PROMOTER_HELD'] })

    expect(screen.getByText(ADMIN_ITEM.serialNumber)).toBeInTheDocument()
    expect(screen.getByText(PROMOTER_ITEM.serialNumber)).toBeInTheDocument()
    expect(screen.getByText(SUPERVISOR_ITEM.serialNumber)).toBeInTheDocument()
  })

  it('shows "No hay SIMs disponibles en almacén" placeholder when no items match the allowed states', () => {
    render(
      <SimMultiSelect
        items={[PROMOTER_ITEM]}
        allowedStates={['ADMIN_HELD']}
        value={[]}
        onChange={vi.fn()}
      />,
    )
    // Dropdown only shows when focused — check placeholder on the input
    const input = screen.getByRole('textbox')
    expect(input).toHaveAttribute('placeholder', 'No hay SIMs disponibles en almacén')
  })
})
