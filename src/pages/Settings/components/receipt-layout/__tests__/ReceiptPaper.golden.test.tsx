/**
 * La vista previa contra el GOLDEN real de la Fase 0.
 *
 * Las pruebas de al lado comprueban cómo se pinta cada `kind` por separado. Ésta comprueba lo
 * único que hace útil la pantalla: que el papel enseñe EXACTAMENTE las 45 líneas que el
 * intérprete del servidor —el mismo que van a usar Android, iOS y la PAX— produce para el
 * ticket canónico, en 48 y en 32 columnas, sin recortar ni reordenar ni una.
 *
 * 🔴 Los goldens se COPIAN de `avoqado-server/tests/fixtures/receipt-layout/golden/`. Si esa
 * carpeta cambia y ésta no, esta prueba deja de vigilar nada: se resincroniza con
 * `scripts/sync-receipt-golden.sh` en el mismo cambio que mueva el intérprete.
 */
import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ReceiptPaper } from '@/pages/Settings/components/receipt-layout/ReceiptPaper'
import type { LogicalLine } from '@/services/receiptLayout.service'
import golden48 from './fixtures/canonical.48.golden.json'
import golden32 from './fixtures/canonical.32.golden.json'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const casos = [
  { nombre: '80 mm (48 columnas)', golden: golden48, width: 48 as const },
  { nombre: '58 mm (32 columnas)', golden: golden32, width: 32 as const },
]

describe.each(casos)('ReceiptPaper contra el golden canónico — $nombre', ({ golden, width }) => {
  const lines = golden.lines as LogicalLine[]

  it('el golden no está vacío (si lo estuviera, todo lo de abajo pasaría en falso)', () => {
    expect(lines.length).toBeGreaterThan(20)
    expect(golden.width).toBe(width)
  })

  it('🔴 pinta TODAS las líneas de texto, verbatim y en el mismo orden', () => {
    const { container } = render(<ReceiptPaper lines={lines} width={width} />)
    const esperadas = lines.filter((l): l is Extract<LogicalLine, { kind: 'text' }> => l.kind === 'text').map(l => l.text)
    const pintadas = [...container.querySelectorAll('[data-line="text"]')].map(el => el.textContent ?? '')
    expect(pintadas).toEqual(esperadas)
  })

  it('🔴 ninguna línea de texto excede el ancho del papel: el corte se VE, no se disimula', () => {
    const { container } = render(<ReceiptPaper lines={lines} width={width} />)
    for (const el of container.querySelectorAll('[data-line="text"]')) {
      const doble = el.getAttribute('data-double') === 'true'
      // Una línea double gasta dos columnas por carácter ⇒ cabe la mitad.
      expect((el.textContent ?? '').length).toBeLessThanOrEqual(doble ? Math.floor(width / 2) : width)
    }
  })

  it('cada kind del golden llega al papel: ni uno se traga en silencio', () => {
    const { container } = render(<ReceiptPaper lines={lines} width={width} />)
    const contar = (kind: string) => container.querySelectorAll(`[data-line="${kind}"]`).length
    const feeds = lines.filter(l => l.kind === 'feed').reduce((n, l) => n + (l as { lines: number }).lines, 0)
    expect(contar('text')).toBe(lines.filter(l => l.kind === 'text').length)
    expect(contar('image')).toBe(lines.filter(l => l.kind === 'image').length)
    expect(contar('qr')).toBe(lines.filter(l => l.kind === 'qr').length)
    expect(contar('feed')).toBe(feeds)
    expect(contar('cut')).toBe(lines.filter(l => l.kind === 'cut').length)
  })
})
