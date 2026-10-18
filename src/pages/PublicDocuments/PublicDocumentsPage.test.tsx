import { act, fireEvent, render, screen, waitFor, cleanup } from '@testing-library/react'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PublicDocumentsPage from './PublicDocumentsPage'
import i18n from './i18n'
import { publicDocuments, type DocumentRequest } from '@/services/publicDocuments.service'
vi.mock('@/services/publicDocuments.service', async () => {
  const actual = await vi.importActual<typeof import('@/services/publicDocuments.service')>('@/services/publicDocuments.service')
  return { ...actual, publicDocuments: { get: vi.fn(), upload: vi.fn(), remove: vi.fn(), discardUpload: vi.fn(), submit: vi.fn() } }
})
const id = 'cm123456789012345678901234'
const token = 'a'.repeat(64)
const file = { id: 'file1', key: 'address', fileName: 'domicilio.pdf', mimeType: 'application/pdf', sizeBytes: 3 }
const request: DocumentRequest = {
  id,
  provider: 'ANGELPAY',
  entityType: 'PERSONA_FISICA',
  status: 'DRAFT',
  expiresAt: '2026-10-31T00:00:00Z',
  documents: [],
  requirements: [{ key: 'address', label: 'Comprobante de domicilio', description: 'Reciente y legible', required: true, maxFiles: 2 }],
  limits: { maxFileBytes: 8388608, maxTotalBytes: 67108864, maxFiles: 24, maxUploadAttempts: 40 },
}
function mount() {
  return render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <PublicDocumentsPage requestId={id} />
    </QueryClientProvider>,
  )
}
beforeEach(() => {
  void i18n.changeLanguage('es')
  history.replaceState({}, '', `/documentos/${id}#token=${token}`)
  sessionStorage.clear()
  Object.defineProperty(navigator, 'onLine', { configurable: true, value: true })
  onlineManager.setOnline(true)
  vi.mocked(publicDocuments.get).mockResolvedValue(structuredClone(request))
})
afterEach(cleanup)
describe('WhatsApp document delivery without an account', () => {
  it.each(['ANGELPAY', 'BLUMON'] as const)('renders requirements from %s for both entity types', async provider => {
    for (const entityType of ['PERSONA_FISICA', 'PERSONA_MORAL'] as const) {
      vi.mocked(publicDocuments.get).mockResolvedValue({ ...request, provider, entityType })
      const view = mount()
      expect(await screen.findByText('Comprobante de domicilio')).toBeVisible()
      expect(screen.getByText('Reciente y legible')).toBeVisible()
      expect(screen.getByText(provider === 'ANGELPAY' ? 'AngelPay' : 'Blumon')).toBeVisible()
      expect(screen.getByText(entityType === 'PERSONA_FISICA' ? 'Persona física' : 'Persona moral')).toBeVisible()
      expect(screen.queryByText(/iniciar sesión/i)).not.toBeInTheDocument()
      view.unmount()
      history.replaceState({}, '', `/documentos/${id}#token=${token}`)
    }
  })
  it('requires the private link before fetching', async () => {
    history.replaceState({}, '', `/documentos/${id}`)
    mount()
    expect(await screen.findByText('Abre la liga completa de WhatsApp')).toBeVisible()
    expect(publicDocuments.get).not.toHaveBeenCalled()
  })
  it.each([404, 410])('explains an invalid, expired or revoked link (%s)', async status => {
    vi.mocked(publicDocuments.get).mockRejectedValue({ response: { status } })
    mount()
    expect(await screen.findByText('Pide una nueva liga a quien te la envió.')).toBeVisible()
    expect(location.pathname).toContain('/documentos/')
  })
  it('restores confirmed files and only shows receipt after submission', async () => {
    vi.mocked(publicDocuments.get).mockResolvedValue({ ...request, documents: [file] })
    const view = mount()
    expect(await screen.findByText('domicilio.pdf')).toBeVisible()
    view.unmount()
    vi.mocked(publicDocuments.get).mockResolvedValue({ ...request, status: 'SUBMITTED', requirements: [], documents: [] })
    mount()
    expect(await screen.findByText('Recibimos tus documentos')).toBeVisible()
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
  })
  it('retries an uncertain upload with its original id, then enables submission only after confirmation', async () => {
    vi.mocked(publicDocuments.upload).mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce(file)
    mount()
    const input = await screen.findByLabelText('Agregar archivo: Comprobante de domicilio')
    fireEvent.change(input, { target: { files: [new File(['pdf'], 'domicilio.pdf', { type: 'application/pdf' })] } })
    await screen.findByRole('button', { name: 'Reintentar' })
    const firstId = vi.mocked(publicDocuments.upload).mock.calls[0][4]
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(publicDocuments.upload).toHaveBeenCalledTimes(2))
    expect(vi.mocked(publicDocuments.upload).mock.calls[1][4]).toBe(firstId)
    expect(await screen.findByText('Guardado')).toBeVisible()
  })
  it('keeps upload progress separate from server confirmation and disables submit while uploading', async () => {
    vi.mocked(publicDocuments.upload).mockImplementation((_id, _token, _key, _file, _uploadId, progress) => {
      progress(100)
      return new Promise(() => {})
    })
    mount()
    fireEvent.change(await screen.findByLabelText('Agregar archivo: Comprobante de domicilio'), {
      target: { files: [new File(['pdf'], 'doc.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByText('Confirmando archivo…')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enviar documentos' })).toBeDisabled()
  })
  it('requires contact and consent, and submits once with normalized phone', async () => {
    vi.mocked(publicDocuments.get).mockResolvedValue({ ...request, documents: [file] })
    vi.mocked(publicDocuments.submit).mockResolvedValue({ id, status: 'SUBMITTED' })
    mount()
    await screen.findByText('domicilio.pdf')
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Mi negocio' } })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Pérez' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Celular (10 dígitos)'), { target: { value: '55 1234 5678' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar documentos' }))
    expect(await screen.findByText('Recibimos tus documentos')).toBeVisible()
    expect(publicDocuments.submit).toHaveBeenCalledWith(id, token, expect.objectContaining({ phone: '5512345678', privacyAccepted: true }))
    expect(publicDocuments.submit).toHaveBeenCalledTimes(1)
  })
  it('discards an uncertain upload on the server before replacing it and submitting', async () => {
    vi.mocked(publicDocuments.upload).mockRejectedValueOnce(new Error('storage')).mockResolvedValueOnce(file)
    vi.mocked(publicDocuments.discardUpload).mockResolvedValue(undefined)
    vi.mocked(publicDocuments.submit).mockResolvedValue({ id, status: 'SUBMITTED' })
    mount()
    fireEvent.change(await screen.findByLabelText('Agregar archivo: Comprobante de domicilio'), {
      target: { files: [new File(['bad'], 'fallido.pdf', { type: 'application/pdf' })] },
    })
    await screen.findByRole('button', { name: 'Reintentar' })
    const uploadId = vi.mocked(publicDocuments.upload).mock.calls[0][4]
    fireEvent.click(screen.getByRole('button', { name: /^Quitar$/ }))
    await waitFor(() => expect(publicDocuments.discardUpload).toHaveBeenCalledWith(id, token, uploadId))
    await waitFor(() => expect(screen.queryByText('fallido.pdf')).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Agregar archivo: Comprobante de domicilio'), {
      target: { files: [new File(['pdf'], 'domicilio.pdf', { type: 'application/pdf' })] },
    })
    await screen.findByText('Guardado')
    fireEvent.change(screen.getByLabelText('Nombre del negocio'), { target: { value: 'Mi negocio' } })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana Pérez' } })
    fireEvent.change(screen.getByLabelText('Correo electrónico'), { target: { value: 'ana@example.com' } })
    fireEvent.change(screen.getByLabelText('Celular (10 dígitos)'), { target: { value: '5512345678' } })
    fireEvent.click(screen.getByRole('checkbox'))
    fireEvent.click(screen.getByRole('button', { name: 'Enviar documentos' }))
    expect(await screen.findByText('Recibimos tus documentos')).toBeVisible()
  })
  it('explains permanent file rejection and offers removal instead of retrying identical bytes', async () => {
    vi.mocked(publicDocuments.upload).mockRejectedValue({
      response: { status: 422, data: { message: 'El PDF contiene contenido activo.' } },
    })
    mount()
    fireEvent.change(await screen.findByLabelText('Agregar archivo: Comprobante de domicilio'), {
      target: { files: [new File(['pdf'], 'activo.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByText('El PDF contiene contenido activo.')).toBeVisible()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /^Quitar$/ })).toBeVisible()
  })
  it('retains an uncertain file if discarding it fails', async () => {
    vi.mocked(publicDocuments.upload).mockRejectedValue(new Error('storage'))
    vi.mocked(publicDocuments.discardUpload).mockRejectedValue(new Error('network'))
    mount()
    fireEvent.change(await screen.findByLabelText('Agregar archivo: Comprobante de domicilio'), {
      target: { files: [new File(['pdf'], 'fallido.pdf', { type: 'application/pdf' })] },
    })
    await screen.findByRole('button', { name: 'Reintentar' })
    fireEvent.click(screen.getByRole('button', { name: /^Quitar$/ }))
    expect(await screen.findByRole('alert')).toBeVisible()
    expect(screen.getByText('fallido.pdf')).toBeVisible()
  })
  it('recovers an uncertain upload after reload and blocks submission until server discard confirms', async () => {
    const uploadId = 'cm123456789012345678901236'
    vi.mocked(publicDocuments.get).mockResolvedValue({
      ...request,
      documents: [file],
      pendingUploads: [{ uploadId, key: 'address', fileName: 'inconcluso.pdf' }],
    })
    vi.mocked(publicDocuments.discardUpload).mockImplementation(async () => {
      vi.mocked(publicDocuments.get).mockResolvedValue({ ...request, documents: [file], pendingUploads: [] })
    })
    mount()
    expect(await screen.findByText('inconcluso.pdf')).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enviar documentos' })).toBeDisabled()
    expect(screen.queryByRole('button', { name: 'Reintentar' })).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /^Quitar$/ }))
    await waitFor(() => expect(publicDocuments.discardUpload).toHaveBeenCalledWith(id, token, uploadId))
    await waitFor(() => expect(screen.queryByText('inconcluso.pdf')).not.toBeInTheDocument())
    expect(screen.getByRole('button', { name: 'Enviar documentos' })).toBeEnabled()
    expect(publicDocuments.upload).not.toHaveBeenCalled()
  })
  it('explains loss of internet without dropping files or redirecting to login', async () => {
    mount()
    await screen.findByText('Comprobante de domicilio')
    act(() => {
      Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
      window.dispatchEvent(new Event('offline'))
    })
    expect(screen.getByText(/Sin conexión/)).toBeVisible()
    expect(screen.getByRole('button', { name: 'Enviar documentos' })).toBeDisabled()
  })
  it('saves a dropped file under its requirement and keeps the file picker available', async () => {
    vi.mocked(publicDocuments.upload).mockResolvedValue(file)
    mount()
    const region = await screen.findByRole('region', { name: 'Comprobante de domicilio' })
    const dropped = new File(['pdf'], 'domicilio.pdf', { type: 'application/pdf' })
    expect(fireEvent.drop(region, { dataTransfer: { types: ['Files'], files: [dropped] } })).toBe(false)
    expect(await screen.findByText('Guardado')).toBeVisible()
    expect(screen.getByText('1 de 1 requisitos completos')).toBeVisible()
    expect(publicDocuments.upload).toHaveBeenCalledWith(id, token, 'address', dropped, expect.any(String), expect.any(Function))
    expect(screen.getByLabelText('Agregar archivo: Comprobante de domicilio')).toBeEnabled()
  })
  it('highlights the destination while a file is over it and clears it on leaving', async () => {
    mount()
    const region = await screen.findByRole('region', { name: 'Comprobante de domicilio' })
    fireEvent.dragEnter(region, { dataTransfer: { types: ['Files'] } })
    expect(screen.getByText('Suéltalo aquí')).toBeVisible()
    fireEvent.dragLeave(region)
    expect(screen.queryByText('Suéltalo aquí')).not.toBeInTheDocument()
  })
  it.each([
    new File(['executable'], 'documento.exe', { type: 'application/octet-stream' }),
    new File([''], 'vacio.pdf', { type: 'application/pdf' }),
    new File([new Uint8Array(8388609)], 'grande.pdf', { type: 'application/pdf' }),
  ])('rejects an invalid dropped file ($name) before uploading', async dropped => {
    mount()
    fireEvent.drop(await screen.findByRole('region', { name: 'Comprobante de domicilio' }), {
      dataTransfer: { types: ['Files'], files: [dropped] },
    })
    expect(await screen.findByText('Elige un PDF, JPG o PNG que no supere 8 MB.')).toBeVisible()
    expect(publicDocuments.upload).not.toHaveBeenCalled()
  })
  it('explains a multiple-file drop instead of silently losing files', async () => {
    mount()
    fireEvent.drop(await screen.findByRole('region', { name: 'Comprobante de domicilio' }), {
      dataTransfer: {
        types: ['Files'],
        files: [new File(['a'], 'frente.png', { type: 'image/png' }), new File(['b'], 'reverso.png', { type: 'image/png' })],
      },
    })
    expect(await screen.findByText('Agrega un archivo a la vez en el requisito correspondiente.')).toBeVisible()
    expect(publicDocuments.upload).not.toHaveBeenCalled()
  })
  it('enforces the requirement file limit for drops', async () => {
    vi.mocked(publicDocuments.get).mockResolvedValue({ ...request, documents: [file, { ...file, id: 'file2' }] })
    mount()
    fireEvent.drop(await screen.findByRole('region', { name: 'Comprobante de domicilio' }), {
      dataTransfer: { types: ['Files'], files: [new File(['pdf'], 'extra.pdf', { type: 'application/pdf' })] },
    })
    expect(await screen.findByText('Llegaste al máximo de archivos. Quita uno antes de agregar otro.')).toBeVisible()
    expect(publicDocuments.upload).not.toHaveBeenCalled()
  })
  it.each(['offline', 'uploading'] as const)('does not accept another drop while %s', async state => {
    vi.mocked(publicDocuments.upload).mockImplementation(() => new Promise(() => {}))
    mount()
    const region = await screen.findByRole('region', { name: 'Comprobante de domicilio' })
    if (state === 'offline') {
      act(() => {
        Object.defineProperty(navigator, 'onLine', { configurable: true, value: false })
        window.dispatchEvent(new Event('offline'))
      })
    } else {
      fireEvent.change(screen.getByLabelText('Agregar archivo: Comprobante de domicilio'), {
        target: { files: [new File(['pdf'], 'primero.pdf', { type: 'application/pdf' })] },
      })
      await screen.findByText('primero.pdf')
    }
    expect(
      fireEvent.drop(region, {
        dataTransfer: { types: ['Files'], files: [new File(['pdf'], 'otro.pdf', { type: 'application/pdf' })] },
      }),
    ).toBe(false)
    expect(screen.queryByText('otro.pdf')).not.toBeInTheDocument()
    expect(publicDocuments.upload).toHaveBeenCalledTimes(state === 'offline' ? 0 : 1)
  })
  it('prevents a dropped file outside the requirements from navigating away, while allowing text drops', async () => {
    mount()
    await screen.findByRole('region', { name: 'Comprobante de domicilio' })
    fireEvent.change(screen.getByLabelText('Tu nombre'), { target: { value: 'Ana' } })
    expect(fireEvent.drop(document.body, { dataTransfer: { types: ['Files'], files: [new File(['pdf'], 'doc.pdf')] } })).toBe(false)
    expect(screen.getByLabelText('Tu nombre')).toHaveValue('Ana')
    expect(publicDocuments.upload).not.toHaveBeenCalled()
    expect(fireEvent.drop(screen.getByLabelText('Tu nombre'), { dataTransfer: { types: ['text/plain'], files: [] } })).toBe(true)
  })
})
