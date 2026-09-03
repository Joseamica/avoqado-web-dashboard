import { render, screen, fireEvent } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import PendingWipePanel from '@/pages/Organization/components/PendingWipePanel'
import type { OrgPendingWipe } from '@/services/organizationDashboard.service'

// Echo the key (plus interpolation) so the assertions read like the copy they guard.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => (options?.date ? `${key}:${options.date}` : options?.venue ? `${key}:${options.venue}` : key),
  }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (d: string) => `dt(${d})` }),
}))

const HOUR = 60 * 60 * 1000
const wipe = (over: Partial<OrgPendingWipe> = {}): OrgPendingWipe => ({
  commandId: 'cmd-1',
  queuedAt: new Date(Date.now() - 30 * HOUR).toISOString(),
  status: 'SENT',
  origin: 'MANUAL',
  toVenueId: null,
  cancellable: false,
  discardable: true,
  discardableAt: new Date(Date.now() - 6 * HOUR).toISOString(),
  ...over,
})

describe('PendingWipePanel — the way out of MIGRATION_IN_PROGRESS', () => {
  const onCancel = vi.fn()
  const onDiscard = vi.fn()
  beforeEach(() => vi.clearAllMocks())

  it('always says WHEN the wipe was queued', () => {
    const w = wipe()
    render(<PendingWipePanel pendingWipe={w} venueName={null} busy={false} onCancel={onCancel} onDiscard={onDiscard} />)
    expect(screen.getByText(`terminals.migrate.pendingWipe.title:dt(${w.queuedAt})`)).toBeInTheDocument()
  })

  it('names the destination venue when the wipe came from a migration', () => {
    render(
      <PendingWipePanel
        pendingWipe={wipe({ origin: 'MIGRATION', toVenueId: 'v-898' })}
        venueName="BAE MUÑOZ SLP (898)"
        busy={false}
        onCancel={onCancel}
        onDiscard={onDiscard}
      />,
    )
    expect(screen.getByText('terminals.migrate.pendingWipe.originMigration:BAE MUÑOZ SLP (898)')).toBeInTheDocument()
  })

  it('cancellable → offers CANCEL and nothing else (no steps, no discard)', () => {
    render(
      <PendingWipePanel
        pendingWipe={wipe({ status: 'QUEUED', cancellable: true, discardable: false })}
        venueName={null}
        busy={false}
        onCancel={onCancel}
        onDiscard={onDiscard}
      />,
    )
    fireEvent.click(screen.getByRole('button', { name: 'terminals.migrate.pendingWipe.cancelAction' }))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'terminals.migrate.pendingWipe.discardAction' })).toBeNull()
    expect(screen.queryByText('terminals.migrate.pendingWipe.step1')).toBeNull()
  })

  it('not cancellable + silent ≥ 24 h → the 3 steps and DISCARD', () => {
    render(<PendingWipePanel pendingWipe={wipe()} venueName={null} busy={false} onCancel={onCancel} onDiscard={onDiscard} />)
    expect(screen.getByText('terminals.migrate.pendingWipe.step1')).toBeInTheDocument()
    expect(screen.getByText('terminals.migrate.pendingWipe.step3')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'terminals.migrate.pendingWipe.discardAction' }))
    expect(onDiscard).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: 'terminals.migrate.pendingWipe.cancelAction' })).toBeNull()
  })

  it('not cancellable + younger than 24 h → the 3 steps, NO button, and says from WHEN discarding opens', () => {
    const w = wipe({ discardable: false, discardableAt: new Date(Date.now() + 20 * HOUR).toISOString() })
    render(<PendingWipePanel pendingWipe={w} venueName={null} busy={false} onCancel={onCancel} onDiscard={onDiscard} />)
    expect(screen.getByText('terminals.migrate.pendingWipe.step1')).toBeInTheDocument()
    expect(screen.queryByRole('button')).toBeNull()
    expect(screen.getByText(`terminals.migrate.pendingWipe.discardableFrom:dt(${w.discardableAt})`)).toBeInTheDocument()
  })

  it('busy → the action is disabled so a double click cannot fire two requests', () => {
    render(<PendingWipePanel pendingWipe={wipe()} venueName={null} busy onCancel={onCancel} onDiscard={onDiscard} />)
    const btn = screen.getByRole('button', { name: 'terminals.migrate.pendingWipe.discardAction' })
    expect(btn).toBeDisabled()
    fireEvent.click(btn)
    expect(onDiscard).not.toHaveBeenCalled()
  })
})
