import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import axios, { AxiosError } from 'axios'
import { server } from '@/test/setup'
import { http, HttpResponse } from 'msw'
import { createUploadId, getDocumentToken, publicDocuments } from '../publicDocuments.service'

const id = 'cm123456789012345678901234'
const token = 'a'.repeat(64)
beforeEach(() => {
  sessionStorage.clear()
  history.replaceState({}, '', '/')
})
afterEach(() => vi.unstubAllEnvs())
describe('private public-document transport', () => {
  it('keeps the secret outside HTTP URLs, strips hash, and resumes only this request', () => {
    history.replaceState({}, '', `/documentos/${id}#token=${token}`)
    expect(getDocumentToken(id)).toBe(token)
    expect(location.hash).toBe('')
    expect(getDocumentToken(id)).toBe(token)
    expect(getDocumentToken('other')).toBeNull()
  })
  it('does not fall back to a previous token when an invalid new fragment is present', () => {
    sessionStorage.setItem(`document-token:${id}`, token)
    history.replaceState({}, '', `/documentos/${id}#token=invalid`)
    expect(getDocumentToken(id)).toBeNull()
  })
  it('generates cuid v1 upload ids without dependencies', () => {
    const ids = Array.from({ length: 100 }, createUploadId)
    expect(ids.every(value => /^c[a-z0-9]{24}$/.test(value))).toBe(true)
    expect(new Set(ids).size).toBe(100)
  })
  it('sends only document auth and no cookies; a rejected request never goes to login or retries', async () => {
    let requests = 0
    server.use(
      http.get('*/api/v1/public/document-requests/:id', ({ request }) => {
        requests++
        expect(request.headers.get('X-Document-Token')).toBe(token)
        expect(request.headers.get('authorization')).toBeNull()
        expect(request.credentials).toBe('omit')
        expect(request.url).not.toContain(token)
        return HttpResponse.json({}, { status: 401 })
      }),
    )
    await expect(publicDocuments.get(id, token)).rejects.toMatchObject({ response: { status: 401 } })
    expect(requests).toBe(1)
    expect(location.pathname).toBe('/')
  })
  it.each([
    { origin: 'same-origin', api: window.location.origin, adapter: 'fetch' },
    { origin: 'cross-origin', api: 'https://documents-api.example.test', adapter: 'xhr' },
  ])('retries a lost $origin upload response with the same uploadId', async ({ api, adapter }) => {
    const uploadId = createUploadId()
    const received: string[] = []
    const file = new File(['pdf'], 'address.pdf', { type: 'application/pdf' })
    const saved = new Map<string, { id: string; key: string; fileName: string; mimeType: string; sizeBytes: number }>()
    const createClient = axios.create.bind(axios)
    const create = vi.spyOn(axios, 'create').mockImplementation(config => {
      const isolatedClient = createClient(config)
      isolatedClient.interceptors.request.use(request => {
        expect(request.adapter).toBe(adapter)
        // Simulate response loss at the transport boundary, independent of MSW's XHR error events.
        request.adapter = async request => {
          const form = request.data as FormData
          const key = String(form.get('uploadId'))
          expect(form.get('file')).toBe(file)
          expect(request.headers.get('X-Document-Token')).toBe(token)
          expect(request.withCredentials).toBe(false)
          received.push(key)
          if (!saved.has(key))
            saved.set(key, { id: 'file1', key: 'address', fileName: 'address.pdf', mimeType: 'application/pdf', sizeBytes: 3 })
          if (received.length === 1) throw new AxiosError('Response lost after saving', 'ERR_NETWORK', request)
          return { data: { document: saved.get(key) }, status: 200, statusText: 'OK', headers: {}, config: request }
        }
        return request
      })
      return isolatedClient
    })
    vi.stubEnv('VITE_API_URL', api)
    vi.resetModules()
    const { publicDocuments: isolatedDocuments } = await import('../publicDocuments.service')
    expect(create).toHaveBeenCalledOnce()
    await expect(isolatedDocuments.upload(id, token, 'address', file, uploadId, vi.fn())).rejects.toMatchObject({ code: 'ERR_NETWORK' })
    expect(received).toHaveLength(1)
    await expect(isolatedDocuments.upload(id, token, 'address', file, uploadId, vi.fn())).resolves.toMatchObject({ id: 'file1' })
    expect(received).toEqual([uploadId, uploadId])
    expect(saved.size).toBe(1)
  })
})
