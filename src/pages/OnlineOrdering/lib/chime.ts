/**
 * Timbre de la bandeja con WebAudio (dos tonos cortos, sin archivo de audio). El navegador no deja sonar nada antes de un clic:
 * `unlock()` se llama DESDE un clic y arranca el contexto; mientras no corra, `play()` no hace nada y la UI pide el toque.
 * El contexto se crea en ese primer clic (crearlo antes sólo deja un aviso en la consola).
 */
type Ctor = typeof AudioContext

export function createChime() {
  let ctx: AudioContext | null = null
  const ctor = (): Ctor | undefined => {
    if (typeof window === 'undefined') return undefined
    const w = window as unknown as { AudioContext?: Ctor; webkitAudioContext?: Ctor }
    return w.AudioContext ?? w.webkitAudioContext
  }

  return {
    async unlock(): Promise<boolean> {
      const C = ctor()
      if (!C) return false
      try {
        ctx ??= new C()
        if (ctx.state !== 'running') await ctx.resume()
      } catch {
        return false
      }
      return ctx.state === 'running'
    },

    play(): void {
      if (!ctx || ctx.state !== 'running') return
      const t0 = ctx.currentTime
      ;[880, 1320].forEach((freq, i) => {
        const osc = ctx!.createOscillator()
        const gain = ctx!.createGain()
        const start = t0 + i * 0.18
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, start)
        gain.gain.exponentialRampToValueAtTime(0.3, start + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.15)
        osc.connect(gain).connect(ctx!.destination)
        osc.start(start)
        osc.stop(start + 0.16)
      })
    },

    state(): AudioContextState | 'unsupported' {
      if (!ctor()) return 'unsupported'
      return ctx ? ctx.state : 'suspended'
    },
  }
}

export type Chime = ReturnType<typeof createChime>
