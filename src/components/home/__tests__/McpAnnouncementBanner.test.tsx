/**
 * Guardia del refactor: el banner "Novedad: conecta Avoqado a tu IA" sigue
 * abriendo la MISMA guía después de mover su diálogo a `McpConnectDialog`,
 * que ahora comparte con la tarjeta del Home.
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import es from '@/locales/es/home.json'
import esVenue from '@/locales/es/venue.json'
import { McpAnnouncementBanner } from '../McpAnnouncementBanner'

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

describe('McpAnnouncementBanner', () => {
  it('el botón «Ver cómo» abre la guía de conexión', () => {
    render(<McpAnnouncementBanner />)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: es.mcpAnnouncement.cta }))

    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveTextContent(es.mcpAnnouncement.dialogTitle)
    expect(dialog).toHaveTextContent(esVenue.edit.integrations.mcp.tabClaude)
  })
})
