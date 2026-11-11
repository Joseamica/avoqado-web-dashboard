/**
 * Panel de versiones con dos carriles: la terminal (TPV) y la app de campo del promotor. Cada carril tiene su lista y sus
 * tarjetas de «Última versión», y el alta dice de qué carril es. Los códigos de versión se repiten entre carriles a propósito:
 * si una clave de caché no lleva la plataforma, la tarjeta se queda con la versión del otro carril.
 *
 * La pantalla, el servicio y TanStack son de verdad: sólo se finge la red (`@/api`), que filtra como el SERVIDOR (sin
 * `platform`, la TPV).
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Params = Record<string, unknown>

const red = vi.hoisted(() => ({
  gets: [] as Array<[string, Params]>,
  posts: [] as Array<[string, Record<string, unknown>]>,
  preview: null as unknown,
}))

vi.mock('@/api', () => {
  const get = async (url: string, config?: { params?: Params }) => {
    const params = config?.params ?? {}
    red.gets.push([url, params])
    const plataforma = (params.platform as string | undefined) ?? 'ANDROID_TPV'
    const delCarril = FILAS.filter(f => f.platform === plataforma)
    const ultima = url.match(/app-updates\/latest\/(\w+)$/)
    if (ultima) {
      const delAmbiente = delCarril.filter(f => f.environment === ultima[1]).sort((a, b) => b.versionCode - a.versionCode)
      return { data: { data: delAmbiente[0] ?? null } }
    }
    if (/superadmin\/app-updates$/.test(url)) {
      return { data: { data: delCarril.filter(f => !params.environment || f.environment === params.environment) } }
    }
    return { data: { data: [] } }
  }
  const post = async (url: string, body: Record<string, unknown>) => {
    red.posts.push([url, body])
    if (/preview$/.test(url)) return { data: { data: red.preview } }
    return { data: { data: FILAS[0], autoDetected: { versionCode: true, versionName: true, minAndroidSdk: true }, warnings: [] } }
  }
  const cliente = {
    get,
    post,
    put: post,
    patch: post,
    delete: post,
    defaults: { baseURL: 'https://api.prueba' },
    interceptors: { request: { use() {} }, response: { use() {} } },
  }
  return {
    default: cliente,
    publicApi: cliente,
    getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }),
    subscribeToConnection: () => () => {},
  }
})

vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es', changeLanguage: () => {} } }),
}))

import TpvUpdates from '@/pages/Superadmin/TpvUpdates'

function fila(platform: string, environment: string, versionCode: number, versionName: string) {
  return {
    id: `${platform}-${environment}-${versionCode}`,
    platform,
    versionName,
    versionCode,
    environment,
    releaseNotes: null,
    updateMode: 'NONE',
    downloadUrl: 'https://storage.prueba/apk',
    fileSize: '1024',
    checksum: 'abc',
    minAndroidSdk: 27,
    isActive: true,
    targetType: 'ALL',
    targetVenueIds: [],
    targetTerminalIds: [],
    uploadedById: 'u1',
    uploadedBy: { firstName: 'Ana', lastName: 'Admin', email: 'ana@avoqado.io' },
    createdAt: '2026-11-10T12:00:00.000Z',
    updatedAt: '2026-11-10T12:00:00.000Z',
  }
}

// Mismo código (3 y 4) en los dos carriles.
const FILAS = [
  fila('ANDROID_TPV', 'PRODUCTION', 3, '2.9.0'),
  fila('ANDROID_TPV', 'SANDBOX', 4, '2.9.1-sandbox'),
  fila('ANDROID_CAMPO', 'PRODUCTION', 3, '0.3.0'),
  fila('ANDROID_CAMPO', 'SANDBOX', 4, '0.3.1-sandbox'),
]

function pintar() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <TpvUpdates />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

/** La versión grande de una tarjeta de «Última versión» (la fila de la tabla trae además su «(código)»). */
const enTarjeta = (version: string) => screen.queryAllByText((_, el) => el?.tagName === 'P' && el.textContent === version).length > 0

const textoDeLaTabla = () =>
  screen
    .getAllByRole('row')
    .map(r => r.textContent ?? '')
    .join(' | ')

beforeEach(() => {
  red.gets = []
  red.posts = []
  red.preview = null
})

describe('TpvUpdates · plataforma', () => {
  it('cambiar de «Terminal» a «App de campo» cambia la lista Y las tarjetas de «Última versión»', async () => {
    pintar()
    await waitFor(() => expect(enTarjeta('v2.9.0')).toBe(true))
    expect(enTarjeta('v2.9.1-sandbox')).toBe(true)
    await waitFor(() => expect(textoDeLaTabla()).toContain('v2.9.0 (3)'))

    fireEvent.click(screen.getByRole('radio', { name: 'App de campo' }))

    await waitFor(() => expect(enTarjeta('v0.3.0')).toBe(true))
    await waitFor(() => expect(enTarjeta('v0.3.1-sandbox')).toBe(true))
    expect(enTarjeta('v2.9.0')).toBe(false)
    expect(enTarjeta('v2.9.1-sandbox')).toBe(false)
    await waitFor(() => expect(textoDeLaTabla()).toContain('v0.3.0 (3)'))
    expect(textoDeLaTabla()).not.toContain('2.9.0')

    expect(red.gets).toContainEqual(['/api/v1/superadmin/app-updates/latest/PRODUCTION', { platform: 'ANDROID_CAMPO' }])
    expect(red.gets).toContainEqual(['/api/v1/superadmin/app-updates/latest/SANDBOX', { platform: 'ANDROID_CAMPO' }])
    expect(red.gets).toContainEqual(['/api/v1/superadmin/app-updates', { environment: 'PRODUCTION', platform: 'ANDROID_CAMPO' }])
  })

  it('subir un APK de campo manda platform ANDROID_CAMPO sin versión a mano, y la lista que queda es la de campo', async () => {
    red.preview = {
      versionCode: 5,
      versionName: '0.5.0',
      packageName: 'com.jaac.avoqado_tpv.campo',
      minSdkVersion: 27,
      detectedEnvironment: 'PRODUCTION',
      detectedPlatform: 'ANDROID_CAMPO',
    }
    pintar()
    await waitFor(() => expect(enTarjeta('v2.9.0')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /Subir APK/ }))
    const dialogo = await screen.findByRole('dialog')
    const archivo = dialogo.querySelector('input[type="file"]') as HTMLInputElement
    fireEvent.change(archivo, { target: { files: [new File(['apk'], 'campo.apk')] } })

    // El APK dice de qué carril es: el selector se pone solo y la versión ya no se ofrece a mano.
    await waitFor(() => expect(within(dialogo).getByRole('radio', { name: 'App de campo' })).toHaveAttribute('aria-checked', 'true'))
    expect(within(dialogo).getByLabelText(/Version Code/)).toBeDisabled()
    expect(within(dialogo).getByLabelText(/Version Name/)).toBeDisabled()
    expect(within(dialogo).getByLabelText(/Version Code/)).toHaveValue(5)
    // El celular no reporta sucursal: «Aplica a» no se ofrece para la app de campo.
    expect(within(dialogo).queryByText('Aplica a')).toBeNull()

    fireEvent.click(within(dialogo).getByRole('button', { name: /Subir APK/ }))

    await waitFor(() => expect(red.posts.some(([url]) => url === '/api/v1/superadmin/app-updates')).toBe(true))
    const [, cuerpo] = red.posts.find(([url]) => url === '/api/v1/superadmin/app-updates')!
    expect(cuerpo).toMatchObject({ platform: 'ANDROID_CAMPO', environment: 'PRODUCTION', targetType: 'ALL', targetVenueIds: [] })
    expect(cuerpo).not.toHaveProperty('versionCode')
    expect(cuerpo).not.toHaveProperty('versionName')

    await waitFor(() => expect(textoDeLaTabla()).toContain('v0.3.0 (3)'))
    expect(textoDeLaTabla()).not.toContain('2.9.0')
  })

  it('subir un APK de la TPV sigue como hoy: platform ANDROID_TPV y la versión detectada', async () => {
    red.preview = {
      versionCode: 130,
      versionName: '2.16.1',
      packageName: 'com.jaac.avoqado_tpv',
      minSdkVersion: 27,
      detectedEnvironment: 'PRODUCTION',
      detectedPlatform: 'ANDROID_TPV',
    }
    pintar()
    await waitFor(() => expect(enTarjeta('v2.9.0')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: /Subir APK/ }))
    const dialogo = await screen.findByRole('dialog')
    fireEvent.change(dialogo.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['apk'], 'tpv.apk')] },
    })
    await waitFor(() => expect(within(dialogo).getByLabelText(/Version Code/)).toHaveValue(130))
    expect(within(dialogo).getByLabelText(/Version Code/)).toBeEnabled()

    fireEvent.click(within(dialogo).getByRole('button', { name: /Subir APK/ }))

    await waitFor(() => expect(red.posts.some(([url]) => url === '/api/v1/superadmin/app-updates')).toBe(true))
    const [, cuerpo] = red.posts.find(([url]) => url === '/api/v1/superadmin/app-updates')!
    expect(cuerpo).toMatchObject({ platform: 'ANDROID_TPV', environment: 'PRODUCTION', versionCode: 130, versionName: '2.16.1' })
  })
})
