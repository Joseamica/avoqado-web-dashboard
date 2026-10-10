import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, expect, it, vi } from 'vitest'
import { ServiceCoursesContent } from '../ServiceCourses'
import {
  canManageOrganizationCourses,
  courseValidation,
  getServiceCourses,
  saveServiceCourses,
  type ServiceCoursesRead,
} from '@/services/serviceCourses.service'
import type { User } from '@/types'

vi.mock('@/services/serviceCourses.service', async original => ({
  ...(await original<typeof import('@/services/serviceCourses.service')>()),
  getServiceCourses: vi.fn(),
  saveServiceCourses: vi.fn(),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { index?: number }) => (options?.index ? `${key} ${options.index}` : key) }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: () => <p>Pro required</p> }))
const catalog: ServiceCoursesRead = {
  schemaVersion: 1,
  venueId: 'v1',
  venueName: 'Roma',
  organizationId: 'o1',
  organizationName: 'La Mesa',
  source: 'ORGANIZATION',
  revision: 'o:2:v:0',
  hasOwnConfiguration: false,
  enabled: true,
  courses: [
    { id: 'immediate', label: 'Inmediato', kind: 'IMMEDIATE' },
    { id: 'mains', label: 'Principales', kind: 'STANDARD' },
  ],
  limits: { maxCourses: 32, maxLabelLength: 60 },
}
const get = vi.mocked(getServiceCourses)
const save = vi.mocked(saveServiceCourses)
function renderPage(canManage = true, data = catalog) {
  get.mockResolvedValue(data)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <MemoryRouter>
      <QueryClientProvider client={client}>
        <ServiceCoursesContent
          scope={{ kind: 'venue', id: data.venueId! }}
          canManage={canManage}
          organizationHref="/organizations/o1/settings/service-courses"
        />
      </QueryClientProvider>
    </MemoryRouter>,
  )
}
beforeEach(() => {
  vi.clearAllMocks()
  save.mockResolvedValue({ ...catalog, source: 'VENUE', hasOwnConfiguration: true, revision: 'v:1' })
})

it('renders route context and inheritance without a second branch selector', async () => {
  renderPage()
  expect(await screen.findByText('La Mesa · Roma')).toBeInTheDocument()
  expect(screen.getByText('source.ORGANIZATION')).toBeInTheDocument()
  expect(screen.queryByRole('combobox')).not.toBeInTheDocument()
  expect(screen.getByRole('link', { name: 'goOrganization' })).toHaveAttribute('href', '/organizations/o1/settings/service-courses')
})
it('saves the entire override with the revision read; renamed immediate retains identity', async () => {
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'customize' }))
  const first = screen.getByRole('textbox', { name: 'courseName 1' })
  await userEvent.clear(first)
  await userEvent.type(first, 'Al momento')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  await waitFor(() =>
    expect(save).toHaveBeenCalledWith({ kind: 'venue', id: 'v1' }, 'o:2:v:0', [
      { ...catalog.courses[0], label: 'Al momento' },
      catalog.courses[1],
    ]),
  )
})
it('retains the draft after 409 and performs no automatic retry', async () => {
  save.mockRejectedValue({ response: { status: 409 } })
  renderPage()
  await userEvent.click(await screen.findByRole('button', { name: 'customize' }))
  await userEvent.type(screen.getByRole('textbox', { name: 'courseName 2' }), ' nueva')
  await userEvent.click(screen.getByRole('button', { name: 'save' }))
  expect(await screen.findByText('conflict')).toBeInTheDocument()
  expect(screen.getByRole('textbox', { name: 'courseName 2' })).toHaveValue('Principales nueva')
  expect(save).toHaveBeenCalledTimes(1)
  expect(screen.getByRole('button', { name: 'save' })).toBeDisabled()
})
it('requires confirmation to restore inheritance and sends null with own revision', async () => {
  renderPage(true, { ...catalog, hasOwnConfiguration: true, source: 'VENUE', revision: 'v:4' })
  await userEvent.click(await screen.findByRole('button', { name: 'restore' }))
  expect(save).not.toHaveBeenCalled()
  await userEvent.click(screen.getByRole('button', { name: 'restoreConfirm' }))
  await waitFor(() => expect(save).toHaveBeenCalledWith({ kind: 'venue', id: 'v1' }, 'v:4', null))
})
it('read-only permission keeps the catalog visible and hides write controls', async () => {
  renderPage(false)
  expect(await screen.findByText('Principales')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument()
  expect(screen.getByText('readOnly')).toBeInTheDocument()
})
it('Free has a visible Pro explanation and no edit controls', async () => {
  renderPage(true, { ...catalog, enabled: false })
  expect(await screen.findByText('Pro required')).toBeInTheDocument()
  expect(screen.queryByRole('button', { name: 'customize' })).not.toBeInTheDocument()
})
it('normalizes names while rejecting duplicates, empty labels and moving immediate', () => {
  expect(
    courseValidation(
      [
        { ...catalog.courses[0], label: ' Café ' },
        { ...catalog.courses[1], label: 'café' },
      ],
      catalog.limits,
    ),
  ).toBe('validation.duplicate')
  expect(courseValidation([{ ...catalog.courses[0], label: ' ' }], catalog.limits)).toBe('validation.name')
  expect(courseValidation([...catalog.courses].reverse(), catalog.limits)).toBe('validation.immediate')
})
it('organization ownership is tenant-specific and never granted by venue OWNER alone', () => {
  const user = { role: 'OWNER', organizationMemberships: [{ organizationId: 'o1', role: 'OWNER' }] } as unknown as User
  expect(canManageOrganizationCourses(user, 'o1')).toBe(true)
  expect(canManageOrganizationCourses(user, 'o2')).toBe(false)
  expect(canManageOrganizationCourses({ role: 'OWNER' } as User, 'o1')).toBe(false)
})
