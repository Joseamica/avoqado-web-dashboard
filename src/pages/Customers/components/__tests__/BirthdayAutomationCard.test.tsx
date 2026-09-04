import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { BirthdayAutomationCard } from '../BirthdayAutomationCard'

/**
 * La felicitación de cumpleaños en el dashboard.
 *
 * 🔴 Lo que estas pruebas fijan sobre todo son dos cosas que desinforman si se rompen:
 *
 *  1. **Son TRES estados, no dos.** «Sin configurar» (nunca la tocó) no es lo mismo que
 *     «pausada» (la configuró y la apagó). Colapsarlos haría que un dueño creyera que ya la
 *     tiene lista cuando ni la ha abierto.
 *  2. **Encender exige `marketing:send`**, que el servidor comprueba. Quien no lo tiene ve
 *     el interruptor deshabilitado CON el porqué — nunca desaparecido: apagado se ve y se
 *     explica.
 */
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: unknown, opts?: any) => (typeof key === 'string' ? (opts?.count !== undefined ? `${key}:${opts.count}` : key) : String(key)) }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('../CampaignBlocksEditor', () => ({ CampaignBlocksEditor: () => <div data-testid="blocks-editor" /> }))

// El permiso se controla por prueba: es justo lo que se quiere ejercitar.
const permisos = { valor: new Set<string>() }
vi.mock('@/components/PermissionGate', () => ({
  PermissionGate: ({ permission, children, fallback }: any) =>
    permisos.valor.has(permission) ? <>{children}</> : <>{fallback ?? null}</>,
}))

const mockGet = vi.fn()
const mockSave = vi.fn()
vi.mock('@/services/marketing.service', () => ({
  default: {
    getBirthdayAutomation: (...a: unknown[]) => mockGet(...a),
    saveBirthdayAutomation: (...a: unknown[]) => mockSave(...a),
  },
}))

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <BirthdayAutomationCard venueId="v1" />
    </QueryClientProvider>,
  )
}

const configurada = (over: Record<string, unknown> = {}) => ({
  automation: {
    id: 'a1',
    status: 'ACTIVE',
    subject: '¡Feliz cumpleaños!',
    contentBlocks: [{ type: 'paragraph', text: 'Felicidades' }],
    daysBefore: 7,
    lastEvaluatedLocalDate: '2026-09-03',
    createdAt: '2026-09-01T00:00:00Z',
    updatedAt: '2026-09-01T00:00:00Z',
    ...over,
  },
})

beforeEach(() => {
  vi.clearAllMocks()
  permisos.valor = new Set(['marketing:manage', 'marketing:send'])
  mockSave.mockResolvedValue({})
})

describe('BirthdayAutomationCard — los tres estados', () => {
  it('nunca configurada: lo dice, y ofrece configurarla', async () => {
    mockGet.mockResolvedValue({ automation: null })
    pintar()
    await waitFor(() => expect(screen.getByTestId('birthday-status')).toHaveTextContent('birthday.notConfigured'))
    expect(screen.getByTestId('birthday-configure')).toHaveTextContent('birthday.configure')
  })

  it('encendida: lo dice y con cuántos días de antelación', async () => {
    mockGet.mockResolvedValue(configurada())
    pintar()
    await waitFor(() => expect(screen.getByTestId('birthday-status')).toHaveTextContent('birthday.on'))
    expect(screen.getByText('birthday.onDescription:7')).toBeInTheDocument()
  })

  it('🔴 pausada NO es lo mismo que sin configurar', async () => {
    // Colapsarlos haría creer al dueño que ya la tiene lista cuando ni la ha abierto.
    mockGet.mockResolvedValue(configurada({ status: 'PAUSED' }))
    pintar()
    await waitFor(() => expect(screen.getByTestId('birthday-status')).toHaveTextContent('birthday.paused'))
    expect(screen.getByTestId('birthday-status')).not.toHaveTextContent('birthday.notConfigured')
    // Y el botón dice «editar», no «configurar»: ya existe.
    expect(screen.getByTestId('birthday-configure')).toHaveTextContent('birthday.edit')
  })
})

describe('BirthdayAutomationCard — permisos y guardado', () => {
  it('sin `marketing:manage` no se puede ni abrir', async () => {
    permisos.valor = new Set()
    mockGet.mockResolvedValue({ automation: null })
    pintar()
    await waitFor(() => expect(screen.getByTestId('birthday-status')).toBeInTheDocument())
    expect(screen.queryByTestId('birthday-configure')).not.toBeInTheDocument()
  })

  it('🔴 sin `marketing:send` el interruptor se VE deshabilitado y se explica', async () => {
    permisos.valor = new Set(['marketing:manage'])
    mockGet.mockResolvedValue(configurada({ status: 'PAUSED' }))
    pintar()

    await userEvent.click(await screen.findByTestId('birthday-configure'))

    // Apagado se ve y se explica: nunca desaparece en silencio.
    expect(screen.getByText('birthday.turnOnNoPermission')).toBeInTheDocument()
    expect(screen.queryByTestId('birthday-switch')).not.toBeInTheDocument()
  })

  it('con `marketing:send` sí se puede encender', async () => {
    mockGet.mockResolvedValue(configurada({ status: 'PAUSED' }))
    pintar()

    await userEvent.click(await screen.findByTestId('birthday-configure'))

    expect(screen.getByTestId('birthday-switch')).toBeInTheDocument()
    expect(screen.queryByText('birthday.turnOnNoPermission')).not.toBeInTheDocument()
  })

  it('al abrir SIN configuración previa propone un texto, no una hoja en blanco', async () => {
    mockGet.mockResolvedValue({ automation: null })
    pintar()

    await userEvent.click(await screen.findByTestId('birthday-configure'))

    const asunto = screen.getByLabelText('campaigns.fields.subject') as HTMLInputElement
    expect(asunto.value).toBe('birthday.defaults.subject')
  })

  it('guarda con lo que hay en pantalla', async () => {
    mockGet.mockResolvedValue(configurada({ status: 'PAUSED', daysBefore: 3 }))
    pintar()

    await userEvent.click(await screen.findByTestId('birthday-configure'))
    await userEvent.click(screen.getByTestId('birthday-save'))

    await waitFor(() =>
      expect(mockSave).toHaveBeenCalledWith('v1', expect.objectContaining({ daysBefore: 3, activa: false })),
    )
  })
})
