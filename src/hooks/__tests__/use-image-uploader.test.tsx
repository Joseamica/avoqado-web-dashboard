import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const toast = vi.fn()
const getCroppedImg = vi.fn((..._a: any[]) => Promise.resolve('blob:recortada'))
const uploadBytesResumable = vi.fn()

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))
vi.mock('@/firebase', () => ({ storage: {} }))
vi.mock('@/utils/cropImage', () => ({ getCroppedImg: (...a: any[]) => getCroppedImg(...a) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('../use-toast', () => ({ useToast: () => ({ toast }) }))
vi.mock('firebase/storage', () => ({
  ref: vi.fn(() => ({ fullPath: 'venues/x/productos/p.jpg' })),
  getDownloadURL: vi.fn(async () => 'https://storage/p.jpg'),
  deleteObject: vi.fn(async () => undefined),
  uploadBytesResumable: (...a: any[]) => uploadBytesResumable(...a),
}))

import { useImageUploader } from '../use-image-uploader'

const montar = () => renderHook(() => useImageUploader('venues/x/productos', 'molletes', { minWidth: 320, minHeight: 320 }))

const conRecorteDe = async (hook: ReturnType<typeof montar>, width: number, height: number) => {
  await act(async () => {
    hook.result.current.setImageForCrop('data:image/jpeg;base64,xxx')
    hook.result.current.onCropComplete(null, { x: 0, y: 0, width, height })
  })
  await act(async () => {
    await hook.result.current.handleCropConfirm()
  })
}

describe('useImageUploader — el tope de tamano encoge, no rechaza', () => {
  beforeEach(() => {
    // La config de vitest usa `mockReset: true`, que borra la implementacion de cada vi.fn()
    // antes de cada test — por eso se vuelven a poner aqui y no al importar el modulo.
    toast.mockReset()
    getCroppedImg.mockReset()
    getCroppedImg.mockResolvedValue('blob:recortada')
    // La subida a Firebase no es lo que se prueba aqui: se corta al pedir el recorte.
    uploadBytesResumable.mockReset()
    uploadBytesResumable.mockImplementation(() => ({ on: () => {}, snapshot: { ref: {} } }))
    global.fetch = vi.fn(async () => ({ blob: async () => new Blob(['x']) })) as any
  })

  it('sube una foto de celular de 4032x3024 en vez de rechazarla', async () => {
    // Antes del fix: toast "El recorte excede el maximo permitido: 2000x2000" y return.
    const hook = montar()
    await conRecorteDe(hook, 4032, 3024)

    expect(toast).not.toHaveBeenCalled()
    expect(getCroppedImg).toHaveBeenCalledTimes(1)
  })

  it('le pasa el tope a getCroppedImg para que la salida se encoja', async () => {
    const hook = montar()
    await conRecorteDe(hook, 4032, 3024)

    expect(getCroppedImg).toHaveBeenCalledWith(
      'data:image/jpeg;base64,xxx',
      expect.objectContaining({ width: 4032, height: 3024 }),
      { maxWidth: 2000, maxHeight: 2000 },
    )
  })

  it('sigue rechazando un recorte por debajo del minimo: esos pixeles no existen', async () => {
    const hook = montar()
    await conRecorteDe(hook, 200, 200)

    expect(getCroppedImg).not.toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })

  it('avisa cuando el recorte truena, en vez de quedarse callado', async () => {
    getCroppedImg.mockRejectedValueOnce(new Error('canvas tainted'))
    const hook = montar()
    await conRecorteDe(hook, 4032, 3024)

    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    expect(hook.result.current.uploading).toBe(false)
  })
})
