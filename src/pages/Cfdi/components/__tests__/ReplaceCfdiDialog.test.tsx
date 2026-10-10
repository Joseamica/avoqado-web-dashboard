/**
 * 🔴 Lo único que esta pantalla NO puede hacer es mentir sobre la factura vieja.
 *
 * El SAT puede dejar la cancelación en trámite (espera la aceptación del receptor) o rechazarla, y
 * en los DOS casos la factura anterior SIGUE VIGENTE. Un «listo, cancelada» ahí le haría creer al
 * negocio que tiene un solo comprobante cuando tiene dos. Estas pruebas fijan los tres desenlaces.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react'
import es from '@/locales/es/cfdi.json'
import type { Cfdi, ReplaceCfdiResponse } from '@/services/cfdi.service'

const traducir = (key: string, opts?: Record<string, unknown>) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es as any)
  if (typeof raw !== 'string') return key
  return raw.replace(/\{\{(\w+)\}\}/g, (_: string, k: string) => String(opts?.[k] ?? ''))
}
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: traducir, i18n: { language: 'es' } }),
}))

const mutate = vi.fn()
vi.mock('@/hooks/use-cfdi', () => ({
  useReplaceCfdi: () => ({ mutate, isPending: false }),
}))

import { ReplaceCfdiDialog } from '../ReplaceCfdiDialog'

const factura = {
  id: 'cfdi-orig',
  serie: 'A',
  folio: '14',
  uuid: 'UUID-ORIG',
  totalCents: 12500,
  receptorNombre: 'LAURA PÉREZ',
  status: 'STAMPED',
} as unknown as Cfdi

function responder(res: Partial<ReplaceCfdiResponse>) {
  mutate.mockImplementation((_vars: unknown, opts: any) =>
    opts.onSuccess({
      status: 'REPLACED',
      sustituta: { id: 's1', uuid: 'UUID-SUB', serie: 'A', folio: '16', totalCents: 13500, xmlUrl: null, pdfUrl: null },
      original: { id: 'cfdi-orig', uuid: 'UUID-ORIG' },
      cancelStatus: 'CANCELLED',
      cancelPendiente: false,
      ...res,
    }),
  )
}

const confirmar = () => fireEvent.click(screen.getByRole('button', { name: es.replaceDialog.confirm }))

describe('ReplaceCfdiDialog', () => {
  beforeEach(() => {
    mutate.mockReset()
  })

  it('antes de confirmar enseña la factura actual y qué va a pasar', () => {
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent('A-14')
    expect(dialog).toHaveTextContent(es.replaceDialog.step1)
    expect(dialog).toHaveTextContent(es.replaceDialog.step2)
  })

  it('cancelación confirmada ⇒ dice que la anterior quedó cancelada', async () => {
    responder({ cancelStatus: 'CANCELLED', cancelPendiente: false })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelledOk))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('A-16')
  })

  it('🔴 cancelación EN TRÁMITE ⇒ dice que la anterior sigue vigente, nunca «cancelada»', async () => {
    responder({ cancelStatus: 'REQUESTED', cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelPending))
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.cancelledOk)
  })

  it('🔴 cancelación RECHAZADA ⇒ lo dice, y la sustituta sigue emitida', async () => {
    responder({ cancelStatus: 'REJECTED', cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelRejected))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.doneTitle)
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.cancelledOk)
  })

  it('🔴 422 ⇒ enseña los motivos y NO afirma que se emitió nada', async () => {
    mutate.mockImplementation((_vars: unknown, opts: any) =>
      opts.onError({ response: { status: 422, data: { reasons: ['El total de la factura corregida no coincide con lo cobrado.'] } } }),
    )
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.rejectedTitle))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('no coincide con lo cobrado')
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.doneTitle)
  })
})

// C2 · T10 (R5 de la re-revisión 2 de la T2, con M9): la respuesta trae `cancelAviso` (no se envió la cancelación: no se pudo consultar al
// SAT) o `cancelConflicto` (no se pudo pedir: p. ej. una nota de crédito viva). El panel lo dice en vez de culpar al SAT.
describe('ReplaceCfdiDialog — C2 · T10 · R5', () => {
  // Con llaves: en vitest, una función devuelta por `beforeEach` es su limpieza (devolver el mock lo llamaría sin argumentos).
  beforeEach(() => {
    mutate.mockReset()
  })
  const AVISO =
    'No se pudo consultar al SAT antes de enviar la cancelación: no se envió nada y la factura sigue vigente. Intenta de nuevo en unos minutos.'
  it('🔴 `cancelAviso` ⇒ «no se envió su cancelación» + el texto del servidor; nunca «El SAT no aceptó… contacta a soporte»', async () => {
    responder({ cancelStatus: 'REJECTED', cancelPendiente: true, cancelAviso: AVISO })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelNotSent))
    expect(screen.getByRole('alertdialog')).toHaveTextContent(AVISO)
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.cancelRejected)
  })
  it('🔴 `cancelConflicto` ⇒ «no se pudo pedir su cancelación» + el porqué del servidor', async () => {
    responder({
      cancelStatus: null,
      cancelPendiente: true,
      cancelConflicto: 'Esta factura tiene la nota de crédito A-3; el SAT exige cancelar primero lo relacionado.',
    })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    await waitFor(() => expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.cancelNotRequested))
    expect(screen.getByRole('alertdialog')).toHaveTextContent('el SAT exige cancelar primero lo relacionado')
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent(es.replaceDialog.cancelPending)
  })
})

// C2 · T10 ronda 1 (I-2): «Terminar la sustitución». La original trae una sustituta YA TIMBRADA: el diálogo no promete timbrar otra factura;
// dice que falta pedir la cancelación de ésta y lo hace con la MISMA ruta (el servidor sólo reanuda la cancelación). Los avisos de «no salió»
// y «no se pudo pedir» mandan a esa acción, que sí existe.
describe('ReplaceCfdiDialog — C2 · T10 ronda 1 · I-2: terminar la sustitución', () => {
  beforeEach(() => {
    mutate.mockReset()
  })
  const conSustituta = {
    ...factura,
    cancelStatus: 'REJECTED',
    replacedBy: [{ id: 's1', uuid: 'UUID-SUB', serie: 'A', folio: '16', status: 'STAMPED', totalCents: 13500 }],
  } as unknown as Cfdi
  it('🔴 con la sustituta timbrada: título y texto de «terminar», sin el paso «se timbra la factura corregida»; confirma con la original', () => {
    render(<ReplaceCfdiDialog cfdi={conSustituta} onOpenChange={() => {}} />)
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(es.replaceDialog.finishTitle)
    expect(dialog).toHaveTextContent('La factura corregida A-16 ya está timbrada')
    expect(dialog).not.toHaveTextContent(es.replaceDialog.step1)
    fireEvent.click(screen.getByRole('button', { name: es.replaceDialog.finishConfirm }))
    expect(mutate).toHaveBeenCalledWith({ cfdiId: 'cfdi-orig' }, expect.anything())
  })
  it('control — con una sustituta NO timbrada el diálogo es el de siempre', () => {
    render(
      <ReplaceCfdiDialog
        cfdi={{ ...conSustituta, replacedBy: [{ ...(conSustituta.replacedBy as any)[0], status: 'STAMP_FAILED' }] } as unknown as Cfdi}
        onOpenChange={() => {}}
      />,
    )
    expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.step1)
    expect(screen.getByRole('button', { name: es.replaceDialog.confirm })).toBeInTheDocument()
  })
  // C2 · ola final (N-1 de la re-revisión de T10): el RESULTADO de «terminar» no dice que se emitió una factura nueva: no se timbró nada.
  const pedirCancelacion = () => fireEvent.click(screen.getByRole('button', { name: es.replaceDialog.finishConfirm }))
  it('🔴 N-1 · terminar con la cancelación en trámite ⇒ «Cancelación pedida» y «Factura corregida: A-16», nunca «emitida»/«nueva»', async () => {
    responder({ cancelStatus: 'REQUESTED', cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={conSustituta} onOpenChange={() => {}} />)
    pedirCancelacion()
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(dialog).toHaveTextContent(es.replaceDialog.cancelPending))
    expect(dialog).toHaveTextContent(es.replaceDialog.finishRequestedTitle)
    expect(dialog).toHaveTextContent(`${es.replaceDialog.correctedInvoice}: A-16`)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.doneTitle)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.newInvoice)
  })
  it('🔴 N-1 · terminar con la anterior ya cancelada ⇒ «Sustitución terminada» y «Factura corregida: A-16»', async () => {
    responder({ cancelStatus: 'CANCELLED', cancelPendiente: false })
    render(<ReplaceCfdiDialog cfdi={conSustituta} onOpenChange={() => {}} />)
    pedirCancelacion()
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(dialog).toHaveTextContent(es.replaceDialog.cancelledOk))
    expect(dialog).toHaveTextContent(es.replaceDialog.finishDoneTitle)
    expect(dialog).toHaveTextContent(`${es.replaceDialog.correctedInvoice}: A-16`)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.finishRequestedTitle)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.doneTitle)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.newInvoice)
  })
  it('🔴 N-1 · terminar y la cancelación NO salió (`cancelAviso`) ⇒ el título no dice «pedida» ni «terminada»', async () => {
    responder({ cancelStatus: 'REJECTED', cancelPendiente: true, cancelAviso: 'No se pudo consultar al SAT.' })
    render(<ReplaceCfdiDialog cfdi={conSustituta} onOpenChange={() => {}} />)
    pedirCancelacion()
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(dialog).toHaveTextContent(es.replaceDialog.cancelNotSent))
    expect(dialog).toHaveTextContent(es.replaceDialog.finishNotSentTitle)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.finishRequestedTitle)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.finishDoneTitle)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.doneTitle)
  })
  it('control — sustituir de siempre ⇒ «Factura corregida emitida» y «Factura nueva: A-16»', async () => {
    responder({ cancelStatus: 'REQUESTED', cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(dialog).toHaveTextContent(es.replaceDialog.cancelPending))
    expect(dialog).toHaveTextContent(es.replaceDialog.doneTitle)
    expect(dialog).toHaveTextContent(`${es.replaceDialog.newInvoice}: A-16`)
    expect(dialog).not.toHaveTextContent(es.replaceDialog.finishRequestedTitle)
  })
  // C2 · ola final, ronda (m1 de review-OF): cada desenlace de «terminar» tiene título e ícono veraces. Sólo «terminada» lleva palomita
  // verde; lo que deja la anterior vigente lleva reloj ámbar, y el rechazo, la X roja.
  const R = es.replaceDialog
  // Ronda 3: el cuerpo también dice lo que pasó. Cada caso enseña EXACTAMENTE uno de estos textos (ninguno contiene a otro).
  const CUERPOS = [
    'cancelledOk',
    'cancelPending',
    'cancelRejected',
    'cancelNotSent',
    'cancelNotRequested',
    'cancelInDoubt',
    'cancelUnconfirmed',
  ] as const
  const soloEsteCuerpo = (dialog: HTMLElement, cuerpo: (typeof CUERPOS)[number]) => {
    expect(dialog).toHaveTextContent(R[cuerpo])
    for (const otro of CUERPOS) if (otro !== cuerpo) expect([otro, dialog.textContent?.includes(R[otro])]).toEqual([otro, false])
  }
  // Las filas sin `enDuda`/`cancelIntentoNuevo` son el servidor VIEJO (los campos no vienen).
  it.each([
    ['control — terminada', { cancelStatus: 'CANCELLED', cancelPendiente: false }, R.finishDoneTitle, 'text-emerald-600', 'cancelledOk'],
    [
      'control — m1 · pedida (en trámite)',
      { cancelStatus: 'REQUESTED', cancelPendiente: true },
      R.finishRequestedTitle,
      'text-amber-600',
      'cancelPending',
    ],
    [
      'control — no salió',
      { cancelStatus: null, cancelPendiente: true, cancelAviso: 'Sin SAT.' },
      R.finishNotSentTitle,
      'text-amber-600',
      'cancelNotSent',
    ],
    [
      'control — no se pudo pedir',
      { cancelStatus: 'REJECTED', cancelPendiente: true, cancelConflicto: 'Nota viva.' },
      R.finishNotSentTitle,
      'text-amber-600',
      'cancelNotRequested',
    ],
    [
      'control — m1 · rechazada al momento (servidor viejo)',
      { cancelStatus: 'REJECTED', cancelPendiente: true },
      R.finishRejectedTitle,
      'text-destructive',
      'cancelRejected',
    ],
    [
      '🔴 r3 · sin confirmar (servidor viejo, `cancelStatus: null`): el cuerpo no dice «en trámite»',
      { cancelStatus: null, cancelPendiente: true },
      R.finishUnconfirmedTitle,
      'text-amber-600',
      'cancelUnconfirmed',
    ],
    [
      '🔴 r3 · `enDuda` ⇒ «no se pudo confirmar», y el cuerpo «en duda», nunca «en trámite»',
      { cancelStatus: 'REQUESTED', cancelPendiente: true, enDuda: true, cancelIntentoNuevo: true },
      R.finishUnconfirmedTitle,
      'text-amber-600',
      'cancelInDoubt',
    ],
    [
      '🔴 r3 · REJECTED de un intento ANTERIOR (`cancelIntentoNuevo: false`) ⇒ «no salió», nunca «el SAT no aceptó»',
      { cancelStatus: 'REJECTED', cancelPendiente: true, cancelIntentoNuevo: false },
      R.finishNotSentTitle,
      'text-amber-600',
      'cancelNotSent',
    ],
    [
      '🔴 r3 · sin cancelación y sin intento nuevo (`cancelStatus: null`, `cancelIntentoNuevo: false`) ⇒ «no salió»',
      { cancelStatus: null, cancelPendiente: true, cancelIntentoNuevo: false },
      R.finishNotSentTitle,
      'text-amber-600',
      'cancelNotSent',
    ],
    [
      'control — r3 · rechazo de ESTA petición (`cancelIntentoNuevo: true`)',
      { cancelStatus: 'REJECTED', cancelPendiente: true, cancelIntentoNuevo: true },
      R.finishRejectedTitle,
      'text-destructive',
      'cancelRejected',
    ],
    [
      'control — r3 · en trámite por otra petición (`REQUESTED`, `cancelIntentoNuevo: false`)',
      { cancelStatus: 'REQUESTED', cancelPendiente: true, cancelIntentoNuevo: false },
      R.finishRequestedTitle,
      'text-amber-600',
      'cancelPending',
    ],
  ] as const)('%s ⇒ su título, su ícono y su cuerpo', async (_caso, res, titulo, color, cuerpo) => {
    responder(res as Partial<ReplaceCfdiResponse>)
    render(<ReplaceCfdiDialog cfdi={conSustituta} onOpenChange={() => {}} />)
    pedirCancelacion()
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(dialog).toHaveTextContent(`${R.correctedInvoice}: A-16`))
    const encabezado = within(dialog).getByRole('heading')
    expect(encabezado).toHaveTextContent(new RegExp(`^${titulo}$`))
    expect(encabezado.querySelector('svg')).toHaveClass(color)
    soloEsteCuerpo(dialog, cuerpo)
  })
  it.each([
    [
      '🔴 r3 · sustituir de siempre con `enDuda` ⇒ cuerpo «en duda»',
      { cancelStatus: 'REQUESTED', enDuda: true, cancelIntentoNuevo: true },
      'cancelInDoubt',
    ],
    [
      '🔴 r3 · sustituir de siempre con un REJECTED anterior ⇒ cuerpo «no salió»',
      { cancelStatus: 'REJECTED', cancelIntentoNuevo: false },
      'cancelNotSent',
    ],
  ] as const)('%s; el título sigue siendo «emitida»', async (_caso, res, cuerpo) => {
    responder({ ...res, cancelPendiente: true } as Partial<ReplaceCfdiResponse>)
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    const dialog = screen.getByRole('alertdialog')
    await waitFor(() => expect(dialog).toHaveTextContent(`${R.newInvoice}: A-16`))
    expect(within(dialog).getByRole('heading')).toHaveTextContent(new RegExp(`^${R.doneTitle}$`))
    soloEsteCuerpo(dialog, cuerpo)
  })
  it('control — r3 · los textos «en duda» mandan a «Consultar estado» y «sin confirmar» a «Terminar la sustitución»', () => {
    expect(R.cancelInDoubt).toContain(`«${es.actions.checkStatus}»`)
    expect(R.cancelUnconfirmed).toContain(`«${es.actions.finishReplace}»`)
    for (const k of ['cancelInDoubt', 'cancelUnconfirmed'] as const) expect([k, R[k]]).toEqual([k, expect.not.stringMatching(/en trámite/)])
  })
  it('🔴 los avisos de «no salió» / «no se pudo pedir» / «el SAT no aceptó» mandan a «Terminar la sustitución» (la acción que existe)', () => {
    for (const k of ['cancelNotSent', 'cancelNotRequested', 'cancelRejected'] as const) {
      expect([k, (es.replaceDialog as any)[k]]).toEqual([k, expect.stringContaining(`«${es.actions.finishReplace}»`)])
      expect((es.replaceDialog as any)[k]).not.toMatch(/Corregir importe/)
    }
  })
})

// Micro-ronda final (review-QA-rereview, Minor): «Corregir importe» con la corregida EN DUDA enseñaba «Request failed with status code 502».
// Ningún desenlace de este diálogo enseña el texto de axios.
describe('ReplaceCfdiDialog — micro-ronda final: los errores dicen lo que pasó, nunca el texto de axios', () => {
  beforeEach(() => {
    mutate.mockReset()
  })
  const fallar = (status: number | undefined, data?: Record<string, unknown>) =>
    mutate.mockImplementation((_v: unknown, opts: any) =>
      opts.onError({ ...(status ? { response: { status, data } } : {}), message: `Request failed with status code ${status ?? 500}` }),
    )
  const sustitutaEnDuda = { status: 'STAMP_FAILED', sustituta: { id: 's1' }, cancelPendiente: true }
  it('🔴 502 con `timbreEnDuda` ⇒ «quedó en duda… no la vuelvas a emitir; consulta su estado» y el botón ya no ofrece emitir otra vez', () => {
    fallar(502, { ...sustitutaEnDuda, timbreEnDuda: true, error: 'texto del servidor para quien opera' })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    const dialog = screen.getByRole('alertdialog')
    expect(dialog).toHaveTextContent(es.replaceDialog.stampInDoubt)
    expect(dialog).not.toHaveTextContent('Request failed')
    expect(screen.getByRole('button', { name: es.replaceDialog.confirm })).toBeDisabled()
  })
  it('🔴 502 de un rechazo (sin texto en el cuerpo) ⇒ «El PAC no timbró la factura corregida…», nunca «Request failed…»', () => {
    fallar(502, { status: 'STAMP_FAILED', sustituta: { id: 's1' }, cancelPendiente: true })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.stampRejected)
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('Request failed')
    expect(screen.getByRole('button', { name: es.replaceDialog.confirm })).toBeEnabled()
  })
  it('🔴 sin respuesta (red) o un 500 sin texto ⇒ el genérico del diálogo, nunca «Request failed…»', () => {
    fallar(undefined)
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    expect(screen.getByRole('alertdialog')).toHaveTextContent(es.replaceDialog.genericError)
    expect(screen.getByRole('alertdialog')).not.toHaveTextContent('Request failed')
  })
  it('control — un 409 con texto del servidor enseña ese texto', () => {
    fallar(409, { error: 'Sustitución en proceso para esta factura' })
    render(<ReplaceCfdiDialog cfdi={factura} onOpenChange={() => {}} />)
    confirmar()
    expect(screen.getByRole('alertdialog')).toHaveTextContent('Sustitución en proceso para esta factura')
  })
})
