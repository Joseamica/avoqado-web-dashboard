import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { DEFAULT_TPV_SETTINGS, type TpvSettings, type TpvSettingsUpdate } from '@/services/tpv-settings.service'
import { TpvSettingsFields } from '../TpvSettingsFields'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) => (o && typeof o === 'object' ? `${k} ${JSON.stringify(o)}` : k),
    i18n: { language: 'es' },
  }),
}))

// Un «panel» de mentiras con memoria: lo que manda onUpdate es lo que la pantalla vuelve a recibir (como el guardado optimista).
const onUpdate = vi.fn<(u: TpvSettingsUpdate) => void>()
function Panel({ tips, defaultTip = null, disabled = false }: { tips: number[]; defaultTip?: number | null; disabled?: boolean }) {
  const [settings, setSettings] = useState<TpvSettings>({ ...DEFAULT_TPV_SETTINGS, tipSuggestions: tips, defaultTipPercentage: defaultTip })
  return (
    <TpvSettingsFields
      mode="terminal"
      disabled={disabled}
      settings={settings}
      onUpdate={u => {
        onUpdate(u)
        setSettings(prev => ({ ...prev, ...u }) as TpvSettings)
      }}
    />
  )
}
const botonAgregar = () => screen.getByRole('button', { name: /tpvSettings\.addTipOption/ })
const quitar = (n: number) => screen.getByRole('button', { name: new RegExp(`tpvSettings\\.removeTipOption \\{"value":${n}\\}`) })
const botonesQuitar = () => screen.queryAllByRole('button', { name: /tpvSettings\.removeTipOption/ })

describe('TpvSettingsFields · editor de porcentajes de propina (tope de 6, como el servidor y el POS)', () => {
  it('con 5 todavía se agrega, y manda la lista ordenada', async () => {
    onUpdate.mockClear()
    const user = userEvent.setup()
    render(<Panel tips={[10, 15, 20, 25, 30]} />)
    expect(screen.queryByText(/tpvSettings\.tipMaxReached/)).not.toBeInTheDocument()
    await user.type(screen.getByPlaceholderText('tpvSettings.tipPlaceholder'), '12')
    await user.click(botonAgregar())
    expect(onUpdate).toHaveBeenCalledWith({ tipSuggestions: [10, 12, 15, 20, 25, 30] })
  })

  it('🔴 con 6 NO se puede agregar: botón apagado, aviso visible y Enter tampoco manda nada', async () => {
    onUpdate.mockClear()
    const user = userEvent.setup()
    render(<Panel tips={[5, 10, 15, 20, 25, 30]} />)
    const campo = screen.getByPlaceholderText('tpvSettings.tipPlaceholder')
    await user.type(campo, '12')
    expect(campo).toBeDisabled()
    expect(botonAgregar()).toBeDisabled()
    expect(screen.getByText(/tpvSettings\.tipMaxReached/)).toBeInTheDocument()
    expect(screen.queryByText(/tpvSettings\.tipOverMax/)).not.toBeInTheDocument()
    await user.type(campo, '{Enter}')
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('con 6 quitar uno sí se puede, y entonces vuelve a dejar agregar', async () => {
    onUpdate.mockClear()
    const user = userEvent.setup()
    render(<Panel tips={[5, 10, 15, 20, 25, 30]} />)
    await user.click(quitar(5))
    expect(onUpdate).toHaveBeenCalledWith({ tipSuggestions: [10, 15, 20, 25, 30] })
    await user.type(screen.getByPlaceholderText('tpvSettings.tipPlaceholder'), '7')
    expect(botonAgregar()).toBeEnabled()
  })

  it('🔴 con 7 guardados (heredado): aviso de cuántos quitar, y no se puede agregar', () => {
    render(<Panel tips={[5, 10, 15, 20, 25, 30, 35]} />)
    expect(screen.getByText('tpvSettings.tipOverMax {"total":7,"max":6,"remove":1}')).toBeInTheDocument()
    expect(botonAgregar()).toBeDisabled()
  })

  it('🔴 con 8 guardados: quitar uno NO se manda (el servidor lo rechazaría con 400 y se revertiría); al llegar a 6 se manda UNA vez', async () => {
    onUpdate.mockClear()
    const user = userEvent.setup()
    render(<Panel tips={[5, 10, 15, 20, 25, 30, 35, 40]} />)
    expect(screen.getByText(/"total":8,"max":6,"remove":2/)).toBeInTheDocument()

    await user.click(quitar(5))
    expect(onUpdate).not.toHaveBeenCalled() // sigue en 7: sólo se anota en pantalla
    expect(screen.queryByRole('button', { name: new RegExp('removeTipOption \\{"value":5\\}') })).not.toBeInTheDocument()
    expect(screen.getByText(/"total":7,"max":6,"remove":1/)).toBeInTheDocument()

    await user.click(quitar(10))
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith({ tipSuggestions: [15, 20, 25, 30, 35, 40] }) // la lista FINAL, con las dos quitas
    expect(screen.queryByText(/tpvSettings\.tipOverMax/)).not.toBeInTheDocument()
    expect(screen.getByText(/tpvSettings\.tipMaxReached/)).toBeInTheDocument() // quedaron 6: ya no se agrega
  })

  it('si la propina pre-seleccionada se quita (aunque sea en un paso anotado), al mandar se limpia', async () => {
    onUpdate.mockClear()
    const user = userEvent.setup()
    render(<Panel tips={[5, 10, 15, 20, 25, 30, 35]} defaultTip={5} />)
    await user.click(quitar(5))
    expect(onUpdate).toHaveBeenCalledWith({ tipSuggestions: [10, 15, 20, 25, 30, 35], defaultTipPercentage: null })
  })

  it('🔴 la última NO se puede quitar: con una sola no hay botón de quitar, y con dos sí', () => {
    const { unmount } = render(<Panel tips={[10]} />)
    expect(botonesQuitar()).toHaveLength(0)
    unmount()
    render(<Panel tips={[10, 15]} />)
    expect(botonesQuitar()).toHaveLength(2)
  })

  it('sin permiso (disabled) no hay editor que mover ni aviso de «quita»', () => {
    render(<Panel tips={[5, 10, 15, 20, 25, 30, 35]} disabled />)
    expect(botonesQuitar()).toHaveLength(0)
    expect(screen.queryByText(/tpvSettings\.tipOverMax/)).not.toBeInTheDocument()
  })
})
