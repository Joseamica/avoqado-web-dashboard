import { describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, fireEvent } from '@testing-library/react'
import { AxiosError, AxiosHeaders } from 'axios'
import {
  confirmationsFrom,
  firstConfirmations,
  isPositionConfirmCancel,
  seenFromConfig,
  serverMessage,
  type PositionDetail,
} from '../positionLock'
import { usePositionConfirm } from '../PositionConfirmDialog'

const posicion = (over: Partial<PositionDetail> = {}): PositionDetail => ({
  slot: 'PRIMARY',
  label: 'Principal',
  accountChanges: true,
  currentAccount: { id: 'acc-a', name: 'Blumon A', providerCode: 'BLUMON' },
  nextAccount: { id: 'acc-b', name: 'AngelPay B', providerCode: 'ANGELPAY' },
  pricing: {
    id: 'pr-1',
    source: 'venue',
    effectiveFrom: '2026-01-01T06:00:00.000Z',
    debitRate: 0.025,
    creditRate: 0.03,
    amexRate: 0.035,
    internationalRate: 0.04,
    includesTax: true,
    taxRate: 0.16,
    fixedFeePerTransaction: null,
    monthlyServiceFee: null,
  },
  pricingFingerprint: 'huella-1',
  inheritingTerminals: { total: 2, byBrand: { PAX: 2 }, losingAccount: 2 },
  needs: { previousAccountId: true, nextAccountId: false, rate: true, inheritingTerminals: true },
  problems: ['FALTA_TARIFA', 'FALTA_TERMINALES'],
  ...over,
})

const errorDelCandado = (positions: PositionDetail[]) =>
  new AxiosError('400', 'ERR_BAD_REQUEST', undefined, undefined, {
    status: 400,
    statusText: 'Bad Request',
    headers: {},
    config: { headers: new AxiosHeaders() },
    data: { code: 'CONFIRMAR_POSICION', details: { positions } },
  })

describe('candado de posiciones: confirmaciones', () => {
  it('el primer envío lleva sólo la cuenta que vio la pantalla', () => {
    expect(firstConfirmations({ PRIMARY: 'acc-a', SECONDARY: null })).toEqual({
      PRIMARY: { previousAccountId: 'acc-a' },
      SECONDARY: { previousAccountId: null },
    })
    expect(firstConfirmations()).toBeUndefined()
  })

  it('el reenvío conserva la cuenta que vio la pantalla y agrega huella y terminales del detalle', () => {
    const first = firstConfirmations({ PRIMARY: 'acc-vista' })
    expect(confirmationsFrom([posicion()], first)).toEqual({
      PRIMARY: { previousAccountId: 'acc-vista', rate: { mode: 'KEEP', fingerprint: 'huella-1' }, inheritingTerminals: 2 },
    })
  })

  it('si la pantalla no conocía la cuenta (heredada), usa la que mostró el diálogo; y la cuenta nueva cuando la calcula el SERVIDOR', () => {
    const p = posicion({ needs: { previousAccountId: true, nextAccountId: true, rate: false, inheritingTerminals: false } })
    expect(confirmationsFrom([p])).toEqual({ PRIMARY: { previousAccountId: 'acc-a', nextAccountId: 'acc-b' } })
  })
})

describe('candado de posiciones: ayudas de las pantallas', () => {
  it('las cuentas a la vista salen de la config leída; sin leer no se afirma ninguna; leída y sin config, las tres vacías', () => {
    expect(seenFromConfig({ primaryAccountId: 'a', secondaryAccountId: null })).toEqual({ PRIMARY: 'a', SECONDARY: null, TERTIARY: null })
    expect(seenFromConfig(undefined)).toBeUndefined()
    expect(seenFromConfig(null)).toEqual({ PRIMARY: null, SECONDARY: null, TERTIARY: null })
  })

  it('el mensaje es el del SERVIDOR (message o error); sin él, el de respaldo; un error propio, el suyo', () => {
    const conDatos = (data: unknown) =>
      new AxiosError('x', 'ERR', undefined, undefined, {
        status: 409,
        statusText: '',
        headers: {},
        config: { headers: new AxiosHeaders() },
        data,
      })
    expect(serverMessage(conDatos({ message: 'Recarga y vuelve a intentarlo.' }), 'respaldo')).toBe('Recarga y vuelve a intentarlo.')
    expect(serverMessage(conDatos({ error: 'Venue not found' }), 'respaldo')).toBe('Venue not found')
    expect(serverMessage(conDatos(undefined), 'respaldo')).toBe('respaldo')
    expect(serverMessage(new Error('Missing data'), 'respaldo')).toBe('Missing data')
  })
})

describe('usePositionConfirm', () => {
  function Prueba({ onRun }: { onRun: (run: ReturnType<typeof usePositionConfirm>['run']) => void }) {
    const { run, dialog } = usePositionConfirm()
    onRun(run)
    return <>{dialog}</>
  }

  it('sin confirmar no reenvía; al confirmar tarifa y terminales reenvía la MISMA petición con lo confirmado', async () => {
    const send = vi
      .fn()
      .mockRejectedValueOnce(errorDelCandado([posicion()]))
      .mockResolvedValueOnce('guardado')
    let run!: ReturnType<typeof usePositionConfirm>['run']
    render(<Prueba onRun={r => (run = r)} />)
    let resultado: Promise<string>
    await act(async () => {
      resultado = run(send, { PRIMARY: 'acc-a' })
    })
    expect(await screen.findByText(/Confirma el cambio de cuenta/)).toBeInTheDocument()
    expect(screen.getByText(/2 terminal\(es\) \(2 PAX\)/)).toBeInTheDocument()
    const ok = screen.getByTestId('position-confirm-ok')
    expect(ok).toBeDisabled()
    fireEvent.click(screen.getByLabelText('La tarifa es la correcta'))
    fireEvent.click(screen.getByLabelText('Entiendo lo de las terminales'))
    expect(ok).not.toBeDisabled()
    await act(async () => {
      fireEvent.click(ok)
    })
    await expect(resultado!).resolves.toBe('guardado')
    expect(send).toHaveBeenNthCalledWith(1, { PRIMARY: { previousAccountId: 'acc-a' } })
    expect(send).toHaveBeenNthCalledWith(2, {
      PRIMARY: { previousAccountId: 'acc-a', rate: { mode: 'KEEP', fingerprint: 'huella-1' }, inheritingTerminals: 2 },
    })
  })

  it('cancelar no reenvía y avisa con un error que no se muestra como falla', async () => {
    const send = vi.fn().mockRejectedValueOnce(errorDelCandado([posicion()]))
    let run!: ReturnType<typeof usePositionConfirm>['run']
    render(<Prueba onRun={r => (run = r)} />)
    let resultado: Promise<unknown>
    await act(async () => {
      resultado = run(send, { PRIMARY: 'acc-a' }).catch(e => e)
    })
    await act(async () => {
      fireEvent.click(await screen.findByText('Cancelar'))
    })
    expect(isPositionConfirmCancel(await resultado!)).toBe(true)
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('cualquier otro error pasa tal cual (sin diálogo)', async () => {
    const otro = new Error('red caída')
    const { result } = renderHook(() => usePositionConfirm())
    await expect(result.current.run(() => Promise.reject(otro))).rejects.toBe(otro)
  })
})
