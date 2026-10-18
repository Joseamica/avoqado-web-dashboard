import axios from 'axios'

export interface DocumentFile {
  id: string
  key: string
  fileName: string
  mimeType: string
  sizeBytes: number
}
export interface DocumentRequirement {
  key: string
  label: string
  description: string
  required: boolean
  maxFiles: number
}
export interface DocumentRequest {
  id: string
  provider: 'ANGELPAY' | 'BLUMON'
  entityType: 'PERSONA_FISICA' | 'PERSONA_MORAL'
  status: 'DRAFT' | 'OPEN' | 'SUBMITTED' | 'EXPIRED' | 'REVOKED'
  expiresAt: string
  requirements: DocumentRequirement[]
  documents: DocumentFile[]
  pendingUploads?: { uploadId: string; key: string; fileName: string }[]
  limits: { maxFileBytes: number; maxTotalBytes: number; maxFiles: number; maxUploadAttempts: number }
}
export interface DocumentContact {
  businessName: string
  contactName: string
  email: string
  phone: string
  identificationType: 'INE' | 'PASSPORT'
  privacyAccepted: boolean
}

// This client must never inherit session cookies, login redirects, or automatic POST retries.
const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL || window.location.origin,
  adapter: 'fetch',
  withCredentials: false,
  withXSRFToken: false,
  timeout: 60_000,
})
const base = (id: string) => `/api/v1/public/document-requests/${encodeURIComponent(id)}`
const auth = (token: string) => ({ headers: { 'X-Document-Token': token } })

export function getDocumentToken(id: string): string | null {
  const key = `document-token:${id}`
  const params = new URLSearchParams(window.location.hash.slice(1))
  if (params.has('token')) {
    const value = params.get('token') || ''
    window.history.replaceState(window.history.state, '', window.location.pathname + window.location.search)
    try {
      if (/^[a-f0-9]{64}$/.test(value)) sessionStorage.setItem(key, value)
      else sessionStorage.removeItem(key)
    } catch {
      /* The original WhatsApp link still works if session storage is unavailable. */
    }
    return /^[a-f0-9]{64}$/.test(value) ? value : null
  }
  try {
    const value = sessionStorage.getItem(key)
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null
  } catch {
    return null
  }
}

let counter = 0
const randomBlock = () => crypto.getRandomValues(new Uint32Array(1))[0].toString(36).padStart(7, '0').slice(-4)
const fingerprint = randomBlock()
export function createUploadId(): string {
  // cuid v1 layout: timestamp(8), counter(4), client fingerprint(4), random(8).
  return `c${Date.now().toString(36).padStart(8, '0')}${(counter++ % 1679616).toString(36).padStart(4, '0')}${fingerprint}${randomBlock()}${randomBlock()}`
}

export const publicDocuments = {
  async get(id: string, token: string): Promise<DocumentRequest> {
    return (await client.get<DocumentRequest>(base(id), auth(token))).data
  },
  async upload(
    id: string,
    token: string,
    key: string,
    file: File,
    uploadId: string,
    onProgress: (percent: number) => void,
  ): Promise<DocumentFile> {
    const body = new FormData()
    body.append('file', file)
    body.append('uploadId', uploadId)
    const crossOrigin = new URL(client.defaults.baseURL!, window.location.href).origin !== window.location.origin
    const response = await client.post<{ document: DocumentFile }>(`${base(id)}/documents/${encodeURIComponent(key)}`, body, {
      ...auth(token),
      // XHR omits credentials cross-origin and reports bytes without HTTP/2 request streams.
      adapter: crossOrigin ? 'xhr' : 'fetch',
      // shortcut: same-origin uploads show indeterminate progress to keep session cookies omitted.
      onUploadProgress: crossOrigin ? event => onProgress(event.total ? Math.round((event.loaded * 100) / event.total) : 0) : undefined,
    })
    return response.data.document
  },
  async remove(id: string, token: string, documentId: string): Promise<void> {
    await client.delete(`${base(id)}/documents/${encodeURIComponent(documentId)}`, auth(token))
  },
  async discardUpload(id: string, token: string, uploadId: string): Promise<void> {
    await client.delete(`${base(id)}/uploads/${encodeURIComponent(uploadId)}`, auth(token))
  },
  async submit(id: string, token: string, contact: DocumentContact): Promise<{ id: string; status: 'SUBMITTED' }> {
    return (await client.post<{ id: string; status: 'SUBMITTED' }>(`${base(id)}/submit`, contact, auth(token))).data
  },
}
