import { act, cleanup, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Config, DriveStep } from 'driver.js'

const tour = vi.hoisted(() => ({ config: {} as Config, moveNext: vi.fn(), destroy: vi.fn(), drive: vi.fn(), resumeIndex: 0 }))
vi.mock('driver.js', () => ({ driver: (config: Config) => {
  tour.config = config
  return { moveNext: tour.moveNext, destroy: tour.destroy, drive: tour.drive, getConfig: () => tour.config }
} }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_key: string, options: { defaultValue: string }) => options.defaultValue }) }))
vi.mock('@/hooks/useAtomicTourListener', () => ({ useAtomicTourListener: vi.fn(), notifyAtomicTourCompleted: vi.fn() }))
vi.mock('@/lib/atomic-tour-final-step', () => ({ buildFinalStepFooter: () => ({}) }))
vi.mock('@/lib/tour-progress', () => ({ getTourStepIndex: () => tour.resumeIndex, setTourStepIndex: vi.fn() }))

import { useProductCreationTour } from '../useProductCreationTour'
import { useRecipeCreationTour } from '../useRecipeCreationTour'

const selector = (key: string) => `[data-tour="product-wizard-${key}"]`
function start(hook: () => { start: () => void | Promise<void>; stop: () => void }) {
  const result = renderHook(hook)
  act(() => { void result.result.current.start() })
}
function step(key: string) {
  const result = tour.config.steps?.find(s => s.element === selector(key))
  expect(result, `tour step ${key}`).toBeDefined()
  return result!
}
async function next(current: DriveStep) {
  expect(current.popover?.onNextClick, 'the preceding step must reveal the next field').toBeTypeOf('function')
  await act(async () => current.popover!.onNextClick!(undefined, current, { driver: {} } as never))
}
function opener(key: string, targets: string[], disabled = false) {
  const button = document.createElement('button')
  button.dataset.tour = `product-wizard-add-${key}`
  button.disabled = disabled
  const click = vi.fn(() => {
    for (const target of targets) {
      const field = document.createElement('div')
      field.dataset.tour = `product-wizard-${target}`
      if (target === 'optional-description') field.appendChild(document.createElement('textarea'))
      document.body.appendChild(field)
    }
    button.remove()
  })
  button.addEventListener('click', click)
  document.body.appendChild(button)
  return click
}

beforeEach(() => { vi.useFakeTimers(); document.body.innerHTML = ''; tour.resumeIndex = 0 })
afterEach(() => { cleanup(); vi.clearAllTimers(); vi.useRealTimers() })

describe('product tours reveal optional controls before advancing', () => {
  it('opens description before its tour step', async () => {
    start(useProductCreationTour)
    const click = opener('description', ['optional-description'])
    await next(step('name'))
    expect(click).toHaveBeenCalledOnce()
    expect(tour.moveNext).toHaveBeenCalledOnce()
    expect(tour.config.steps?.some(s => s.element === `${selector('optional-description')} textarea`)).toBe(true)
  })

  for (const [name, hook] of [['product', useProductCreationTour], ['recipe', useRecipeCreationTour]] as const) {
    it(`${name}: opens codes before SKU, without toggling an already open section`, async () => {
      start(hook)
      const click = opener('codes', ['sku', 'gtin'])
      await next(step('price'))
      expect(click).toHaveBeenCalledOnce()
      expect(document.querySelector(selector('sku'))).not.toBeNull()
      await next(step('price'))
      expect(click).toHaveBeenCalledOnce()
    })
  }

  it('opens quantity before highlighting inventory and stock', async () => {
    start(useProductCreationTour)
    const click = opener('inventory', ['initial-stock'])
    await next(step('category'))
    expect(click).toHaveBeenCalledOnce()
    await next(step('track-inventory'))
    expect(click).toHaveBeenCalledOnce()
    expect(tour.moveNext).toHaveBeenCalledTimes(2)
  })

  it('opens recipe once before method, portion and ingredients', async () => {
    start(useRecipeCreationTour)
    const click = opener('recipe', ['method-recipe', 'portion-yield', 'ingredients'])
    await next(step('category'))
    await next(step('track-inventory'))
    await next(step('method-recipe'))
    expect(click).toHaveBeenCalledOnce()
    expect(document.querySelector(selector('portion-yield'))).not.toBeNull()
    expect(document.querySelector(selector('ingredients'))).not.toBeNull()
    expect(tour.moveNext).toHaveBeenCalledTimes(3)
  })

  it('does not bypass plan denial or advance to an absent recipe field', async () => {
    start(useRecipeCreationTour)
    const click = opener('recipe', ['portion-yield'], true)
    await next(step('category'))
    expect(click).not.toHaveBeenCalled()
    expect(tour.moveNext).not.toHaveBeenCalled()
  })
})


function prepareResume(key: string) {
  const result = renderHook(useProductCreationTour)
  act(() => { void result.result.current.start() })
  tour.resumeIndex = tour.config.steps!.findIndex(s => s.element === selector(key))
  expect(tour.resumeIndex).toBeGreaterThan(2)
  tour.drive.mockClear()
  return result
}
function appendButton(key: string, click: () => void) {
  const button = document.createElement('button')
  button.dataset.tour = key
  button.addEventListener('click', click)
  document.body.appendChild(button)
  return button
}

describe('product tour resume', () => {
  it('opens only the missing codes section in an existing wizard without clearing its draft', async () => {
    const result = prepareResume('sku')
    const name = document.createElement('input')
    name.dataset.tour = 'product-wizard-name'
    name.value = 'Mi borrador'
    document.body.appendChild(name)
    const click = opener('codes', ['sku', 'gtin'])
    await act(async () => result.result.current.start())
    expect(click).toHaveBeenCalledOnce()
    expect(name.value).toBe('Mi borrador')
    expect(tour.drive).toHaveBeenCalledWith(tour.resumeIndex)
  })

  it('restores a closed wizard through the public buttons before reopening the saved section', async () => {
    const result = prepareResume('sku')
    const actions: string[] = []
    appendButton('product-new-btn', () => {
      actions.push('new')
      appendButton('product-type-regular', () => { actions.push('regular') })
      appendButton('product-type-next', () => {
        actions.push('next')
        const name = document.createElement('input')
        name.dataset.tour = 'product-wizard-name'
        document.body.appendChild(name)
        const click = opener('codes', ['sku', 'gtin'])
        document.querySelector(selector('add-codes'))!.addEventListener('click', () => { actions.push('codes') })
        expect(click).not.toHaveBeenCalled()
      })
    })
    await act(async () => {
      const pending = result.result.current.start()
      await vi.advanceTimersByTimeAsync(120)
      await pending
    })
    expect(actions).toEqual(['new', 'regular', 'next', 'codes'])
    expect(tour.drive).toHaveBeenCalledWith(tour.resumeIndex)
  })

  it('does not drive a hidden stock field when its opener is disabled', async () => {
    const result = prepareResume('initial-stock')
    const name = document.createElement('input')
    name.dataset.tour = 'product-wizard-name'
    document.body.appendChild(name)
    const click = opener('inventory', ['initial-stock'], true)
    await act(async () => result.result.current.start())
    expect(click).not.toHaveBeenCalled()
    expect(tour.drive).not.toHaveBeenCalled()
  })

  it('does not select a type or drive after stop while the selector is loading', async () => {
    const result = prepareResume('sku')
    const selectType = vi.fn()
    appendButton('product-new-btn', () => {
      setTimeout(() => { appendButton('product-type-regular', selectType) }, 100)
    })
    await act(async () => {
      const pending = result.result.current.start()
      result.result.current.stop()
      await vi.advanceTimersByTimeAsync(100)
      await pending
    })
    expect(selectType).not.toHaveBeenCalled()
    expect(tour.drive).not.toHaveBeenCalled()
  })

  it('does not advance after destroy while a section is mounting', async () => {
    start(useProductCreationTour)
    appendButton('product-wizard-add-codes', () => {
      setTimeout(() => {
        const sku = document.createElement('input')
        sku.dataset.tour = 'product-wizard-sku'
        document.body.appendChild(sku)
      }, 100)
    })
    const pending = next(step('price'))
    tour.config.onDestroyed?.(undefined, {}, {} as never)
    await vi.advanceTimersByTimeAsync(100)
    await pending
    expect(tour.moveNext).not.toHaveBeenCalled()
  })
})

describe('tour cancellation across every delayed public action', () => {
  it('invalidates a pending resume before destroy on unmount', async () => {
    const result = prepareResume('sku')
    const selectType = vi.fn()
    appendButton('product-new-btn', () => {
      setTimeout(() => { appendButton('product-type-regular', selectType) }, 100)
    })
    await act(async () => {
      const pending = result.result.current.start()
      result.unmount()
      await vi.advanceTimersByTimeAsync(4500)
      await pending
    })
    expect(selectType).not.toHaveBeenCalled()
    expect(tour.drive).not.toHaveBeenCalled()
  })

  for (const [kind, hook, type] of [
    ['product', useProductCreationTour, 'regular'],
    ['recipe', useRecipeCreationTour, 'food'],
  ] as const) {
    it(`${kind}: does not click Next after destruction during the selection delay`, async () => {
      start(hook)
      appendButton(`product-type-${type}`, () => {})
      const forward = vi.fn(() => {
        const name = document.createElement('input')
        name.dataset.tour = 'product-wizard-name'
        document.body.appendChild(name)
      })
      appendButton('product-type-next', forward)
      const select = tour.config.steps!.find(s => s.element === `[data-tour="product-type-${type}"]`)!
      const pending = next(select)
      tour.config.onDestroyed?.(undefined, {}, {} as never)
      await vi.advanceTimersByTimeAsync(120)
      await pending
      expect(forward).not.toHaveBeenCalled()
      expect(tour.moveNext).not.toHaveBeenCalled()
    })

    it(`${kind}: does not highlight an absent type when opening times out`, async () => {
      start(hook)
      const open = tour.config.steps!.find(s => s.element === '[data-tour="product-new-btn"]')!
      const pending = next(open)
      await vi.advanceTimersByTimeAsync(4000)
      await pending
      expect(tour.moveNext).not.toHaveBeenCalled()
    })
  }

  it('does not open the saved section after stop while the restored wizard mounts', async () => {
    const result = prepareResume('sku')
    let codes: ReturnType<typeof opener> | undefined
    appendButton('product-new-btn', () => {
      appendButton('product-type-regular', () => {})
      appendButton('product-type-next', () => {
        setTimeout(() => {
          const name = document.createElement('input')
          name.dataset.tour = 'product-wizard-name'
          document.body.appendChild(name)
          codes = opener('codes', ['sku', 'gtin'])
        }, 100)
      })
    })
    await act(async () => {
      const pending = result.result.current.start()
      await vi.advanceTimersByTimeAsync(120)
      result.result.current.stop()
      await vi.advanceTimersByTimeAsync(100)
      await pending
    })
    expect(codes).toBeDefined()
    expect(codes).not.toHaveBeenCalled()
    expect(tour.drive).not.toHaveBeenCalled()
  })
})

it('a replacement tour invalidates the older pending resume without opening another wizard', async () => {
  const result = prepareResume('sku')
  const selectType = vi.fn()
  appendButton('product-new-btn', () => {
    setTimeout(() => { appendButton('product-type-regular', selectType) }, 100)
  })
  await act(async () => {
    const pending = result.result.current.start()
    tour.resumeIndex = 0
    await result.result.current.start()
    await vi.advanceTimersByTimeAsync(100)
    await pending
  })
  expect(selectType).not.toHaveBeenCalled()
  expect(tour.drive).toHaveBeenCalledOnce()
  expect(tour.drive).toHaveBeenCalledWith(0)
})
