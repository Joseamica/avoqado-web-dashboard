import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

import api from '@/api'
import {
  copyCustomerDisplay,
  getCustomerDisplay,
  listCustomerDisplayDevices,
  previewCustomerDisplay,
  resetCustomerDisplay,
  saveCustomerDisplay,
  uploadCustomerDisplayLogo,
  type CustomerDisplayDraft,
} from '@/services/customerDisplay.service'

type Spy = ReturnType<typeof vi.fn>
const mocked = api as unknown as { get: Spy; post: Spy; put: Spy }
const BASE = '/api/v1/dashboard/venues/v1/terminals/t1/customer-display'
const conData = (data: unknown) => ({ data: { data } })
const BORRADOR: CustomerDisplayDraft = { theme: 'DARK', accentColor: '#0E7C66', logoAssetId: null, welcomeText: 'Hola', thanksText: '' }

beforeEach(() => vi.clearAllMocks())

describe('customerDisplay.service', () => {
  it('getCustomerDisplay: GET a la raíz del dispositivo y desenvuelve data', async () => {
    mocked.get.mockResolvedValue(conData({ editToken: 'factory' }))
    await expect(getCustomerDisplay('v1', 't1')).resolves.toEqual({ editToken: 'factory' })
    expect(mocked.get).toHaveBeenCalledWith(BASE)
  })
  it('previewCustomerDisplay: manda el borrador y el número de la petición', async () => {
    mocked.post.mockResolvedValue(conData({ previewSeq: 7 }))
    await previewCustomerDisplay('v1', 't1', BORRADOR, 7)
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/preview`, { design: BORRADOR, previewSeq: 7 })
  })
  it('saveCustomerDisplay: PUT con el token LEÍDO (CAS) y sólo los cinco campos del borrador', async () => {
    mocked.put.mockResolvedValue(conData({ editToken: 'd1:2' }))
    await saveCustomerDisplay('v1', 't1', 'd1:1', BORRADOR)
    expect(mocked.put).toHaveBeenCalledWith(BASE, { expectedEditToken: 'd1:1', design: BORRADOR })
    expect(Object.keys(mocked.put.mock.calls[0][1].design).sort()).toEqual([
      'accentColor',
      'logoAssetId',
      'thanksText',
      'theme',
      'welcomeText',
    ])
  })
  it('resetCustomerDisplay: POST /reset con el token', async () => {
    mocked.post.mockResolvedValue(conData({ editToken: 'd1:3' }))
    await resetCustomerDisplay('v1', 't1', 'd1:2')
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/reset`, { expectedEditToken: 'd1:2' })
  })
  it('🔴 uploadCustomerDisplayLogo: kind=logo en la QUERY y el multipart lleva SÓLO el archivo (un campo de texto es un 422)', async () => {
    mocked.post.mockResolvedValue(conData({ assetId: 'a1' }))
    const file = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'logo.png', { type: 'image/png' })
    await uploadCustomerDisplayLogo('v1', 't1', file)
    const [url, form] = mocked.post.mock.calls[0] as [string, FormData]
    expect(url).toBe(`${BASE}/assets?kind=logo`)
    expect([...form.keys()]).toEqual(['file'])
    expect(form.get('file')).toBe(file)
  })
  it('copyCustomerDisplay: la ruta es la del ORIGEN y el cuerpo lleva el token de cada uno', async () => {
    mocked.post.mockResolvedValue(conData({ copied: ['t2'], promosOmitted: true }))
    const r = await copyCustomerDisplay('v1', { terminalId: 't1', editToken: 'd1:2' }, [{ terminalId: 't2', editToken: 'factory' }])
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/copy`, {
      source: { terminalId: 't1', editToken: 'd1:2' },
      targets: [{ terminalId: 't2', editToken: 'factory' }],
    })
    expect(r).toEqual({ copied: ['t2'], promosOmitted: true })
  })
  it('listCustomerDisplayDevices: take y cursor como parámetros; sin cursor no lo manda', async () => {
    mocked.get.mockResolvedValue(conData({ total: 0, nextCursor: null, devices: [] }))
    await listCustomerDisplayDevices('v1', { take: 50 })
    await listCustomerDisplayDevices('v1', { take: 50, cursor: 't9' })
    expect(mocked.get).toHaveBeenNthCalledWith(1, '/api/v1/dashboard/venues/v1/customer-display/devices', { params: { take: 50 } })
    expect(mocked.get).toHaveBeenNthCalledWith(2, '/api/v1/dashboard/venues/v1/customer-display/devices', {
      params: { take: 50, cursor: 't9' },
    })
  })
})
