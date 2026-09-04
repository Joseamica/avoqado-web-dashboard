import { describe, expect, it } from 'vitest'
import {
  actionTone,
  dateFilterToRange,
  formatActionFallback,
  formatDetailValue,
  formatEntityId,
  groupByDay,
  isOpaqueId,
  redactSensitive,
  toDetailRows,
} from '../formatActivity'

describe('isOpaqueId', () => {
  it('reconoce un cuid de Prisma', () => {
    expect(isOpaqueId('cmhvejgq300ad2gtxbrawgh7w')).toBe(true)
    expect(isOpaqueId('cmtdlxl300aakna2agcago6qk')).toBe(true)
  })

  it('reconoce un uuid', () => {
    expect(isOpaqueId('6eeface3-8258-4e11-ab9f-a0b368090007')).toBe(true)
  })

  // 🔴 El defecto que originó este módulo: PERMISSION_DENIED guarda el NOMBRE
  // del permiso en entityId, y la tabla lo cortaba a 8 caracteres — el usuario
  // leía "#settleme", que no significa nada.
  it('NO trata un nombre de permiso como id opaco', () => {
    expect(isOpaqueId('settlements:read')).toBe(false)
    expect(isOpaqueId('billing:subscriptions:read')).toBe(false)
    expect(isOpaqueId('role-config:read')).toBe(false)
    expect(isOpaqueId('venues:manage')).toBe(false)
  })

  it('NO trata un texto corto legible como id opaco', () => {
    expect(isOpaqueId('Mesa 4')).toBe(false)
    expect(isOpaqueId('AVQD-2841548624')).toBe(false)
  })
})

describe('formatEntityId', () => {
  it('muestra completo lo que se puede leer', () => {
    expect(formatEntityId('settlements:read')).toEqual({ text: 'settlements:read', truncated: false })
  })

  it('acorta un id opaco y avisa que está acortado', () => {
    expect(formatEntityId('cmhvejgq300ad2gtxbrawgh7w')).toEqual({ text: 'cmhvejgq…', truncated: true })
  })

  it('tolera vacío', () => {
    expect(formatEntityId(null)).toBeNull()
    expect(formatEntityId('')).toBeNull()
    expect(formatEntityId('   ')).toBeNull()
  })
})

describe('redactSensitive', () => {
  it('oculta contraseñas y tokens en cualquier nivel', () => {
    const out = redactSensitive({ password: 'hunter2', nested: { apiKey: 'sk-123', ok: 1 } }) as any
    expect(out.password).toBe('••• redacted')
    expect(out.nested.apiKey).toBe('••• redacted')
    expect(out.nested.ok).toBe(1)
  })

  it('recorre arreglos', () => {
    const out = redactSensitive([{ token: 'abc' }]) as any[]
    expect(out[0].token).toBe('••• redacted')
  })
})

describe('formatDetailValue', () => {
  it('traduce booleanos a palabras', () => {
    expect(formatDetailValue(true, k => (k === 'yes' ? 'Sí' : 'No'))).toBe('Sí')
    expect(formatDetailValue(false, k => (k === 'yes' ? 'Sí' : 'No'))).toBe('No')
  })

  it('marca los vacíos en vez de imprimir "null"', () => {
    expect(formatDetailValue(null, () => '—')).toBe('—')
    expect(formatDetailValue(undefined, () => '—')).toBe('—')
  })

  it('deja los números y textos tal cual', () => {
    expect(formatDetailValue(42, () => '')).toBe('42')
    expect(formatDetailValue('WAITER', () => '')).toBe('WAITER')
  })

  it('serializa objetos y arreglos de forma compacta', () => {
    expect(formatDetailValue({ a: 1 }, () => '')).toBe('{"a":1}')
    expect(formatDetailValue([1, 2], () => '')).toBe('[1,2]')
  })
})

describe('toDetailRows', () => {
  // El llamador devuelve null cuando no hay traducción — así el módulo no
  // depende de que i18next haga eco de la clave, que es un detalle suyo.
  const labelOf = (key: string) => (key === 'permission' ? 'Permiso' : null)

  it('traduce la clave cuando existe y conserva la cruda si no', () => {
    const rows = toDetailRows({ permission: 'tpv:read', weirdKey: 1 }, labelOf, () => '—')
    expect(rows).toEqual([
      { key: 'permission', label: 'Permiso', value: 'tpv:read' },
      { key: 'weirdKey', label: 'weirdKey', value: '1' },
    ])
  })

  it('aplica la redacción antes de mostrar', () => {
    const rows = toDetailRows({ password: 'hunter2' }, labelOf, () => '—')
    expect(rows[0].value).toBe('••• redacted')
  })

  it('devuelve vacío cuando no hay datos', () => {
    expect(toDetailRows(null, labelOf, () => '—')).toEqual([])
    expect(toDetailRows({}, labelOf, () => '—')).toEqual([])
  })
})

describe('groupByDay', () => {
  // La bitácora se lee "qué pasó ese día", así que la tabla se corta por día.
  // La clave del grupo la da el formateador en la zona del NEGOCIO, nunca la
  // del navegador — por eso entra como parámetro y no se calcula aquí.
  const dayKey = (iso: string) => iso.slice(0, 10)

  it('agrupa conservando el orden de llegada', () => {
    const logs = [
      { id: 'a', createdAt: '2026-08-31T23:00:00Z' },
      { id: 'b', createdAt: '2026-08-31T10:00:00Z' },
      { id: 'c', createdAt: '2026-08-30T10:00:00Z' },
    ]
    const groups = groupByDay(logs, dayKey)
    expect(groups.map(g => g.day)).toEqual(['2026-08-31', '2026-08-30'])
    expect(groups[0].logs.map(l => l.id)).toEqual(['a', 'b'])
    expect(groups[1].logs.map(l => l.id)).toEqual(['c'])
  })

  it('no se rompe con una lista vacía', () => {
    expect(groupByDay([], dayKey)).toEqual([])
  })
})

describe('actionTone', () => {
  // Con 539 códigos de acción, un mapa exacto es inmantenible: se clasifica
  // por familia para que una acción nueva del servidor NO salga sin color.
  it('marca en rojo lo que destruye o se niega', () => {
    expect(actionTone('PRODUCT_DELETED')).toBe('destructive')
    expect(actionTone('PERMISSION_DENIED')).toBe('destructive')
    expect(actionTone('PURCHASE_ORDER_REJECTED')).toBe('destructive')
    expect(actionTone('ORDER_CANCELLED')).toBe('destructive')
    expect(actionTone('MASTER_LOGIN_FAILED')).toBe('destructive')
  })

  it('marca en verde lo que crea o aprueba', () => {
    expect(actionTone('PRODUCT_CREATED')).toBe('positive')
    expect(actionTone('PURCHASE_ORDER_APPROVED')).toBe('positive')
    expect(actionTone('WALLET_PASS_ISSUED')).toBe('positive')
  })

  it('marca en ámbar lo que un dueño querría revisar', () => {
    expect(actionTone('ORDER_COMPED')).toBe('attention')
    expect(actionTone('ITEM_VOIDED')).toBe('attention')
    expect(actionTone('PERMISSION_OVERRIDE_USED')).toBe('attention')
    expect(actionTone('STOCK_WENT_NEGATIVE')).toBe('attention')
  })

  it('deja en neutro los cambios de configuración', () => {
    expect(actionTone('SETTINGS_UPDATED')).toBe('neutral')
    expect(actionTone('MENU_UPDATED')).toBe('neutral')
  })

  it('nunca se queda sin respuesta ante un código desconocido', () => {
    expect(actionTone('ALGO_QUE_NO_EXISTE_TODAVIA')).toBe('neutral')
    expect(actionTone('')).toBe('neutral')
  })

  // 🔴 "Denegado" gana sobre "creado": PERMISSION_DENIED sobre una creación no
  // puede pintarse de verde como si hubiera ocurrido.
  it('la negación gana sobre la creación', () => {
    expect(actionTone('CREATE_DENIED')).toBe('destructive')
  })
})

describe('dateFilterToRange', () => {
  const today = new Date('2026-08-31T12:00:00Z')

  it('un día concreto acota los dos extremos', () => {
    expect(dateFilterToRange({ operator: 'on', value: '2026-08-20' }, today)).toEqual({
      startDate: '2026-08-20',
      endDate: '2026-08-20',
    })
  })

  it('entre dos fechas', () => {
    expect(dateFilterToRange({ operator: 'between', value: '2026-08-01', value2: '2026-08-15' }, today)).toEqual({
      startDate: '2026-08-01',
      endDate: '2026-08-15',
    })
  })

  it('antes / después dejan el otro extremo abierto', () => {
    expect(dateFilterToRange({ operator: 'before', value: '2026-08-20' }, today)).toEqual({ endDate: '2026-08-20' })
    expect(dateFilterToRange({ operator: 'after', value: '2026-08-20' }, today)).toEqual({ startDate: '2026-08-20' })
  })

  it('"en los últimos N días" se cuenta desde hoy', () => {
    expect(dateFilterToRange({ operator: 'last', value: 7, unit: 'days' }, today)).toEqual({ startDate: '2026-08-24' })
  })

  // El 31 de junio no existe: restar 2 meses al 31 de agosto se desborda al
  // 1 de julio. Se fija el comportamiento en vez de fingir que no pasa.
  it('"en los últimos N meses" también', () => {
    expect(dateFilterToRange({ operator: 'last', value: 2, unit: 'months' }, today)).toEqual({ startDate: '2026-07-01' })
  })

  it('sin filtro no acota nada', () => {
    expect(dateFilterToRange(null, today)).toEqual({})
  })

  // Un filtro a medio llenar no puede mandar `startDate=undefined` al servidor.
  it('ignora un filtro incompleto', () => {
    expect(dateFilterToRange({ operator: 'between', value: '2026-08-01' }, today)).toEqual({})
    expect(dateFilterToRange({ operator: 'on', value: null }, today)).toEqual({})
  })
})

describe('catálogo i18n: dinero sin turno está registrado en los 3 idiomas', () => {
  const catalogos = {
    es: () => import('@/locales/es/organization.json'),
    en: () => import('@/locales/en/organization.json'),
    fr: () => import('@/locales/fr/organization.json'),
  }

  for (const [idioma, cargar] of Object.entries(catalogos)) {
    it(`${idioma}: muestra la acción canónica, la histórica y el payload en pesos`, async () => {
      const { activityLog } = ((await cargar()) as { default: any }).default
      expect(activityLog.actions.PAYMENT_WITHOUT_SHIFT).toBeTruthy()
      expect(activityLog.actions.CRYPTO_PAYMENT_WITHOUT_SHIFT).toBeTruthy()
      for (const llave of [
        'amountPesos',
        'tipPesos',
        'totalPesos',
        'reason',
        'candidateShiftId',
        'observedShiftStatus',
        'processor',
        'orderId',
      ]) {
        expect(activityLog.detailKeys[llave]).toBeTruthy()
      }
    })
  }

  it('la acción histórica PAYMENT_PENDING_POST_CLOSE_RECONCILIATION sigue legible por fallback', () => {
    expect(formatActionFallback('PAYMENT_PENDING_POST_CLOSE_RECONCILIATION')).toBe('Payment pending post close reconciliation')
  })
})
