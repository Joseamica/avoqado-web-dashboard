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
import { deleteObject, getDownloadURL, ref } from 'firebase/storage'

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

    expect(getCroppedImg).toHaveBeenCalledWith('data:image/jpeg;base64,xxx', expect.objectContaining({ width: 4032, height: 3024 }), {
      maxWidth: 2000,
      maxHeight: 2000,
    })
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

const diferida = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((si, no) => {
    resolve = si
    reject = no
  })
  return { promise, resolve, reject }
}

describe('useImageUploader — reset local entre aperturas', () => {
  const subidas: Array<{ error: (error: Error) => void; complete: () => Promise<void> }> = []
  beforeEach(() => {
    subidas.length = 0
    getCroppedImg.mockResolvedValue('blob:recortada')
    vi.mocked(ref).mockReturnValue({ fullPath: 'venues/x/productos/p.jpg' } as any)
    vi.mocked(getDownloadURL).mockResolvedValue('https://storage/p.jpg')
    vi.mocked(deleteObject).mockResolvedValue(undefined)
    uploadBytesResumable.mockImplementation(() => ({
      snapshot: { ref: {} },
      on: (_event: string, _progress: unknown, error: (error: Error) => void, complete: () => Promise<void>) => {
        subidas.push({ error, complete })
      },
    }))
    global.fetch = vi.fn(async () => ({ blob: async () => new Blob(['x']) })) as any
  })

  it('reinicia foto, recorte, zoom y subida sin borrar un archivo guardado ni el anterior', async () => {
    const hook = montar()
    act(() => hook.result.current.initializeWithExistingUrl('https://storage/anterior.jpg'))
    await conRecorteDe(hook, 400, 400)
    await act(async () => {
      await subidas[0].complete()
    })
    act(() => {
      hook.result.current.setZoom(2)
      hook.result.current.setCrop({ x: 20, y: 30 })
      hook.result.current.resetImage()
    })
    expect(hook.result.current).toMatchObject({
      imageUrl: null,
      imageForCrop: null,
      uploading: false,
      croppedAreaPixels: null,
      crop: { x: 0, y: 0 },
      zoom: 1,
    })
    await act(async () => {
      await hook.result.current.handleFileRemove()
    })
    expect(deleteObject).not.toHaveBeenCalled()
  })

  it('un FileReader de A que termina después del reset no reemplaza el recorte de B', async () => {
    const lectores: Array<{ result: string; onload: () => void }> = []
    vi.spyOn(globalThis, 'FileReader').mockImplementation(function () {
      const lector = { result: 'data:foto-A', onload: () => {}, readAsDataURL: () => {} }
      lectores.push(lector)
      return lector as any
    })
    const hook = montar()
    act(() => hook.result.current.handleFileUpload(new File(['a'], 'a.jpg')))
    act(() => hook.result.current.resetImage())
    act(() => hook.result.current.setImageForCrop('data:foto-B'))
    act(() => lectores[0].onload())
    expect(hook.result.current.imageForCrop).toBe('data:foto-B')
  })

  it.each(['recorte', 'blob'] as const)('si el %s de A termina tarde, no inicia una subida ni borra el recorte de B', async fase => {
    const pendiente = diferida<any>()
    if (fase === 'recorte') getCroppedImg.mockReturnValueOnce(pendiente.promise)
    else global.fetch = vi.fn(async () => ({ blob: () => pendiente.promise })) as any
    const hook = montar()
    act(() => {
      hook.result.current.setImageForCrop('data:foto-A')
      hook.result.current.onCropComplete(null, { x: 0, y: 0, width: 400, height: 400 })
    })
    let confirmacion!: Promise<void>
    await act(async () => {
      confirmacion = hook.result.current.handleCropConfirm()
      await Promise.resolve()
    })
    act(() => hook.result.current.resetImage())
    act(() => hook.result.current.setImageForCrop('data:foto-B'))
    await act(async () => {
      pendiente.resolve(fase === 'recorte' ? 'blob:foto-A' : new Blob(['a']))
      await confirmacion
    })
    expect(uploadBytesResumable).not.toHaveBeenCalled()
    expect(hook.result.current.imageForCrop).toBe('data:foto-B')
  })

  it.each(['subida', 'url', 'url-error', 'error'] as const)('una respuesta tardía de %s de A deja intacta la subida y el recorte de B', async fase => {
    const hook = montar()
    await conRecorteDe(hook, 400, 400)
    const pendiente = diferida<string>()
    let descarga: Promise<void> | undefined
    if (fase === 'url' || fase === 'url-error') {
      vi.mocked(getDownloadURL).mockReturnValueOnce(pendiente.promise)
      await act(async () => {
        descarga = subidas[0].complete()
      })
    }
    act(() => hook.result.current.resetImage())
    await conRecorteDe(hook, 500, 500)
    expect(hook.result.current.uploading).toBe(true)
    const recorteB = hook.result.current.imageForCrop
    await act(async () => {
      if (fase === 'url' || fase === 'url-error') {
        if (fase === 'url-error') pendiente.reject(new Error('URL de A falló'))
        else pendiente.resolve('https://storage/a.jpg')
        await descarga
      } else if (fase === 'error') subidas[0].error(new Error('falló A'))
      else await subidas[0].complete()
    })
    expect(hook.result.current.imageUrl).toBeNull()
    expect(hook.result.current.imageForCrop).toBe(recorteB)
    expect(hook.result.current.uploading).toBe(true)
    expect(toast).not.toHaveBeenCalled()
    await act(async () => {
      await subidas[1].complete()
    })
    expect(hook.result.current.imageUrl).toBe('https://storage/p.jpg')
    expect(hook.result.current.uploading).toBe(false)
  })

  it('un callback de recorte de A que llega tarde no reemplaza las coordenadas de B', () => {
    const hook = montar()
    const recorteA = hook.result.current.onCropComplete
    act(() => hook.result.current.resetImage())
    act(() => hook.result.current.onCropComplete(null, { x: 1, y: 2, width: 500, height: 500 }))
    act(() => recorteA(null, { x: 0, y: 0, width: 300, height: 300 }))
    expect(hook.result.current.croppedAreaPixels).toEqual({ x: 1, y: 2, width: 500, height: 500 })
  })

  it('un error de URL de la apertura actual avisa y libera la subida para reintentar', async () => {
    const hook = montar()
    const error = new Error('URL no disponible')
    const logger = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.mocked(getDownloadURL).mockRejectedValueOnce(error)
    await conRecorteDe(hook, 400, 400)
    await act(async () => { await subidas[0].complete() })
    expect(hook.result.current.uploading).toBe(false)
    expect(hook.result.current.imageUrl).toBeNull()
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    expect(logger).toHaveBeenCalledExactlyOnceWith('Error uploading file:', error)
  })

  it('un borrado pendiente de A termina sin limpiar la foto confirmada de B tras el reset', async () => {
    const hook = montar()
    await conRecorteDe(hook, 400, 400)
    await act(async () => { await subidas[0].complete() })
    const pendiente = diferida<void>()
    vi.mocked(deleteObject).mockReturnValueOnce(pendiente.promise)
    let borrado!: Promise<void>
    act(() => { borrado = hook.result.current.handleFileRemove() })
    expect(deleteObject).toHaveBeenCalledTimes(1)
    act(() => hook.result.current.resetImage())
    vi.mocked(getDownloadURL).mockResolvedValueOnce('https://storage/foto-B.jpg')
    await conRecorteDe(hook, 500, 500)
    await act(async () => { await subidas[1].complete() })
    expect(hook.result.current.imageUrl).toBe('https://storage/foto-B.jpg')
    await act(async () => { pendiente.resolve(); await borrado })
    expect(hook.result.current.imageUrl).toBe('https://storage/foto-B.jpg')
    expect(hook.result.current.uploading).toBe(false)
    expect(deleteObject).toHaveBeenCalledTimes(1)
  })

  it('sin reset, conserva la eliminación explícita del archivo', async () => {
    const hook = montar()
    await conRecorteDe(hook, 400, 400)
    await act(async () => {
      await subidas[0].complete()
    })
    await act(async () => {
      await hook.result.current.handleFileRemove()
    })
    expect(deleteObject).toHaveBeenCalledTimes(1)
    expect(hook.result.current.imageUrl).toBeNull()
  })
})
