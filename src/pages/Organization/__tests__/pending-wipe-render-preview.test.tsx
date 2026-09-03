/**
 * No es una prueba: es un generador de VISTA PREVIA.
 *
 * Renderiza los TRES estados del bloque «borrado pendiente» del asistente de
 * migración con los textos REALES de `locales/es/organization.json`, para poder
 * MIRARLOS sin iniciar sesión ni backend. Una llave sin traducir sale cruda y se
 * nota — que es justo la clase de defecto que sólo aparece mirando.
 *
 * APAGADO por defecto. Se enciende así:
 *
 *   VISTA_PREVIA=1 npx vitest run src/pages/Organization/__tests__/pending-wipe-render-preview.test.tsx
 */
import { render } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import es from '@/locales/es/organization.json'
import PendingWipePanel from '@/pages/Organization/components/PendingWipePanel'
import type { OrgPendingWipe } from '@/services/organizationDashboard.service'

// `t` REAL contra el español: una llave que faltara saldría cruda en la vista previa.
function traducir(llave: string, opts?: Record<string, unknown>): string {
  const valor = llave.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), es as any)
  if (typeof valor !== 'string') return (opts?.defaultValue as string) ?? llave
  return valor.replace(/\{\{(\w+)\}\}/g, (_m, v) => String(opts?.[v] ?? `{{${v}}}`))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDateTime: (d: string) => {
      const f = new Date(d)
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      return `${f.getUTCDate()} ${meses[f.getUTCMonth()]} ${f.getUTCFullYear()}, ${String(f.getUTCHours()).padStart(2, '0')}:${String(f.getUTCMinutes()).padStart(2, '0')}`
    },
  }),
}))

const HOUR = 60 * 60 * 1000
const base: OrgPendingWipe = {
  commandId: 'cmnrv_cmd_factory_reset',
  queuedAt: '2026-04-09T16:30:40.000Z',
  status: 'SENT',
  origin: 'MANUAL',
  toVenueId: null,
  cancellable: false,
  discardable: true,
  discardableAt: '2026-04-10T16:30:40.000Z',
}

const ESTADOS: Array<{ titulo: string; wipe: OrgPendingWipe; venueName: string | null }> = [
  {
    titulo: 'A · La terminal AÚN NO lo recibe → se puede cancelar',
    venueName: 'BAE MUÑOZ SLP (898)',
    wipe: { ...base, status: 'QUEUED', origin: 'MIGRATION', toVenueId: 'v-898', cancellable: true, discardable: false },
  },
  {
    titulo: 'B · Ya lo recibió, lleva MENOS de 24 h → sólo los pasos y desde cuándo',
    venueName: null,
    wipe: {
      ...base,
      queuedAt: new Date(Date.parse('2026-09-01T12:00:00.000Z') - 2 * HOUR).toISOString(),
      discardable: false,
      discardableAt: '2026-09-02T10:00:00.000Z',
    },
  },
  { titulo: 'C · Ya lo recibió y lleva MÁS de 24 h → se puede descartar', venueName: null, wipe: base },
]

const SALIDA = '/tmp/vista-previa-borrado-pendiente'
const ENCENDIDA = process.env.VISTA_PREVIA === '1'

describe.skipIf(!ENCENDIDA)('vista previa del bloque de borrado pendiente', () => {
  it('vuelca los tres estados a un HTML', () => {
    fs.mkdirSync(SALIDA, { recursive: true })
    const css = fs.readFileSync(path.join(process.cwd(), 'dist/assets/index-b2b_rYxi.css'), 'utf8')

    const bloques = ESTADOS.map(({ titulo, wipe, venueName }) => {
      const vista = render(
        <PendingWipePanel pendingWipe={wipe} venueName={venueName} busy={false} onCancel={() => {}} onDiscard={() => {}} />,
      )
      const html = vista.container.innerHTML
      vista.unmount()
      // Ninguna llave debe salir cruda.
      expect(html).not.toContain('terminals.migrate.pendingWipe.')
      return `<section><h2>${titulo}</h2><div class="marco">${html}</div></section>`
    }).join('\n')

    fs.writeFileSync(
      path.join(SALIDA, 'borrado-pendiente.html'),
      `<!doctype html><html lang="es"><head><meta charset="utf-8"><style>${css}</style>
<style>body{background:hsl(var(--background));color:hsl(var(--foreground));font-family:ui-sans-serif,system-ui;padding:24px;max-width:720px;margin:0 auto}
h1{font-size:20px;font-weight:600;margin:0 0 4px}h2{font-size:13px;font-weight:500;color:hsl(var(--muted-foreground));margin:24px 0 8px}
.marco{border:1px solid hsl(var(--border));border-radius:12px;padding:16px;background:hsl(var(--background))}</style></head>
<body><h1>Migrar terminal · bloqueo «borrado pendiente»</h1>
<p style="font-size:13px;color:hsl(var(--muted-foreground));margin:0 0 8px">Textos reales de locales/es · CSS compilado de la app</p>
${bloques}</body></html>`,
    )
  })
})
