import { afterEach, describe, expect, it } from 'vitest'

import { createChime } from './chime'

// Clases, no vi.fn(): `mockReset:true` borra las implementaciones de los stubs (memoria del repo).
const created: string[] = []
class FakeParam {
  value = 0
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
}
class FakeNode {
  frequency = new FakeParam()
  gain = new FakeParam()
  type = 'sine'
  connect(next: unknown) {
    return next
  }
  start() {
    created.push('start')
  }
  stop() {}
}
class FakeAudioContext {
  static resumeWorks = true
  state: AudioContextState = 'suspended'
  currentTime = 0
  destination = {}
  async resume() {
    if (FakeAudioContext.resumeWorks) this.state = 'running'
  }
  createOscillator() {
    return new FakeNode()
  }
  createGain() {
    return new FakeNode()
  }
}

const w = window as unknown as { AudioContext?: unknown }

afterEach(() => {
  delete w.AudioContext
  created.length = 0
  FakeAudioContext.resumeWorks = true
})

describe('createChime', () => {
  it('sin WebAudio: unsupported y unlock() devuelve false', async () => {
    delete w.AudioContext
    const chime = createChime()
    expect(chime.state()).toBe('unsupported')
    await expect(chime.unlock()).resolves.toBe(false)
    expect(() => chime.play()).not.toThrow()
  })

  it('antes del clic no suena (suspended) y no crea el contexto', () => {
    w.AudioContext = FakeAudioContext
    const chime = createChime()
    expect(chime.state()).toBe('suspended')
    chime.play()
    expect(created).toHaveLength(0)
  })

  it('unlock() lo pone a correr y play() suena dos tonos', async () => {
    w.AudioContext = FakeAudioContext
    const chime = createChime()
    await expect(chime.unlock()).resolves.toBe(true)
    expect(chime.state()).toBe('running')
    chime.play()
    expect(created).toHaveLength(2)
  })

  it('si el navegador no lo deja arrancar, unlock() devuelve false y sigue sin sonar', async () => {
    w.AudioContext = FakeAudioContext
    FakeAudioContext.resumeWorks = false
    const chime = createChime()
    await expect(chime.unlock()).resolves.toBe(false)
    chime.play()
    expect(created).toHaveLength(0)
  })
})
