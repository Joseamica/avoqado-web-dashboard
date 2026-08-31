import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ComponentProps } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DisplayModeRequest, EffectiveDeviceCapabilities } from '@/services/tpv.service'
import { DisplayModeRequestControl, getDisplayModeRefetchInterval } from '../DisplayModeRequestControl'

const serviceMocks = vi.hoisted(() => ({
  createDisplayModeRequest: vi.fn(),
  cancelDisplayModeRequest: vi.fn(),
}))

vi.mock('@/services/tpv.service', () => serviceMocks)

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es' },
  }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    // Intentionally naive: production must reject invalid/missing input before calling this.
    formatDateTime: (value: string | null | undefined) => `formatted:${String(value)}`,
  }),
}))

const supportedCapabilities: EffectiveDeviceCapabilities = {
  requiresActivation: false,
  canManagePaymentConfiguration: false,
  canAcceptTerminalPaymentRequests: false,
  customerDisplay: {
    presence: 'SUPPORTED',
    invertibility: 'SUPPORTED',
    canRequestInversion: true,
    observedAt: '2026-08-31T10:00:00.000Z',
    stale: false,
  },
  supportedRemoteCommands: [],
}

const pendingRequest: DisplayModeRequest = {
  requestId: 'request-1',
  desiredInverted: true,
  status: 'PENDING',
  requestedAt: '2026-08-31T12:00:00.000Z',
  requestedBy: 'staff-1',
  expiresAt: '2026-08-31T12:15:00.000Z',
}

const defaultProps = {
  venueId: 'venue-1',
  terminalId: 'terminal-1',
  capabilities: supportedCapabilities,
  customerDisplayInverted: false,
  request: null,
  canUpdate: true,
}

type ControlProps = ComponentProps<typeof DisplayModeRequestControl>

function renderControl(props: Partial<ControlProps> = {}, options: { seedDetail?: boolean } = {}) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })
  const initialProps = { ...defaultProps, ...props }
  if (options.seedDetail !== false) {
    queryClient.setQueryData(['tpv', initialProps.venueId, initialProps.terminalId], {
      id: initialProps.terminalId,
      name: `Device ${initialProps.terminalId}`,
      marker: 'preserved',
      customerDisplayInverted: initialProps.customerDisplayInverted,
      customerDisplayRequest: initialProps.request ?? null,
    })
  }
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
  const setQueryData = vi.spyOn(queryClient, 'setQueryData')

  const view = render(
    <QueryClientProvider client={queryClient}>
      <DisplayModeRequestControl {...initialProps} />
    </QueryClientProvider>,
  )

  const rerenderControl = (nextProps: Partial<ControlProps>) => {
    view.rerender(
      <QueryClientProvider client={queryClient}>
        <DisplayModeRequestControl {...defaultProps} {...nextProps} />
      </QueryClientProvider>,
    )
  }

  return { ...view, queryClient, invalidateQueries, setQueryData, rerenderControl }
}

function mutationResponse(request: DisplayModeRequest | null, customerDisplayInverted = false) {
  return {
    data: {
      mutated: true,
      version: 2,
      request,
      customerDisplayInverted,
    },
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise
    reject = rejectPromise
  })
  return { promise, resolve, reject }
}

describe('DisplayModeRequestControl', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    serviceMocks.createDisplayModeRequest.mockResolvedValue(mutationResponse(pendingRequest))
    serviceMocks.cancelDisplayModeRequest.mockResolvedValue(
      mutationResponse({ ...pendingRequest, status: 'CANCELLED', resolvedAt: '2026-08-31T12:02:00.000Z' }),
    )
  })

  it.each([
    ['presence', 'UNSUPPORTED'],
    ['invertibility', 'UNSUPPORTED'],
  ] as const)('renders no control when customer-display %s is unsupported', (field, value) => {
    renderControl({
      capabilities: {
        ...supportedCapabilities,
        customerDisplay: { ...supportedCapabilities.customerDisplay, [field]: value },
      },
    })

    expect(screen.queryByTestId('display-mode-request-control')).not.toBeInTheDocument()
  })

  it.each([
    ['presence', 'UNKNOWN', false],
    ['invertibility', 'UNKNOWN', false],
    ['presence', 'SUPPORTED', true],
  ] as const)('keeps physical context visible but disabled for %s=%s stale=%s', (field, value, stale) => {
    renderControl({
      capabilities: {
        ...supportedCapabilities,
        customerDisplay: { ...supportedCapabilities.customerDisplay, [field]: value, stale },
      },
    })

    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    expect(screen.getByText('displayMode.explanations.awaitingReport')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' })).toBeDisabled()
  })

  it('keeps a supported control visible but non-actionable without tpv:update', () => {
    renderControl({ canUpdate: false })

    expect(screen.getByTestId('display-mode-request-control')).toBeInTheDocument()
    expect(screen.getByText('displayMode.explanations.missingPermission')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' })).toBeDisabled()
  })

  it('does not infer request support when the canonical capability decision is false', () => {
    renderControl({
      capabilities: {
        ...supportedCapabilities,
        customerDisplay: { ...supportedCapabilities.customerDisplay, canRequestInversion: false },
      },
    })

    expect(screen.getByTestId('display-mode-request-control')).toBeInTheDocument()
    expect(screen.getByText('displayMode.explanations.actionUnavailable')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' })).toBeDisabled()
  })

  it('shows canonical physical truth and creates the exact opposite request', async () => {
    renderControl()

    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))

    await waitFor(() => {
      expect(serviceMocks.createDisplayModeRequest).toHaveBeenCalledWith('venue-1', 'terminal-1', true)
    })
  })

  it('prevents duplicate submissions while the POST is pending', async () => {
    let resolveRequest!: (value: ReturnType<typeof mutationResponse>) => void
    serviceMocks.createDisplayModeRequest.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          resolveRequest = resolve
        }),
    )
    renderControl()

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))
    const submitting = await screen.findByRole('button', { name: 'displayMode.actions.submitting' })
    expect(submitting).toBeDisabled()
    fireEvent.click(submitting)
    expect(serviceMocks.createDisplayModeRequest).toHaveBeenCalledTimes(1)

    resolveRequest(mutationResponse(pendingRequest))
    await screen.findByTestId('requested-display-state')
  })

  it('keeps physical truth separate from a pending intention and cancels with exact arguments', async () => {
    renderControl({ request: pendingRequest })

    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    expect(screen.getByTestId('requested-display-state')).toHaveTextContent('displayMode.physical.inverted')
    expect(screen.getByText(`formatted:${pendingRequest.requestedAt}`)).toBeInTheDocument()
    expect(screen.getByText(`formatted:${pendingRequest.expiresAt}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'displayMode.actions.requestInverted' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))

    await waitFor(() => {
      expect(serviceMocks.cancelDisplayModeRequest).toHaveBeenCalledWith('venue-1', 'terminal-1', 'request-1')
    })
  })

  it('publishes only a server-confirmed POST request into the existing detail row without changing physical truth', async () => {
    const { queryClient, invalidateQueries, setQueryData } = renderControl()
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))

    expect(await screen.findByTestId('requested-display-state')).toHaveTextContent('displayMode.physical.inverted')
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    expect(queryClient.getQueryData(['tpv', 'venue-1', 'terminal-1'])).toMatchObject({
      id: 'terminal-1',
      marker: 'preserved',
      customerDisplayInverted: false,
      customerDisplayRequest: pendingRequest,
    })
    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-1', 'terminal-1'] })
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpvs', 'venue-1'] })
    })
    expect(setQueryData).toHaveBeenCalledWith(['tpv', 'venue-1', 'terminal-1'], expect.any(Function))
  })

  it('does not create a partial detail cache row when POST succeeds without an existing row', async () => {
    const { queryClient } = renderControl({}, { seedDetail: false })
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))

    await screen.findByTestId('requested-display-state')
    expect(queryClient.getQueryData(['tpv', 'venue-1', 'terminal-1'])).toBeUndefined()
  })

  it('keeps confirmed PENDING in cache and activates polling even when invalidation/refetch fails', async () => {
    const { queryClient, invalidateQueries } = renderControl()
    invalidateQueries.mockRejectedValue(new Error('refetch failed'))

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))

    await screen.findByTestId('requested-display-state')
    await waitFor(() => {
      const cached = queryClient.getQueryData<{ customerDisplayInverted: boolean; customerDisplayRequest: DisplayModeRequest }>([
        'tpv',
        'venue-1',
        'terminal-1',
      ])
      expect(cached).toMatchObject({
        marker: 'preserved',
        customerDisplayInverted: false,
        customerDisplayRequest: pendingRequest,
      })
      expect(getDisplayModeRefetchInterval(cached?.customerDisplayRequest)).toBe(5000)
    })
  })

  it('scopes POST pending state to identity while A and B mutations overlap', async () => {
    const postA = deferred<ReturnType<typeof mutationResponse>>()
    const postB = deferred<ReturnType<typeof mutationResponse>>()
    serviceMocks.createDisplayModeRequest.mockImplementationOnce(() => postA.promise).mockImplementationOnce(() => postB.promise)
    const { queryClient, invalidateQueries, rerenderControl } = renderControl({
      venueId: 'venue-a',
      terminalId: 'terminal-a',
      customerDisplayInverted: false,
    })
    queryClient.setQueryData(['tpv', 'venue-b', 'terminal-b'], {
      id: 'terminal-b',
      marker: 'device-b',
      customerDisplayInverted: true,
      customerDisplayRequest: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))
    rerenderControl({
      venueId: 'venue-b',
      terminalId: 'terminal-b',
      customerDisplayInverted: true,
      request: null,
    })
    await waitFor(() => {
      expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
      expect(screen.getByRole('button', { name: 'displayMode.actions.requestStandard' })).toBeEnabled()
    })
    expect(screen.queryByRole('button', { name: 'displayMode.actions.submitting' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestStandard' }))
    expect(await screen.findByRole('button', { name: 'displayMode.actions.submitting' })).toBeDisabled()
    expect(serviceMocks.createDisplayModeRequest).toHaveBeenNthCalledWith(1, 'venue-a', 'terminal-a', true)
    expect(serviceMocks.createDisplayModeRequest).toHaveBeenNthCalledWith(2, 'venue-b', 'terminal-b', false)

    const requestA = { ...pendingRequest, requestId: 'request-a' }
    postA.resolve(mutationResponse(requestA))
    await waitFor(() => {
      expect(queryClient.getQueryData(['tpv', 'venue-a', 'terminal-a'])).toMatchObject({
        customerDisplayInverted: false,
        customerDisplayRequest: requestA,
      })
    })
    expect(screen.queryByTestId('requested-display-state')).not.toBeInTheDocument()
    expect(screen.queryByText('displayMode.feedback.requestCreated')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'displayMode.actions.submitting' })).toBeDisabled()
    expect(queryClient.getQueryData(['tpv', 'venue-b', 'terminal-b'])).toMatchObject({
      marker: 'device-b',
      customerDisplayInverted: true,
      customerDisplayRequest: null,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-a', 'terminal-a'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpvs', 'venue-a'] })
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-b', 'terminal-b'] })

    const requestB = { ...pendingRequest, requestId: 'request-b', desiredInverted: false }
    postB.resolve(mutationResponse(requestB, true))
    await waitFor(() => {
      expect(screen.getByTestId('requested-display-state')).toHaveTextContent('displayMode.physical.standard')
      expect(queryClient.getQueryData(['tpv', 'venue-b', 'terminal-b'])).toMatchObject({
        marker: 'device-b',
        customerDisplayInverted: true,
        customerDisplayRequest: requestB,
      })
    })
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-b', 'terminal-b'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpvs', 'venue-b'] })
  })

  it('scopes cancel pending state to identity while A and B mutations overlap', async () => {
    const cancelA = deferred<ReturnType<typeof mutationResponse>>()
    const cancelB = deferred<ReturnType<typeof mutationResponse>>()
    serviceMocks.cancelDisplayModeRequest.mockImplementationOnce(() => cancelA.promise).mockImplementationOnce(() => cancelB.promise)
    const requestA = { ...pendingRequest, requestId: 'request-a' }
    const requestB = { ...pendingRequest, requestId: 'request-b', desiredInverted: false }
    const { queryClient, invalidateQueries, rerenderControl } = renderControl({
      venueId: 'venue-a',
      terminalId: 'terminal-a',
      customerDisplayInverted: false,
      request: requestA,
    })
    queryClient.setQueryData(['tpv', 'venue-b', 'terminal-b'], {
      id: 'terminal-b',
      marker: 'device-b',
      customerDisplayInverted: true,
      customerDisplayRequest: requestB,
    })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))
    rerenderControl({
      venueId: 'venue-b',
      terminalId: 'terminal-b',
      customerDisplayInverted: true,
      request: requestB,
    })
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'displayMode.actions.cancel' })).toBeEnabled()
    })
    expect(screen.queryByRole('button', { name: 'displayMode.actions.cancelling' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))
    expect(await screen.findByRole('button', { name: 'displayMode.actions.cancelling' })).toBeDisabled()
    expect(serviceMocks.cancelDisplayModeRequest).toHaveBeenNthCalledWith(1, 'venue-a', 'terminal-a', 'request-a')
    expect(serviceMocks.cancelDisplayModeRequest).toHaveBeenNthCalledWith(2, 'venue-b', 'terminal-b', 'request-b')

    const cancelledA = { ...requestA, status: 'CANCELLED' as const, resolvedAt: '2026-08-31T12:02:00.000Z' }
    cancelA.resolve(mutationResponse(cancelledA))
    await waitFor(() => {
      expect(queryClient.getQueryData(['tpv', 'venue-a', 'terminal-a'])).toMatchObject({
        customerDisplayInverted: false,
        customerDisplayRequest: cancelledA,
      })
    })
    expect(screen.getByRole('button', { name: 'displayMode.actions.cancelling' })).toBeDisabled()
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-b', 'terminal-b'] })

    const cancelledB = { ...requestB, status: 'CANCELLED' as const, resolvedAt: '2026-08-31T12:03:00.000Z' }
    cancelB.resolve(mutationResponse(cancelledB, true))
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'displayMode.actions.requestStandard' })).toBeEnabled()
      expect(queryClient.getQueryData(['tpv', 'venue-b', 'terminal-b'])).toMatchObject({
        marker: 'device-b',
        customerDisplayInverted: true,
        customerDisplayRequest: cancelledB,
      })
    })
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-b', 'terminal-b'] })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpvs', 'venue-b'] })
  })

  it('resets local request, physical truth, and feedback when identity changes without a remount', async () => {
    serviceMocks.createDisplayModeRequest.mockRejectedValueOnce(new Error('device A failed'))
    const { rerenderControl } = renderControl({
      venueId: 'venue-a',
      terminalId: 'terminal-a',
      customerDisplayInverted: false,
      request: { ...pendingRequest, status: 'REJECTED', resultCode: 'APPLY_FAILED' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.retryInverted' }))
    expect(await screen.findByText('displayMode.feedback.createFailed')).toBeInTheDocument()

    rerenderControl({
      venueId: 'venue-b',
      terminalId: 'terminal-b',
      customerDisplayInverted: true,
      request: null,
    })

    await waitFor(() => {
      expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
      expect(screen.queryByTestId('requested-display-state')).not.toBeInTheDocument()
      expect(screen.queryByText('displayMode.feedback.createFailed')).not.toBeInTheDocument()
    })
  })

  it('publishes a confirmed DELETE request to stop polling without writing an assumed physical value', async () => {
    const { queryClient, invalidateQueries, setQueryData } = renderControl({ request: pendingRequest })
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))

    await waitFor(() => {
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-1', 'terminal-1'] })
      expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpvs', 'venue-1'] })
    })
    expect(queryClient.getQueryData(['tpv', 'venue-1', 'terminal-1'])).toMatchObject({
      marker: 'preserved',
      customerDisplayInverted: false,
      customerDisplayRequest: expect.objectContaining({ status: 'CANCELLED' }),
    })
    expect(setQueryData).toHaveBeenCalledWith(['tpv', 'venue-1', 'terminal-1'], expect.any(Function))
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
  })

  it.each(['REJECTED', 'EXPIRED'] as const)('explains %s/result code and retries the original intention', async status => {
    const request: DisplayModeRequest = {
      ...pendingRequest,
      status,
      resultCode: status === 'REJECTED' ? 'APPLY_FAILED' : 'ACK_AFTER_EXPIRY',
      resolvedAt: '2026-08-31T12:16:00.000Z',
    }
    renderControl({ request })

    expect(screen.getByText(`displayMode.statuses.${status}`)).toBeInTheDocument()
    expect(screen.getByText(`displayMode.resultCodes.${request.resultCode}`)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.retryInverted' }))

    await waitFor(() => {
      expect(serviceMocks.createDisplayModeRequest).toHaveBeenCalledWith('venue-1', 'terminal-1', true)
    })
  })

  it.each(['CANCELLED', 'SUPERSEDED'] as const)('treats %s as resolved but never as physical success', async status => {
    renderControl({
      request: { ...pendingRequest, status, resolvedAt: '2026-08-31T12:04:00.000Z' },
      customerDisplayInverted: false,
    })

    expect(screen.getByText(`displayMode.statuses.${status}`)).toBeInTheDocument()
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))

    await waitFor(() => {
      expect(serviceMocks.createDisplayModeRequest).toHaveBeenCalledWith('venue-1', 'terminal-1', true)
    })
  })

  it('treats APPLIED as resolved and requests the opposite of canonical physical truth', async () => {
    renderControl({
      request: { ...pendingRequest, status: 'APPLIED', resolvedAt: '2026-08-31T12:03:00.000Z' },
      customerDisplayInverted: true,
    })

    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestStandard' }))

    await waitFor(() => {
      expect(serviceMocks.createDisplayModeRequest).toHaveBeenCalledWith('venue-1', 'terminal-1', false)
    })
  })

  it('uses CANCEL_TOO_LATE details as confirmed physical truth and offers its opposite', async () => {
    const appliedRequest: DisplayModeRequest = {
      ...pendingRequest,
      status: 'APPLIED',
      resultCode: 'CANCEL_TOO_LATE',
      resolvedAt: '2026-08-31T12:02:00.000Z',
    }
    serviceMocks.cancelDisplayModeRequest.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'CANCEL_TOO_LATE',
          details: { customerDisplayInverted: true, request: appliedRequest },
        },
      },
    })
    renderControl({ request: pendingRequest, customerDisplayInverted: false })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))

    expect(await screen.findByText('displayMode.feedback.cancelTooLate')).toBeInTheDocument()
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.inverted')
    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestStandard' }))

    await waitFor(() => {
      expect(serviceMocks.createDisplayModeRequest).toHaveBeenCalledWith('venue-1', 'terminal-1', false)
    })
  })

  it('isolates deferred CANCEL_TOO_LATE from B while publishing validated confirmation only to A', async () => {
    const cancelA = deferred<never>()
    serviceMocks.cancelDisplayModeRequest.mockImplementationOnce(() => cancelA.promise)
    const appliedRequest: DisplayModeRequest = {
      ...pendingRequest,
      requestId: 'request-a',
      status: 'APPLIED',
      resultCode: 'CANCEL_TOO_LATE',
      resolvedAt: '2026-08-31T12:02:00.000Z',
    }
    const { queryClient, invalidateQueries, rerenderControl } = renderControl({
      venueId: 'venue-a',
      terminalId: 'terminal-a',
      customerDisplayInverted: false,
      request: { ...pendingRequest, requestId: 'request-a' },
    })
    queryClient.setQueryData(['tpv', 'venue-b', 'terminal-b'], {
      id: 'terminal-b',
      marker: 'device-b',
      customerDisplayInverted: false,
      customerDisplayRequest: null,
    })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))
    rerenderControl({
      venueId: 'venue-b',
      terminalId: 'terminal-b',
      customerDisplayInverted: false,
      request: null,
    })
    cancelA.reject({
      response: {
        status: 409,
        data: {
          code: 'CANCEL_TOO_LATE',
          details: { customerDisplayInverted: true, request: appliedRequest },
        },
      },
    })

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' })).toBeEnabled()
    })
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    expect(screen.queryByText('displayMode.feedback.cancelTooLate')).not.toBeInTheDocument()
    expect(queryClient.getQueryData(['tpv', 'venue-a', 'terminal-a'])).toMatchObject({
      customerDisplayInverted: true,
      customerDisplayRequest: appliedRequest,
    })
    expect(queryClient.getQueryData(['tpv', 'venue-b', 'terminal-b'])).toMatchObject({
      marker: 'device-b',
      customerDisplayInverted: false,
      customerDisplayRequest: null,
    })
    expect(invalidateQueries).toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-a', 'terminal-a'] })
    expect(invalidateQueries).not.toHaveBeenCalledWith({ queryKey: ['tpv', 'venue-b', 'terminal-b'] })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))
    await waitFor(() => {
      expect(serviceMocks.createDisplayModeRequest).toHaveBeenLastCalledWith('venue-b', 'terminal-b', true)
    })
  })

  it('rejects malformed CANCEL_TOO_LATE request details instead of indexing translation maps', async () => {
    serviceMocks.cancelDisplayModeRequest.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: 'CANCEL_TOO_LATE',
          details: {
            customerDisplayInverted: true,
            request: { ...pendingRequest, status: 'ARBITRARY_STATUS' },
          },
        },
      },
    })
    const { queryClient } = renderControl({ request: pendingRequest, customerDisplayInverted: false })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.cancel' }))

    expect(await screen.findByText('displayMode.feedback.cancelFailed')).toBeInTheDocument()
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    expect(screen.getByText('displayMode.statuses.PENDING')).toBeInTheDocument()
    expect(queryClient.getQueryData(['tpv', 'venue-1', 'terminal-1'])).toMatchObject({
      customerDisplayInverted: false,
      customerDisplayRequest: pendingRequest,
    })
  })

  it('keeps physical truth and translated retry feedback after a generic create failure', async () => {
    serviceMocks.createDisplayModeRequest.mockRejectedValueOnce(new Error('network down'))
    renderControl({ customerDisplayInverted: false })

    fireEvent.click(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' }))

    expect(await screen.findByText('displayMode.feedback.createFailed')).toBeInTheDocument()
    expect(screen.getByTestId('physical-display-state')).toHaveTextContent('displayMode.physical.standard')
    expect(screen.getByRole('button', { name: 'displayMode.actions.requestInverted' })).toBeEnabled()
  })

  it('degrades invalid or missing request times safely', () => {
    renderControl({ request: { ...pendingRequest, requestedAt: 'not-a-date', expiresAt: '' } })

    expect(screen.getAllByText('displayMode.requested.notAvailable')).toHaveLength(2)
    expect(screen.queryByText('Invalid Date')).not.toBeInTheDocument()
    expect(screen.queryByText('formatted:not-a-date')).not.toBeInTheDocument()
    expect(screen.queryByText('formatted:')).not.toBeInTheDocument()
  })
})

describe('getDisplayModeRefetchInterval', () => {
  it('polls exactly every 5 seconds only while the canonical request is pending', () => {
    expect(getDisplayModeRefetchInterval(pendingRequest)).toBe(5000)
  })

  it.each([null, undefined, 'APPLIED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'SUPERSEDED'] as const)(
    'stops request polling for %s',
    value => {
      const request = typeof value === 'string' ? { ...pendingRequest, status: value } : value
      expect(getDisplayModeRefetchInterval(request)).toBe(false)
    },
  )
})
