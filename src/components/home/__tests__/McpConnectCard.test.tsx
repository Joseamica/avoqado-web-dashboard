/**
 * La tarjeta del Home que antes era el "chatbot" (un input que mandaba
 * `chatbot:openWithMessage` a una burbuja apagada desde junio de 2026) ahora es
 * la entrada permanente a la guía "Conecta tu IA a Avoqado" (Claude / Codex).
 *
 * Textos REALES de `locales/es` para que una clave que falte se vea aquí y no
 * en producción como `newHome.chatbot.connectCta` pelón.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import es from '@/locales/es/home.json'
import esVenue from '@/locales/es/venue.json'
import { McpConnectCard } from '../McpConnectCard'

const bundles: Record<string, unknown> = { home: es, venue: esVenue }
const traducir = (ns: string) => (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], bundles[ns])
  if (opts?.returnObjects) return raw
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_, k) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({ t: traducir(ns ?? 'home'), i18n: { language: 'es' } }),
}))

const ejemplos = es.newHome.chatbot.placeholders as string[]

describe('McpConnectCard', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('muestra una pregunta de ejemplo y el botón «Conectar tu IA»', () => {
    render(<McpConnectCard />)
    expect(screen.getByText(ejemplos[0])).toBeInTheDocument()
    expect(screen.getByText(es.newHome.chatbot.connectCta)).toBeInTheDocument()
  })

  it('rota la pregunta de ejemplo cada 3.5 s', () => {
    render(<McpConnectCard />)
    expect(screen.getByText(ejemplos[0])).toBeInTheDocument()
    act(() => {
      vi.advanceTimersByTime(3500)
    })
    expect(screen.queryByText(ejemplos[0])).not.toBeInTheDocument()
    expect(screen.getByText(ejemplos[1])).toBeInTheDocument()
  })

  it('al hacer clic abre la guía de conexión con las pestañas Claude y Codex', () => {
    render(<McpConnectCard />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: es.mcpAnnouncement.dialogTitle }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(es.mcpAnnouncement.dialogTitle)
    expect(dialog).toHaveTextContent(esVenue.edit.integrations.mcp.tabClaude)
    expect(dialog).toHaveTextContent(esVenue.edit.integrations.mcp.tabCodex)
  })

  it('con Enter y con Espacio también se abre (accesible por teclado)', () => {
    render(<McpConnectCard />)
    const tarjeta = screen.getByRole('button', { name: es.mcpAnnouncement.dialogTitle })

    fireEvent.keyDown(tarjeta, { key: 'Enter' })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('no vuelve a disparar la señal del chatbot viejo ni deja un campo de texto', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent')
    render(<McpConnectCard />)
    fireEvent.click(screen.getByRole('button', { name: es.mcpAnnouncement.dialogTitle }))

    const señales = dispatch.mock.calls.map(([e]) => (e as Event).type)
    expect(señales).not.toContain('chatbot:openWithMessage')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })

  it('conserva el ancla del tour de bienvenida', () => {
    const { container } = render(<McpConnectCard />)
    expect(container.querySelector('[data-tour="home-chatbot-overview"]')).not.toBeNull()
  })
})
