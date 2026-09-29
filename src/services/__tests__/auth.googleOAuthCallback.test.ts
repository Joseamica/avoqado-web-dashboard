/**
 * 🔴 El `state` de Google viaja al servidor junto al `code` (login CSRF, 27-sep): el servidor sólo canjea
 * el code si ese state coincide con la cookie que puso al dar la URL de Google en ESTE navegador.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { googleOAuthCallback } from '@/services/auth.service'

const mockPost = vi.fn()
vi.mock('@/api', () => ({
  default: { post: (...args: unknown[]) => mockPost(...args) },
  publicApi: {},
}))

beforeEach(() => {
  mockPost.mockReset()
  mockPost.mockResolvedValue({ data: { success: true } })
})

describe('googleOAuthCallback()', () => {
  it('🔴 manda el code Y el state que Google devolvió', async () => {
    await googleOAuthCallback('c-1', 's-1')
    expect(mockPost).toHaveBeenCalledWith('/api/v1/dashboard/auth/google/callback', { code: 'c-1', state: 's-1' })
  })

  it('con el alta, manda también el sobre', async () => {
    await googleOAuthCallback('c-1', 's-1', { legalVersion: 'v1' })
    expect(mockPost).toHaveBeenCalledWith('/api/v1/dashboard/auth/google/callback', {
      code: 'c-1',
      state: 's-1',
      signup: { legalVersion: 'v1' },
    })
  })

  it('sin state no inventa uno (el servidor decide y rechaza)', async () => {
    await googleOAuthCallback('c-1', null)
    expect(mockPost).toHaveBeenCalledWith('/api/v1/dashboard/auth/google/callback', { code: 'c-1' })
  })
})
