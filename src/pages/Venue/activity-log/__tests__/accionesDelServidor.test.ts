import { describe, expect, it } from 'vitest'
import es from '@/locales/es/organization.json'
import en from '@/locales/en/organization.json'
import accionesDelServidor from './accionesDelServidor.json'

type Bitacora = { activityLog: { actions: Record<string, string>; detailKeys: Record<string, string> } }

/**
 * Todas las acciones que el SERVIDOR escribe en la bitácora (ActivityLog) tienen su texto en español y en inglés.
 *
 * Sin texto, la fila sale con el código traducido a medias («Table opened» en una pantalla en español), como pasó
 * con TABLE_OPENED (hz:8024bc1c:D31). La lista (1,068 acciones) se sacó del código de `avoqado-server` en `develop`
 * (12-nov-2026) con `docs/audit/2026-11-12-bitacora-etiquetas-y-organizacion/acciones-del-servidor.cjs` del workspace:
 * lee el AST y junta las acciones de `logAction`, `auditMcpWrite`, `activityLog.create` y sus envoltorios; las que se
 * arman con plantilla (`KITCHEN_${…}`, `SIM_CUSTODY_${…}`, …) están en `acciones-a-mano.txt`, al lado. Al agregar
 * acciones en el servidor, vuelve a correrlo y pon aquí su salida: esta prueba falla hasta que cada una tenga texto.
 */
const ACCIONES = accionesDelServidor as string[]

describe('bitácora: cada acción del servidor tiene su texto', () => {
  for (const [lng, bundle] of [
    ['es', es],
    ['en', en],
  ] as const) {
    it(`${lng}: ninguna acción del servidor se queda sin texto`, () => {
      const acciones = (bundle as unknown as Bitacora).activityLog.actions
      const sinTexto = ACCIONES.filter(a => !/\S/.test(acciones[a] ?? ''))
      expect(sinTexto).toEqual([])
    })
  }

  it('español e inglés tienen las mismas acciones', () => {
    const llaves = (b: unknown) => Object.keys((b as Bitacora).activityLog.actions).sort()
    expect(llaves(es)).toEqual(llaves(en))
  })

  it('TABLE_OPENED («Mesa abierta») y sus datos se leen en español', () => {
    const b = (es as unknown as Bitacora).activityLog
    expect(b.actions.TABLE_OPENED).toBe('Mesa abierta')
    // `table.tpv.service.ts` guarda `data: { orderId, covers }`.
    expect(b.detailKeys.orderId).toEqual(expect.stringMatching(/\S/))
    expect(b.detailKeys.covers).toBe('Comensales')
    expect((en as unknown as Bitacora).activityLog.detailKeys.covers).toEqual(expect.stringMatching(/\S/))
  })
})
